import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
} from 'vitest';

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { io as createClient } from 'socket.io-client';

process.env.NODE_ENV = 'test';

describe('Socket.IO real-time security', () => {
  let httpServer;
  let socketServer;
  let pool;
  let query;
  let env;
  let realtime;
  let serverUrl;

  const clients = new Set();

  const ownerId = randomUUID();
  const memberId = randomUUID();
  const outsiderId = randomUUID();
  const projectId = randomUUID();

  const runId = randomUUID();

  function createToken(userId, version = 0, expiresIn = '1h') {
    return jwt.sign(
      { tokenVersion: version },
      env.jwtSecret,
      {
        subject: userId,
        expiresIn,
        algorithm: 'HS256',
      }
    );
  }

  function waitForEvent(socket, event, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const handler = (data) => {
        clearTimeout(timer);
        resolve(data);
      };

      const timer = setTimeout(() => {
        socket.off(event, handler);
        reject(new Error(`Timed out waiting for ${event}`));
      }, timeout);

      socket.once(event, handler);
    });
  }

  function makeClient(token) {
    const socket = createClient(serverUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      autoConnect: false,
      forceNew: true,
    });

    clients.add(socket);

    return socket;
  }

  async function connectUser(userId, version = 0) {
    const socket = makeClient(
      createToken(userId, version)
    );

    const connected = waitForEvent(socket, 'connect');

    socket.connect();

    await connected;

    return socket;
  }

  async function joinProject(socket) {
    const presence = waitForEvent(socket, 'presence');

    socket.emit('project:join', projectId);

    return presence;
  }

  beforeAll(async () => {
    // Safety: never run these tests against the main database.
    if (
      !process.env.DATABASE_URL ||
      new URL(process.env.DATABASE_URL).pathname !==
        '/project_pulse_test'
    ) {
      throw new Error(
        'Socket tests must use project_pulse_test database'
      );
    }

    const db = await import('../src/config/db.js');

    pool = db.pool;
    query = db.query;

    const config = await import('../src/config/env.js');

    env = config.env;

    realtime = await import('../src/realtime/socket.js');

    // Create isolated test users.
    await query(
      `INSERT INTO users
        (id, name, email, password_hash, token_version)
       VALUES
        ($1, $2, $3, $4, 0),
        ($5, $6, $7, $8, 0),
        ($9, $10, $11, $12, 0)`,
      [
        ownerId,
        'Socket Owner',
        `owner.${runId}@test.dev`,
        'test-placeholder',

        memberId,
        'Socket Member',
        `member.${runId}@test.dev`,
        'test-placeholder',

        outsiderId,
        'Socket Outsider',
        `outsider.${runId}@test.dev`,
        'test-placeholder',
      ]
    );

    // Create an isolated test project.
    await query(
      `INSERT INTO projects
        (id, name, description, owner_id)
       VALUES ($1, $2, $3, $4)`,
      [
        projectId,
        'Socket Security Test',
        'Automated real-time tests',
        ownerId,
      ]
    );

    await query(
      `INSERT INTO project_members
        (project_id, user_id, role)
       VALUES
        ($1, $2, 'owner'),
        ($1, $3, 'member')`,
      [projectId, ownerId, memberId]
    );

    // Port 0 automatically selects an available port.
    httpServer = createServer();

    socketServer = realtime.initSocket(httpServer);

    await new Promise((resolve, reject) => {
      httpServer.once('error', reject);

      httpServer.listen(0, '127.0.0.1', resolve);
    });

    const address = httpServer.address();

    serverUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(() => {
    for (const socket of clients) {
      socket.removeAllListeners();
      socket.disconnect();
    }

    clients.clear();
  });

  afterAll(async () => {
    try {
      if (socketServer) {
        await new Promise((resolve) => {
          socketServer.close(resolve);
        });
      }

      if (query) {
        await query(
          'DELETE FROM projects WHERE id = $1',
          [projectId]
        );

        await query(
          'DELETE FROM users WHERE id = ANY($1::uuid[])',
          [[ownerId, memberId, outsiderId]]
        );
      }
    } finally {
      if (pool) {
        await pool.end();
      }
    }
  });

  // TEST 1
  it('accepts a valid JWT connection', async () => {
    const socket = await connectUser(ownerId);

    expect(socket.connected).toBe(true);
  });

  // TEST 2
  it('rejects an invalid JWT connection', async () => {
    const socket = makeClient('invalid-token');

    const rejected = waitForEvent(
      socket,
      'connect_error'
    );

    socket.connect();

    const error = await rejected;

    expect(error.message).toBe('Unauthorized');

    expect(socket.connected).toBe(false);
  });

  // TEST 3
  it('allows project members to join the room', async () => {
    const socket = await connectUser(memberId);

    const presence = await joinProject(socket);

    expect(presence.projectId).toBe(projectId);

    expect(
      presence.users.some(
        (user) => user.id === memberId
      )
    ).toBe(true);
  });

  // TEST 4
  it('rejects non-members from project rooms', async () => {
    const socket = await connectUser(outsiderId);

    const denied = waitForEvent(
      socket,
      'project:denied'
    );

    socket.emit('project:join', projectId);

    const response = await denied;

    expect(response.projectId).toBe(projectId);

    const roomSockets = await socketServer
      .in(`project:${projectId}`)
      .fetchSockets();

    expect(
      roomSockets.some(
        (item) => item.id === socket.id
      )
    ).toBe(false);
  });

  // TEST 5
  it('broadcasts task events to connected project members', async () => {
    const owner = await connectUser(ownerId);
    const member = await connectUser(memberId);

    await joinProject(owner);
    await joinProject(member);

    const task = {
      id: randomUUID(),
      project_id: projectId,
      title: 'Real-time test task',
      status: 'in_progress',
      priority: 'high',
    };

    const ownerEvent = waitForEvent(
      owner,
      'tasks:upsert'
    );

    const memberEvent = waitForEvent(
      member,
      'tasks:upsert'
    );

    realtime.emitToProject(
      projectId,
      'tasks:upsert',
      task
    );

    const results = await Promise.all([
      ownerEvent,
      memberEvent,
    ]);

    expect(results[0]).toEqual(task);
    expect(results[1]).toEqual(task);
  });

  // TEST 6
  it('evicts a removed project member', async () => {
    const member = await connectUser(memberId);

    await joinProject(member);

    try {
      await query(
        `DELETE FROM project_members
         WHERE project_id = $1 AND user_id = $2`,
        [projectId, memberId]
      );

      await realtime.evictUser(
        projectId,
        memberId
      );

      const roomSockets = await socketServer
        .in(`project:${projectId}`)
        .fetchSockets();

      expect(
        roomSockets.some(
          (item) => item.data.user.id === memberId
        )
      ).toBe(false);

      const denied = waitForEvent(
        member,
        'project:denied'
      );

      member.emit('project:join', projectId);

      expect(await denied).toEqual({
        projectId,
      });
    } finally {
      await query(
        `INSERT INTO project_members
          (project_id, user_id, role)
         VALUES ($1, $2, 'member')
         ON CONFLICT DO NOTHING`,
        [projectId, memberId]
      );
    }
  });

  // TEST 7
  it('invalidates all active sessions after token version changes', async () => {
    const first = await connectUser(ownerId);
    const second = await connectUser(ownerId);

    await joinProject(first);
    await joinProject(second);

    try {
      const firstWarning = waitForEvent(
        first,
        'session:invalidated'
      );

      const secondWarning = waitForEvent(
        second,
        'session:invalidated'
      );

      const firstDisconnect = waitForEvent(
        first,
        'disconnect'
      );

      const secondDisconnect = waitForEvent(
        second,
        'disconnect'
      );

      await query(
        `UPDATE users
         SET token_version = 1
         WHERE id = $1`,
        [ownerId]
      );

      await realtime.disconnectUserSessions(
        ownerId,
        1
      );

      const warnings = await Promise.all([
        firstWarning,
        secondWarning,
      ]);

      await Promise.all([
        firstDisconnect,
        secondDisconnect,
      ]);

      expect(warnings[0].message).toContain(
        'password has changed'
      );

      expect(warnings[1].message).toContain(
        'password has changed'
      );

      expect(first.connected).toBe(false);
      expect(second.connected).toBe(false);

      // Old token must not reconnect.
      const oldSocket = makeClient(
        createToken(ownerId, 0)
      );

      const rejected = waitForEvent(
        oldSocket,
        'connect_error'
      );

      oldSocket.connect();

      expect((await rejected).message).toBe(
        'Unauthorized'
      );

      // New token must connect successfully.
      const newSocket = await connectUser(
        ownerId,
        1
      );

      expect(newSocket.connected).toBe(true);
    } finally {
      await query(
        `UPDATE users
         SET token_version = 0
         WHERE id = $1`,
        [ownerId]
      );
    }
  });

  // TEST 8
  it('disconnects an active session when its JWT expires', async () => {
    const socket = makeClient(
      createToken(ownerId, 0, '3s')
    );

    const connected = waitForEvent(
      socket,
      'connect'
    );

    const invalidated = waitForEvent(
      socket,
      'session:invalidated',
      8000
    );

    const disconnected = waitForEvent(
      socket,
      'disconnect',
      8000
    );

    socket.connect();

    await connected;

    const warning = await invalidated;

    await disconnected;

    expect(warning.message).toContain(
      'session has expired'
    );

    expect(socket.connected).toBe(false);
  });
});