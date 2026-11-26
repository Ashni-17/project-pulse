import {
  createHmac,
  timingSafeEqual,
} from 'node:crypto';

import { env } from '../config/env.js';

export const RESET_OTP_EXPIRY_MINUTES = 5;
export const RESET_OTP_RESEND_SECONDS = 60;
export const RESET_OTP_MAX_ATTEMPTS = 5;

// Generate a password reset-specific OTP hash
export function hashResetOTP(userId, otp) {
  return createHmac('sha256', env.jwtSecret)
    .update(`password-reset:${userId}:${otp}`)
    .digest('hex');
}

// Verify the password reset OTP
export function verifyResetOTP(userId, otp, storedHash) {
  const actual = Buffer.from(
    hashResetOTP(userId, otp),
    'hex'
  );

  const expected = Buffer.from(storedHash, 'hex');

  return (
    actual.length === expected.length &&
    timingSafeEqual(actual, expected)
  );
}

// Calculate OTP expiration time
export function getResetOTPExpiry() {
  return new Date(
    Date.now() + RESET_OTP_EXPIRY_MINUTES * 60 * 1000
  );
}