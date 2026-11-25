import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError, asyncHandler } from '../utils/errors.js';
import { parse, registerSchema, loginSchema } from '../utils/validation.js';

const router = Router();
const signToken = (userId) => jwt.sign({}, env.jwtSecret, { subject: userId, expiresIn: '7d' });
const publicUser = ({ id, name, email }) => ({ id, name, email });

router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, password } = parse(registerSchema, req.body);
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const { rows: [user] } = await query(
      'INSERT INTO users(name, email, password_hash) VALUES($1,$2,$3) RETURNING id, name, email', [name, email, passwordHash]);
    res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
  } catch (err) {
    if (err.code === '23505') throw new HttpError(409, 'An account with this email already exists', { email: ['Already registered'] });
    throw err;
  }
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const { rows: [user] } = await query('SELECT * FROM users WHERE email=$1', [email]);
  // Same message for unknown email and wrong password to avoid account enumeration.
  const valid = user && (await bcrypt.compare(password, user.password_hash));
  if (!valid) throw new HttpError(401, 'Email or password is incorrect');
  res.json({ token: signToken(user.id), user: publicUser(user) });
}));

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

export default router;
