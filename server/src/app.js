import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/error.js';
import authRouter from './routes/auth.js';
import dashboardRouter from './routes/dashboard.js';
import projectsRouter from './routes/projects.js';
import googleAuthRouter from './routes/googleAuth.js';
import passwordResetRouter from './routes/passwordReset.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.clientUrl }));
app.use(express.json({ limit: '100kb' }));

if (env.nodeEnv !== 'test') {
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false }));
}

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRouter);
app.use('/api/auth', googleAuthRouter);
app.use('/api/auth', passwordResetRouter);
app.use('/api/dashboard', requireAuth, dashboardRouter);
app.use('/api/projects', requireAuth, projectsRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
