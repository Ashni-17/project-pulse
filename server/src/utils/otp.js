
import {
  randomInt,
  createHmac,
  timingSafeEqual,
} from 'node:crypto';

import { env } from '../config/env.js';

export const OTP_EXPIRY_MINUTES = 5;
export const OTP_RESEND_SECONDS = 60;
export const OTP_MAX_ATTEMPTS = 5;

// Generate a secure six-digit OTP
export function generateOTP() {
  return String(randomInt(0, 1000000)).padStart(6, '0');
}

// Hash the OTP before storing it in PostgreSQL
export function hashOTP(email, otp) {
  return createHmac('sha256', env.jwtSecret)
    .update(`registration:${email}:${otp}`)
    .digest('hex');
}

// Securely compare the submitted OTP
export function verifyOTP(email, otp, storedHash) {
  const actual = Buffer.from(hashOTP(email, otp), 'hex');
  const expected = Buffer.from(storedHash, 'hex');

  return actual.length === expected.length &&
    timingSafeEqual(actual, expected);
}

// Calculate OTP expiration time
export function getOTPExpiry() {
  return new Date(
    Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
  );
}
