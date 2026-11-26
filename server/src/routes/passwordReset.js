import { Router } from 'express';

import { query, withTransaction } from '../config/db.js';

import { HttpError, asyncHandler } from '../utils/errors.js';

import bcrypt from 'bcrypt';

import {
  disconnectUserSessions,
} from '../realtime/socket.js';

import {
  parse,
  forgotPasswordSchema,
  verifyResetOTPSchema,
  resetPasswordSchema,
} from '../utils/validation.js';

import { generateOTP } from '../utils/otp.js';

import {
  hashResetOTP,
  getResetOTPExpiry,
  verifyResetOTP,
  RESET_OTP_RESEND_SECONDS,
  RESET_OTP_MAX_ATTEMPTS,
} from '../utils/passwordReset.js';

import {
  sendPasswordResetEmail,
} from '../services/email.js';

import {
  generateSecureToken,
  hashToken,
} from '../utils/oauth.js';

const router = Router();

router.post('/forgot-password', asyncHandler(async (req, res) => {

  const { email } = parse(forgotPasswordSchema, req.body);

  const response = {
    message:
      'If an eligible account exists with this email, a verification code will be sent.',
    expiresIn: 300,
    resendAfter: 60,
  };

  // Find an eligible password-based account
  const { rows: [user] } = await query(
    `SELECT id, email
     FROM users
     WHERE email = $1
       AND password_hash IS NOT NULL
       AND email_verified_at IS NOT NULL`,
    [email]
  );

  // Do not reveal whether an account exists
  if (!user) {
    return res.status(202).json(response);
  }

  // Generate OTP
  const otp = generateOTP();
  const otpHash = hashResetOTP(user.id, otp);
  const expiresAt = getResetOTPExpiry();

  // Store the OTP and enforce resend cooldown
  const { rows } = await query(
    `INSERT INTO password_reset_requests (
       user_id,
       otp_hash,
       expires_at,
       attempts,
       last_sent_at
     )
     VALUES ($1, $2, $3, 0, now())

     ON CONFLICT (user_id)
     DO UPDATE SET
       otp_hash = EXCLUDED.otp_hash,
       expires_at = EXCLUDED.expires_at,
       attempts = 0,
       last_sent_at = now(),
       created_at = now()

     WHERE password_reset_requests.last_sent_at
       <= now() - ($4::integer * interval '1 second')

     RETURNING id`,
    [
      user.id,
      otpHash,
      expiresAt,
      RESET_OTP_RESEND_SECONDS,
    ]
  );

  // Cooldown is active
  if (rows.length === 0) {
    return res.status(202).json(response);
  }

  // Send real password reset email
  try {
    await sendPasswordResetEmail(user.email, otp);

  } catch {
    // Remove only the failed OTP request
    await query(
      `DELETE FROM password_reset_requests
       WHERE user_id = $1 AND otp_hash = $2`,
      [user.id, otpHash]
    );

    console.error('Password reset email delivery failed');
  }

  return res.status(202).json(response);
}));

