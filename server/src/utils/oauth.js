import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

export const OAUTH_EXPIRY_MINUTES = 10;

export function generateSecureToken() {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token) {
  return createHash('sha256')
    .update(token)
    .digest('hex');
}

export function generateCodeChallenge(codeVerifier) {
  return createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
}

export function getOAuthExpiry() {
  return new Date(
    Date.now() + OAUTH_EXPIRY_MINUTES * 60 * 1000
  );
}

export function safeCompare(first, second) {
  if (typeof first !== 'string' || typeof second !== 'string') {
    return false;
  }

  const a = Buffer.from(first);
  const b = Buffer.from(second);

  return a.length === b.length && timingSafeEqual(a, b);
}