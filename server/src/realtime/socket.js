
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../config/db.js';

let io;

const room = (projectId) => `project:${projectId}`;
const userRoom = (userId) => `user:${userId}`;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.clientUrl },
  });

  // Authenticate every new socket connection
  io.use(async (socket, next) => {
    try {
      const payload = jwt.verify(
        socket.handshake.auth?.token || '',
        env.jwtSecret,
        { algorithms: ['HS256'] }
      );

      // Require a valid token expiration
      if (
        typeof payload.exp !== 'number' ||
        payload.exp * 1000 <= Date.now()
      ) {
        throw new Error('Invalid token expiration');
      }

      const { rows: [user] } = await query(
        `SELECT id, name, token_version
         FROM users
         WHERE id = $1`,
        [payload.sub]
      );

      if (!user) {
        throw new Error('Unknown user');
      }

      const tokenVersion = payload.tokenVersion ?? 0;

      if (tokenVersion !== user.token_version) {
        throw new Error('Session is no longer valid');
      }

      socket.data.user = {
        id: user.id,
        name: user.name,
      };

      socket.data.tokenVersion = tokenVersion;
      socket.data.expiresAt = payload.exp * 1000;

      next();

    } catch {
      next(new Error('Unauthorized'));
    }
  });

  // Register event listeners immediately
  io.on('connection', (socket) => {

    let expiryTimer;

    // Disconnect expired sessions automatically
    const scheduleExpiry = () => {
      if (!socket.connected) return;

      const remaining =
        socket.data.expiresAt - Date.now();

      if (remaining <= 0) {
        socket.emit('session:invalidated', {
          message:
            'Your session has expired. Please sign in again.',
        });

        socket.disconnect(true);
        return;
      }

      // Avoid exceeding Node.js timer limits
      expiryTimer = setTimeout(
        scheduleExpiry,
        Math.min(remaining, 2147483647)
      );

      expiryTimer.unref?.();
    };

    // Initialize and verify the session
    const sessionReady = (async () => {
      try {
        await socket.join(
          userRoom(socket.data.user.id)
        );

        const { rows: [user] } = await query(
          'SELECT token_version FROM users WHERE id = $1',
          [socket.data.user.id]
        );

        if (
          !user ||
          user.token_version !== socket.data.tokenVersion ||
          Date.now() >= socket.data.expiresAt
        ) {
          socket.disconnect(true);
          return false;
        }

        return socket.connected;

      } catch {
        socket.disconnect(true);
        return false;
      }
    })();

    // Verify session and membership before joining projects
    socket.on('project:join', async (projectId) => {
      try {
        if (!(await sessionReady) || !socket.connected) {
          return;
        }

        // Reject expired sessions
        if (Date.now() >= socket.data.expiresAt) {
          socket.emit('session:invalidated', {
            message:
              'Your session has expired. Please sign in again.',
          });

          socket.disconnect(true);
          return;
        }

        const { rows: [user] } = await query(
          `SELECT token_version
           FROM users
           WHERE id = $1`,
          [socket.data.user.id]
        );

        if (
          !user ||
          user.token_version !== socket.data.tokenVersion
        ) {
          socket.disconnect(true);
          return;
        }

        const { rows } = await query(
          `SELECT 1
           FROM project_members
           WHERE project_id = $1
             AND user_id = $2`,
          [projectId, socket.data.user.id]
        );

        if (!rows[0]) {
          return socket.emit('project:denied', {
            projectId,
          });
        }

        if (!socket.connected) return;

        if (Date.now() >= socket.data.expiresAt) {
          socket.disconnect(true);
          return;
        }

        await socket.join(room(projectId));
        await broadcastPresence(projectId);

      } catch {
        // Ignore malformed project IDs
      }
    });

    // Leave project room
    socket.on('project:leave', async (projectId) => {
      try {
        await socket.leave(room(projectId));
        await broadcastPresence(projectId);
      } catch (error) {
        console.error('Project leave failed:', error);
      }
    });

    // Update presence when a user disconnects
    socket.on('disconnecting', () => {
      const ids = [...socket.rooms]
        .filter((r) => r.startsWith('project:'))
        .map((r) => r.slice('project:'.length));

      setTimeout(() => {
        ids.forEach((id) => {
          broadcastPresence(id).catch(console.error);
        });
      }, 50);
    });

    // Clean up expiry timer
    socket.on('disconnect', () => {
      if (expiryTimer) {
        clearTimeout(expiryTimer);
      }
    });

    // Start automatic session expiry
    scheduleExpiry();
  });

  return io;
}

// Broadcast real-time project updates
export function emitToProject(projectId, event, payload) {
  io?.to(room(projectId)).emit(event, payload);
}

// Broadcast online member presence
async function broadcastPresence(projectId) {
  if (!io) return;

  const sockets = await io
    .in(room(projectId))
    .fetchSockets();

  const users = [
    ...new Map(
      sockets.map((s) => [
        s.data.user.id,
        s.data.user,
      ])
    ).values(),
  ];

  io.to(room(projectId)).emit('presence', {
    projectId,
    users,
  });
}

// Remove a user after project membership is revoked
export async function evictUser(projectId, userId) {
  if (!io) return;

  const sockets = await io
    .in(room(projectId))
    .fetchSockets();

  await Promise.all(
    sockets
      .filter((s) => s.data.user.id === userId)
      .map((s) => s.leave(room(projectId)))
  );

  await broadcastPresence(projectId);
}

// Close a deleted project's room
export function closeProjectRoom(projectId) {
  io?.in(room(projectId))
    .socketsLeave(room(projectId));
}

// Disconnect invalidated sessions after password reset
export async function disconnectUserSessions(
  userId,
  currentTokenVersion
) {
  if (!io) return;

  const sockets = await io
    .in(userRoom(userId))
    .fetchSockets();

  for (const socket of sockets) {
    if (
      socket.data.tokenVersion !== currentTokenVersion
    ) {
      socket.emit('session:invalidated', {
        message:
          'Your password has changed. Please sign in again.',
      });

      socket.disconnect(true);
    }
  }
}
