import { createServer } from 'node:http';
import app from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { initSocket } from './realtime/socket.js';

const server = createServer(app);
initSocket(server);

server.listen(env.port, () => console.log(`Project Pulse API listening on http://localhost:${env.port}`));

const shutdown = () => server.close(async () => { await pool.end(); process.exit(0); });
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
