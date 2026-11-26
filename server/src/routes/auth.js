
import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { query, withTransaction } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError, asyncHandler } from '../utils/errors.js';

import {
  parse,
  registerSchema,
  loginSchema,
  verifyOTPSchema,
  resendOTPSchema,
} from '../utils/validation.js';
import {
  generateOTP,
  hashOTP,
  getOTPExpiry,
  verifyOTP,
  OTP_RESEND_SECONDS,
  OTP_MAX_ATTEMPTS,
} from '../utils/otp.js';

import {
  sendVerificationEmail,
} from '../services/email.js';

const router = Router();
const signToken = (userId, tokenVersion) =>
  jwt.sign(
    { tokenVersion },
    env.jwtSecret,
    {
      subject: userId,
      expiresIn: '7d',
    }
  );
const publicUser = ({ id, name, email }) => ({
  id,
  name,
  email,
});

// ==========================================
// REGISTER: Send email verification OTP
// ==========================================

router.post('/register', asyncHandler(async (req, res) => {

  const { name, email, password } =
    parse(registerSchema, req.body);

  // Check whether the account already exists
  const existingUser = await query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );

  if (existingUser.rows.length > 0) {
    throw new HttpError(
      409,
      'An account with this email already exists',
      { email: ['Already registered'] }
    );
  }

  // Generate secure registration credentials
  const passwordHash = await bcrypt.hash(password, 12);
  const otp = generateOTP();
  const otpHash = hashOTP(email, otp);
  const expiresAt = getOTPExpiry();

  // Store temporary registration details.
  // Enforce cooldown even for concurrent requests.
  const { rows } = await query(
    `INSERT INTO pending_registrations
      (name, email, password_hash, otp_hash,
       expires_at, attempts, last_sent_at)

     VALUES ($1, $2, $3, $4, $5, 0, now())

     ON CONFLICT (email) DO UPDATE SET
       id = gen_random_uuid(),
       name = EXCLUDED.name,
       password_hash = EXCLUDED.password_hash,
       otp_hash = EXCLUDED.otp_hash,
       expires_at = EXCLUDED.expires_at,
       attempts = 0,
       last_sent_at = now(),
       created_at = now()

     WHERE pending_registrations.last_sent_at
       <= now() - ($6::integer * interval '1 second')

     RETURNING id`,

    [
      name,
      email,
      passwordHash,
      otpHash,
      expiresAt,
      OTP_RESEND_SECONDS,
    ]
  );

  if (rows.length === 0) {
    throw new HttpError(
      429,
      'Please wait 60 seconds before requesting another code'
    );
  }

  const registration = rows[0];

  // Send real OTP to the user's email
  try {
    await sendVerificationEmail(email, otp);
  } catch {
    await query(
      'DELETE FROM pending_registrations WHERE id = $1',
      [registration.id]
    );

    throw new HttpError(
      503,
      'Unable to send verification email. Please try again.'
    );
  }

  res.status(202).json({
    message: 'Verification code sent to your email',
    registrationId: registration.id,
    email,
    expiresIn: 300,
    resendAfter: OTP_RESEND_SECONDS,
  });
}));


// ==========================================
// VERIFY OTP: Create verified user account
// ==========================================

