import { withTransaction } from '../config/db.js';
import { HttpError } from '../utils/errors.js';

export async function findOrCreateGoogleUser(profile) {
  const provider = 'google';
  const providerUserId = profile.sub;
  const email = profile.email.trim().toLowerCase();

  const name = (
    profile.name?.trim() || email.split('@')[0]
  ).slice(0, 80);

  return withTransaction(async (client) => {

    // Check whether this Google account is already registered
    const { rows: [existingAccount] } = await client.query(
      `SELECT u.id, u.name, u.email
       FROM oauth_accounts oa
       JOIN users u ON u.id = oa.user_id
       WHERE oa.provider = $1
         AND oa.provider_user_id = $2`,
      [provider, providerUserId]
    );

    if (existingAccount) {
      return existingAccount;
    }

    // Prevent unsafe automatic account linking
    const { rows: [existingUser] } = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser) {
      throw new HttpError(
        409,
        'An account already exists with this email. Please sign in using your existing login method.'
      );
    }

    // Create a new verified Google user
    const { rows: [user] } = await client.query(
      `INSERT INTO users (
        name,
        email,
        password_hash,
        email_verified_at
      )
      VALUES ($1, $2, NULL, now())
      ON CONFLICT (email) DO NOTHING
      RETURNING id, name, email`,
      [name, email]
    );

    if (!user) {
      throw new HttpError(
        409,
        'An account already exists. Please sign in again.'
      );
    }

    // Connect Google identity to Project Pulse user
    await client.query(
      `INSERT INTO oauth_accounts (
        user_id,
        provider,
        provider_user_id
      )
      VALUES ($1, $2, $3)`,
      [user.id, provider, providerUserId]
    );

    return user;
  });
}