router.post('/verify-reset-otp', asyncHandler(async (req, res) => {

  const { email, otp } = parse(
    verifyResetOTPSchema,
    req.body
  );

  const resetToken = generateSecureToken();
  const tokenHash = hashToken(resetToken);

  const result = await withTransaction(async (client) => {

    // Find the password reset request
    const { rows: [request] } = await client.query(
      `SELECT pr.*
       FROM password_reset_requests pr
       JOIN users u ON u.id = pr.user_id
       WHERE u.email = $1
         AND u.password_hash IS NOT NULL
         AND u.email_verified_at IS NOT NULL
       FOR UPDATE OF pr`,
      [email]
    );

    if (!request) {
      return {
        error: 'Invalid or expired verification code.',
        status: 400,
      };
    }

    // Check OTP expiration
    if (new Date(request.expires_at).getTime() <= Date.now()) {
      return {
        error: 'Invalid or expired verification code.',
        status: 400,
      };
    }

    // Check maximum attempts
    if (request.attempts >= RESET_OTP_MAX_ATTEMPTS) {
      return {
        error: 'Too many incorrect attempts. Request a new code.',
        status: 429,
      };
    }

    // Verify OTP
    const valid = verifyResetOTP(
      request.user_id,
      otp,
      request.otp_hash
    );

    if (!valid) {

      const attempts = request.attempts + 1;

      await client.query(
        `UPDATE password_reset_requests
         SET attempts = $1
         WHERE id = $2`,
        [attempts, request.id]
      );

      return {
        error: attempts >= RESET_OTP_MAX_ATTEMPTS
          ? 'Too many incorrect attempts. Request a new code.'
          : 'Invalid or expired verification code.',

        status: attempts >= RESET_OTP_MAX_ATTEMPTS
          ? 429
          : 400,
      };
    }

    // Store hashed reset token for 10 minutes
    await client.query(
      `INSERT INTO password_reset_tokens (
         user_id,
         token_hash,
         expires_at
       )
       VALUES ($1, $2, now() + interval '10 minutes')

       ON CONFLICT (user_id)
       DO UPDATE SET
         token_hash = EXCLUDED.token_hash,
         expires_at = EXCLUDED.expires_at,
         created_at = now()`,
      [request.user_id, tokenHash]
    );

    // Invalidate the used OTP
    await client.query(
      `DELETE FROM password_reset_requests
       WHERE id = $1`,
      [request.id]
    );

    return { success: true };
  });

  if (result.error) {
    throw new HttpError(result.status, result.error);
  }

  res.set('Cache-Control', 'no-store');

  res.json({
    message: 'OTP verified successfully.',
    resetToken,
    expiresIn: 600,
  });
}));
// ==========================================
// RESET PASSWORD: Update verified credentials
// ==========================================

router.post('/reset-password', asyncHandler(async (req, res) => {

  const { resetToken, password } = parse(
    resetPasswordSchema,
    req.body
  );

  const tokenHash = hashToken(resetToken);

  // Check whether the reset token is valid
  const { rows: [existingToken] } = await query(
    `SELECT user_id
     FROM password_reset_tokens
     WHERE token_hash = $1
       AND expires_at > now()`,
    [tokenHash]
  );

  if (!existingToken) {
    throw new HttpError(
      400,
      'Invalid or expired reset session. Please request a new code.'
    );
  }

  // Hash the new password
  const passwordHash = await bcrypt.hash(password, 12);

  const result = await withTransaction(async (client) => {

    // Consume the reset token atomically
    const { rows: [resetRequest] } = await client.query(
      `DELETE FROM password_reset_tokens
       WHERE token_hash = $1
         AND expires_at > now()
       RETURNING user_id`,
      [tokenHash]
    );

    if (!resetRequest) {
      return {
        error: 'Invalid or expired reset session.',
        status: 400,
      };
    }

    // Update password and invalidate previous JWT sessions
    const { rows: [user] } = await client.query(
      `UPDATE users
       SET password_hash = $1,
           token_version = token_version + 1
       WHERE id = $2
         AND password_hash IS NOT NULL
         AND email_verified_at IS NOT NULL
       RETURNING id, token_version`,
      [passwordHash, resetRequest.user_id]
    );

    if (!user) {
      throw new HttpError(
        400,
        'Unable to reset password.'
      );
    }

    // Remove outstanding password reset OTPs
    await client.query(
      `DELETE FROM password_reset_requests
       WHERE user_id = $1`,
      [user.id]
    );

    return { user };
  });

  if (result.error) {
    throw new HttpError(result.status, result.error);
  }

  // Disconnect old real-time sessions after transaction commits
  try {

    await disconnectUserSessions(
      result.user.id,
      result.user.token_version
    );

  } catch (error) {

    console.error(
      'Unable to disconnect previous socket sessions'
    );

  }

  res.set('Cache-Control', 'no-store');

  res.json({
    message:
      'Password reset successfully. Please sign in with your new password.',
  });
}));  

export default router;