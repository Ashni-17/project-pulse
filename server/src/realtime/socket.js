import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../config/db.js';

let io;
const room = (projectId) => `project:${projectId}`;

export function initSocket(httpServer) {
  io = new Server(httpServer, { cors: { origin: env.clientUrl } });

  // Every socket must present a valid JWT, exactly like the REST API.
  io.use(async (socket, next) => {
    try {
      const payload = jwt.verify(socket.handshake.auth?.token || '', env.jwtSecret);
      const { rows } = await query('SELECT id, name FROM users WHERE id=$1', [payload.sub]);
      if (!rows[0]) throw new Error('Unknown user');
      socket.data.user = rows[0];
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    // Membership is re-checked in the database before a socket may join a project room.
    socket.on('project:join', async (projectId) => {
      try {
        const { rows } = await query('SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2', [projectId, socket.data.user.id]);
        if (!rows[0]) return socket.emit('project:denied', { projectId });
        await socket.join(room(projectId));
        await broadcastPresence(projectId);
      } catch { /* malformed id: ignore */ }
    });

    socket.on('project:leave', async (projectId) => {
      await socket.leave(room(projectId));
      await broadcastPresence(projectId);
    });

    socket.on('disconnecting', () => {
      const ids = [...socket.rooms].filter((r) => r.startsWith('project:')).map((r) => r.slice('project:'.length));
      setTimeout(() => ids.forEach(broadcastPresence), 50);
    });
  });

  return io;
}

export function emitToProject(projectId, event, payload) {
  io?.to(room(projectId)).emit(event, payload);
}

async function broadcastPresence(projectId) {
  if (!io) return;
  const sockets = await io.in(room(projectId)).fetchSockets();
  const users = [...new Map(sockets.map((s) => [s.data.user.id, s.data.user])).values()];
  io.to(room(projectId)).emit('presence', { projectId, users });
}

/** Removes a user's live connections from a project after their membership is revoked. */
export async function evictUser(projectId, userId) {
  if (!io) return;
  const sockets = await io.in(room(projectId)).fetchSockets();
  sockets.filter((s) => s.data.user.id === userId).forEach((s) => s.leave(room(projectId)));
  await broadcastPresence(projectId);
}

export function closeProjectRoom(projectId) {
  io?.in(room(projectId)).socketsLeave(room(projectId));
}
