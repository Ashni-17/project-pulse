import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../config/db.js';
import { HttpError, asyncHandler } from '../utils/errors.js';

// ==========================================
// REUSABLE SESSION VALIDATION
// ==========================================

export async function validateSession(req) {

  const header = req.headers.authorization || '';

  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : null;

  if (!token) {
    throw new HttpError(
      401,
      'Please sign in to continue'
    );
  }

  let payload;

  try {
    payload = jwt.verify(token, env.jwtSecret, {
      algorithms: ['HS256'],
    });
  } catch {
    throw new HttpError(
      401,
      'Your session has expired. Please sign in again'
    );
  }

  const { rows: [user] } = await query(
    `SELECT id, name, email, token_version
     FROM users
     WHERE id = $1`,
    [payload.sub]
  );

  if (!user) {
    throw new HttpError(
      401,
      'Account no longer exists'
    );
  }

  const tokenVersion = payload.tokenVersion ?? 0;

  if (tokenVersion !== user.token_version) {
    throw new HttpError(
      401,
      'Your session is no longer valid. Please sign in again'
    );
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

// ==========================================
// AUTHENTICATION MIDDLEWARE
// ==========================================

export const requireAuth = asyncHandler(
  async (req, res, next) => {

    req.user = await validateSession(req);

    next();

  }
);

// ==========================================
// PROJECT MEMBERSHIP
// ==========================================

export const projectAccess = asyncHandler(
  async (req, res, next) => {

    const { rows } = await query(
      `SELECT role
       FROM project_members
       WHERE project_id = $1 AND user_id = $2`,
      [req.params.projectId, req.user.id]
    );

    if (!rows[0]) {
      throw new HttpError(
        404,
        'Project not found'
      );
    }

    req.membership = rows[0];

    next();

  }
);

// ==========================================
// OWNER AUTHORIZATION
// ==========================================

export const ownerOnly = (req, res, next) =>
  req.membership.role === 'owner'
    ? next()
    : next(
        new HttpError(
          403,
          'Only the project owner can do this'
        )
      );