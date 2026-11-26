import { Router } from 'express';
import { googleClient, googleConfigured } from '../config/google.js';
import { query } from '../config/db.js';
import { env } from '../config/env.js';
import { HttpError, asyncHandler } from '../utils/errors.js';
import { findOrCreateGoogleUser } from '../services/oauth.js';
import jwt from 'jsonwebtoken';

import {
  generateSecureToken,
  hashToken,
  generateCodeChallenge,
  getOAuthExpiry,
} from '../utils/oauth.js';

const router = Router();

router.get('/google', asyncHandler(async (req, res) => {

  if (!googleConfigured) {
    throw new HttpError(503, 'Google authentication is not configured');
  }

  // Generate OAuth security tokens
  const state = generateSecureToken();
  const nonce = generateSecureToken();
  const codeVerifier = generateSecureToken();
  const browserBinding = generateSecureToken();

  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Remove expired OAuth sessions
  await query(
    'DELETE FROM oauth_sessions WHERE expires_at <= now()'
  );

  // Store temporary OAuth session
  await query(
    `INSERT INTO oauth_sessions (
      provider,
      state_hash,
      nonce,
      code_verifier,
      browser_binding_hash,
      expires_at
    )
    VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      'google',
      hashToken(state),
      nonce,
      codeVerifier,
      hashToken(browserBinding),
      getOAuthExpiry(),
    ]
  );

  // Bind OAuth request to the current browser
  res.cookie('pulse_google_oauth', browserBinding, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/api/auth/google',
  });

  // Generate Google authorization URL
  const authorizationUrl = googleClient.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  res.set('Cache-Control', 'no-store');

  // Redirect user to Google
  res.redirect(authorizationUrl);
}));

router.get('/google/callback', asyncHandler(async (req, res) => {
  if (!googleConfigured) {
    throw new HttpError(503, 'Google authentication is not configured');
  }

  const { code, state, error } = req.query;

  if (error) {
    throw new HttpError(400, 'Google sign-in was cancelled');
  }

  if (typeof code !== 'string' || typeof state !== 'string') {
    throw new HttpError(400, 'Invalid Google authentication response');
  }

  // Read the browser binding cookie
  const cookies = req.headers.cookie || '';

  const bindingCookie = cookies
    .split(';')
    .map(cookie => cookie.trim())
    .find(cookie => cookie.startsWith('pulse_google_oauth='));

  const browserBinding = bindingCookie
    ?.slice('pulse_google_oauth='.length);

  if (!browserBinding) {
    throw new HttpError(400, 'Google authentication session is missing');
  }

  // Validate and consume the session exactly once
  const { rows: [session] } = await query(
    `DELETE FROM oauth_sessions
     WHERE provider = $1
       AND state_hash = $2
       AND browser_binding_hash = $3
       AND expires_at > now()
     RETURNING *`,
    [
      'google',
      hashToken(state),
      hashToken(browserBinding),
    ]
  );

  if (!session) {
    throw new HttpError(400, 'Invalid or expired Google session');
  }

  res.clearCookie('pulse_google_oauth', {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api/auth/google',
  });

  // Exchange authorization code using PKCE
  const { tokens } = await googleClient.getToken({
    code,
    codeVerifier: session.code_verifier,
    redirect_uri: process.env.GOOGLE_CALLBACK_URL,
  });

  if (!tokens.id_token) {
    throw new HttpError(401, 'Google identity token is missing');
  }

  // Verify Google's signed identity token
  const ticket = await googleClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const profile = ticket.getPayload();

  if (!profile || !profile.sub || !profile.email) {
    throw new HttpError(401, 'Invalid Google profile');
  }

  if (profile.nonce !== session.nonce) {
    throw new HttpError(401, 'Google identity verification failed');
  }

  if (profile.email_verified !== true) {
    throw new HttpError(403, 'Google email is not verified');
  }

  // Temporary response for identity verification testing
 // Find or create the Project Pulse user
const user = await findOrCreateGoogleUser(profile);

// Generate a one-time login code
const loginCode = generateSecureToken();
const loginBinding = generateSecureToken();

const expiresAt = new Date(Date.now() + 60 * 1000);

// Remove expired login codes
await query(
  'DELETE FROM oauth_login_codes WHERE expires_at <= now()'
);

// Store the hashed login code
await query(
  `INSERT INTO oauth_login_codes (
    user_id,
    code_hash,
    browser_binding_hash,
    expires_at
  )
  VALUES ($1, $2, $3, $4)`,
  [
    user.id,
    hashToken(loginCode),
    hashToken(loginBinding),
    expiresAt,
  ]
);

// Bind the login exchange to the browser
res.cookie('pulse_oauth_exchange', loginBinding, {
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: 'lax',
  maxAge: 60 * 1000,
  path: '/api/auth/google/exchange',
});

res.set('Cache-Control', 'no-store');
res.set('Referrer-Policy', 'no-referrer');

// Redirect to the frontend OAuth callback
const callbackUrl = new URL('/auth/callback', env.clientUrl);

callbackUrl.searchParams.set('code', loginCode);

res.redirect(callbackUrl.toString());
}));

router.post('/google/exchange', asyncHandler(async (req, res) => {

  const { code } = req.body || {};

  // Validate the one-time login code
  if (
    typeof code !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(code)
  ) {
    throw new HttpError(400, 'Invalid login code');
  }

  // Read browser binding cookie
  const cookies = req.headers.cookie || '';

  const bindingCookie = cookies
    .split(';')
    .map(cookie => cookie.trim())
    .find(cookie =>
      cookie.startsWith('pulse_oauth_exchange=')
    );

  const browserBinding = bindingCookie
    ?.slice('pulse_oauth_exchange='.length);

  if (!browserBinding) {
    throw new HttpError(401, 'Login session is missing');
  }

  // Validate and consume the login code exactly once
  const { rows: [user] } = await query(
    `DELETE FROM oauth_login_codes AS lc
     USING users AS u
     WHERE lc.user_id = u.id
       AND lc.code_hash = $1
       AND lc.browser_binding_hash = $2
       AND lc.expires_at > now()
    RETURNING u.id, u.name, u.email, u.token_version`,
    [
      hashToken(code),
      hashToken(browserBinding),
    ]
  );

  if (!user) {
    throw new HttpError(
      401,
      'Invalid or expired login session. Please sign in again.'
    );
  }

  // Remove the temporary exchange cookie
  res.clearCookie('pulse_oauth_exchange', {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api/auth/google/exchange',
  });

  // Generate Project Pulse authentication token
  const token = jwt.sign(
  { tokenVersion: user.token_version },
  env.jwtSecret,
  {
    subject: user.id,
    expiresIn: '7d',
  }
);
  res.set('Cache-Control', 'no-store');

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
}));

export default router;