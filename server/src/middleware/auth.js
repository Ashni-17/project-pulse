import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../config/db.js';
import { HttpError, asyncHandler } from '../utils/errors.js';

/** Verifies the bearer token and attaches the current user to the request. */
export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Please sign in to continue');

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new HttpError(401, 'Your session has expired. Please sign in again');
  }
  const { rows } = await query('SELECT id, name, email FROM users WHERE id=$1', [payload.sub]);
  if (!rows[0]) throw new HttpError(401, 'Account no longer exists');
  req.user = rows[0];
  next();
});

/**
 * Loads the caller's membership for :projectId. Non-members get a 404 (not 403)
 * so the existence of other teams' projects is never revealed.
 */
export const projectAccess = asyncHandler(async (req, res, next) => {
  const { rows } = await query('SELECT role FROM project_members WHERE project_id=$1 AND user_id=$2', [req.params.projectId, req.user.id]);
  if (!rows[0]) throw new HttpError(404, 'Project not found');
  req.membership = rows[0];
  next();
});

export const ownerOnly = (req, res, next) =>
  req.membership.role === 'owner' ? next() : next(new HttpError(403, 'Only the project owner can do this'));
