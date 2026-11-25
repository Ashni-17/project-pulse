import 'dotenv/config';

export const env = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
};

for (const key of ['databaseUrl', 'jwtSecret']) {
  if (!env[key]) throw new Error(`Missing required environment variable for "${key}". Copy .env.example to .env.`);
}
