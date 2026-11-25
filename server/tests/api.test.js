// Integration test of the spec's Alice/Bob workflow. Requires DATABASE_URL (run `npm run migrate` first).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

process.env.JWT_SECRET ||= 'test-secret';
process.env.NODE_ENV = 'test';

describe.skipIf(!process.env.DATABASE_URL)('Project Pulse API', () => {
  let app, pool;
  const run = Date.now();
  const users = {};
  const auth = (who) => ({ Authorization: `Bearer ${users[who].token}` });
  let projectId, taskId;

  beforeAll(async () => {
    app = (await import('../src/app.js')).default;
    pool = (await import('../src/config/db.js')).pool;
    for (const name of ['alice', 'bob', 'eve']) {
      const res = await request(app).post('/api/auth/register').send({ name: `${name} tester`, email: `${name}.${run}@test.dev`, password: 'Secret123' });
      expect(res.status).toBe(201);
      users[name] = { ...res.body.user, token: res.body.token };
    }
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`%.${run}@test.dev`]);
    await pool.end();
  });

  it('rejects unauthenticated access and invalid registration input', async () => {
    expect((await request(app).get('/api/projects')).status).toBe(401);
    const bad = await request(app).post('/api/auth/register').send({ name: 'x', email: 'nope', password: '123' });
    expect(bad.status).toBe(400);
    expect(bad.body.details).toHaveProperty('email');
  });

  it('rejects wrong passwords', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: `alice.${run}@test.dev`, password: 'WrongPass1' });
    expect(res.status).toBe(401);
  });

  it('lets Alice create a project and add Bob, but hides it from Eve', async () => {
    const created = await request(app).post('/api/projects').set(auth('alice')).send({ name: 'Product Launch' });
    expect(created.status).toBe(201);
    projectId = created.body.project.id;

    const added = await request(app).post(`/api/projects/${projectId}/members`).set(auth('alice')).send({ email: `bob.${run}@test.dev` });
    expect(added.status).toBe(201);

    expect((await request(app).get(`/api/projects/${projectId}`).set(auth('eve'))).status).toBe(404);
    expect((await request(app).get(`/api/projects/${projectId}/tasks`).set(auth('eve'))).status).toBe(404);
  });

  it('only allows the owner to manage members and the project', async () => {
    const res = await request(app).post(`/api/projects/${projectId}/members`).set(auth('bob')).send({ email: `eve.${run}@test.dev` });
    expect(res.status).toBe(403);
    expect((await request(app).delete(`/api/projects/${projectId}`).set(auth('bob'))).status).toBe(403);
  });

  it('creates a task, validates assignees, and records activity', async () => {
    const task = await request(app).post(`/api/projects/${projectId}/tasks`).set(auth('alice'))
      .send({ title: 'Develop Landing Page', priority: 'high', assigneeId: users.bob.id });
    expect(task.status).toBe(201);
    taskId = task.body.task.id;
    expect(task.body.task).toMatchObject({ status: 'todo', priority: 'high', assignee_name: 'bob tester' });

    const outsider = await request(app).post(`/api/projects/${projectId}/tasks`).set(auth('alice')).send({ title: 'Nope', assigneeId: users.eve.id });
    expect(outsider.status).toBe(400);
    expect((await request(app).post(`/api/projects/${projectId}/tasks`).set(auth('alice')).send({ title: '' })).status).toBe(400);

    const activity = await request(app).get(`/api/projects/${projectId}/activity`).set(auth('bob'));
    expect(activity.body.activities.map((a) => a.action)).toEqual(expect.arrayContaining(['task.created', 'task.assigned']));
  });

  it('persists drag-and-drop moves and rejects invalid statuses', async () => {
    const moved = await request(app).patch(`/api/projects/${projectId}/tasks/${taskId}/move`).set(auth('alice')).send({ status: 'in_progress', index: 0 });
    expect(moved.status).toBe(200);
    const list = await request(app).get(`/api/projects/${projectId}/tasks`).set(auth('bob'));
    expect(list.body.tasks[0].status).toBe('in_progress');
    expect((await request(app).patch(`/api/projects/${projectId}/tasks/${taskId}/move`).set(auth('alice')).send({ status: 'blocked', index: 0 })).status).toBe(400);
  });

  it('supports comments and keeps the dashboard in sync', async () => {
    const comment = await request(app).post(`/api/projects/${projectId}/tasks/${taskId}/comments`).set(auth('bob')).send({ body: 'On it!' });
    expect(comment.status).toBe(201);
    expect(comment.body.comment.user_name).toBe('bob tester');

    await request(app).patch(`/api/projects/${projectId}/tasks/${taskId}/move`).set(auth('bob')).send({ status: 'done', index: 0 });
    const stats = await request(app).get(`/api/projects/${projectId}/stats`).set(auth('alice'));
    expect(stats.body).toMatchObject({ total: 1, completed: 1, completionRate: 100, overdue: 0 });
  });

  it('filters tasks by search, status and assignee', async () => {
    const q = (qs) => request(app).get(`/api/projects/${projectId}/tasks?${qs}`).set(auth('alice'));
    expect((await q('search=landing')).body.tasks).toHaveLength(1);
    expect((await q('search=zzz')).body.tasks).toHaveLength(0);
    expect((await q('status=todo')).body.tasks).toHaveLength(0);
    expect((await q(`assignee=${users.bob.id}`)).body.tasks).toHaveLength(1);
  });
});