router.post('/verify-otp', asyncHandler(async (req, res) => {

  const { registrationId, otp } =
    parse(verifyOTPSchema, req.body);

  const result = await withTransaction(async (client) => {

    // Lock registration to prevent simultaneous verification
    const { rows: [registration] } = await client.query(
      `SELECT * FROM pending_registrations
       WHERE id = $1
       FOR UPDATE`,
      [registrationId]
    );

    if (!registration) {
      return {
        error: 'Invalid registration request. Please register again.',
        status: 404,
      };
    }

    // Check OTP expiration
    if (new Date(registration.expires_at).getTime() <= Date.now()) {
      return {
        error: 'OTP has expired. Please request a new code.',
        status: 400,
      };
    }

    // Check maximum verification attempts
    if (registration.attempts >= OTP_MAX_ATTEMPTS) {
      return {
        error: 'Too many incorrect attempts. Please request a new code.',
        status: 429,
      };
    }

    // Verify submitted OTP
    const valid = verifyOTP(
      registration.email,
      otp,
      registration.otp_hash
    );

    if (!valid) {

      const attempts = registration.attempts + 1;

      await client.query(
        `UPDATE pending_registrations
         SET attempts = $1
         WHERE id = $2`,
        [attempts, registrationId]
      );

      const remaining = OTP_MAX_ATTEMPTS - attempts;

      return {
        error: remaining > 0
          ? `Incorrect OTP. ${remaining} attempts remaining.`
          : 'Too many incorrect attempts. Please request a new code.',
        status: remaining > 0 ? 400 : 429,
      };
    }

    // Create account only after successful verification
    const { rows: [user] } = await client.query(
      `INSERT INTO users
        (name, email, password_hash, email_verified_at)

       VALUES ($1, $2, $3, now())

       ON CONFLICT (email) DO NOTHING

       RETURNING id, name, email`,
      [
        registration.name,
        registration.email,
        registration.password_hash,
      ]
    );

    // Consume registration so OTP cannot be reused
    await client.query(
      'DELETE FROM pending_registrations WHERE id = $1',
      [registrationId]
    );

    if (!user) {
      return {
        error: 'An account with this email already exists.',
        status: 409,
      };
    }

    return { user };
  });

  // Return errors after committing verification attempts
  if (result.error) {
    throw new HttpError(result.status, result.error);
  }

  res.status(201).json({
    message: 'Email verified successfully. You can now sign in.',
    user: publicUser(result.user),
  });
}));

// ==========================================
// RESEND OTP: Generate a new verification code
// ==========================================

router.post('/resend-otp', asyncHandler(async (req, res) => {

  const { registrationId } =
    parse(resendOTPSchema, req.body);

  const otp = generateOTP();

  const result = await withTransaction(async (client) => {

    const { rows: [registration] } = await client.query(
      `SELECT * FROM pending_registrations
       WHERE id = $1
       FOR UPDATE`,
      [registrationId]
    );

    if (!registration) {
      return {
        error: 'Invalid registration request. Please register again.',
        status: 404,
      };
    }

    // Enforce resend cooldown
    const elapsedSeconds = Math.floor(
      (Date.now() -
        new Date(registration.last_sent_at).getTime()) / 1000
    );

    if (elapsedSeconds < OTP_RESEND_SECONDS) {

      const remaining =
        OTP_RESEND_SECONDS - elapsedSeconds;

      return {
        error: `Please wait ${remaining} seconds before resending OTP.`,
        status: 429,
      };
    }

    // Generate a new hash and expiry
    const otpHash = hashOTP(registration.email, otp);
    const expiresAt = getOTPExpiry();

    // Replace the previous OTP
    await client.query(
      `UPDATE pending_registrations
       SET otp_hash = $1,
           expires_at = $2,
           attempts = 0,
           last_sent_at = now()
       WHERE id = $3`,
      [otpHash, expiresAt, registrationId]
    );

    return {
      email: registration.email,
      otpHash,
    };
  });

  if (result.error) {
    throw new HttpError(result.status, result.error);
  }

  // Send the new OTP
  try {

    await sendVerificationEmail(result.email, otp);

  } catch {

    // Invalidate the undelivered code
    await query(
      `UPDATE pending_registrations
       SET expires_at = now()
       WHERE id = $1 AND otp_hash = $2`,
      [registrationId, result.otpHash]
    );

    throw new HttpError(
      503,
      'Unable to resend verification email. Please try again after 60 seconds.'
    );
  }

  res.json({
    message: 'A new verification code has been sent to your email.',
    registrationId,
    expiresIn: 300,
    resendAfter: OTP_RESEND_SECONDS,
  });
}));



// ==========================================
// LOGIN: Existing email/password login
// ==========================================

router.post('/login', asyncHandler(async (req, res) => {

  const { email, password } =
    parse(loginSchema, req.body);

  const { rows: [user] } = await query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  const valid =
    user &&
    user.password_hash &&
    await bcrypt.compare(password, user.password_hash);

  if (!valid) {
    throw new HttpError(
      401,
      'Email or password is incorrect'
    );
  }

  res.json({
  token: signToken(user.id, user.token_version),
  user: publicUser(user),
});
}));

// ==========================================
// CURRENT USER
// ==========================================

router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: publicUser(req.user),
  });
});

export default router;
