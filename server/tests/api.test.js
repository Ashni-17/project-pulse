// Integration test of the spec's Alice/Bob workflow. Requires DATABASE_URL (run `npm run migrate` first).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';

const { verificationCodes, resetCodes } = vi.hoisted(() => ({
  verificationCodes: new Map(),
  resetCodes: new Map(),
}));

vi.mock('../src/services/email.js', () => ({
  verifyEmailConnection: vi.fn(async () => true),

  sendVerificationEmail: vi.fn(async (email, otp) => {
    verificationCodes.set(email, otp);
  }),

  sendPasswordResetEmail: vi.fn(async (email, otp) => {
    resetCodes.set(email, otp);
  }),
}));

process.env.JWT_SECRET ||= 'test-secret';
process.env.NODE_ENV = 'test';

describe.skipIf(!process.env.DATABASE_URL)('Project Pulse API', () => {
  let app, pool;
  const run = Date.now();
  const users = {};
  const auth = (who) => ({ Authorization: `Bearer ${users[who].token}` });
  let projectId, taskId;

  beforeAll(async () => {
  const databaseUrl = new URL(process.env.DATABASE_URL);

  if (databaseUrl.pathname !== '/project_pulse_test') {
    throw new Error(
      'Safety check failed: Tests must use project_pulse_test database'
    );
  }

  app = (await import('../src/app.js')).default;
  pool = (await import('../src/config/db.js')).pool;

  for (const name of ['alice', 'bob', 'eve']) {
    const email = `${name}.${run}@test.dev`;
    const password = 'Secret123';

    // Step 1: Register
    const registration = await request(app)
      .post('/api/auth/register')
      .send({
        name: `${name} tester`,
        email,
        password,
        confirmPassword: password,
      });

    expect(registration.status).toBe(202);
    expect(registration.body.registrationId).toBeTruthy();

    // Step 2: Retrieve generated OTP from mocked email
    const otp = verificationCodes.get(email);

    expect(otp).toMatch(/^\d{6}$/);

    // Step 3: Verify email OTP
    const verification = await request(app)
      .post('/api/auth/verify-otp')
      .send({
        registrationId: registration.body.registrationId,
        otp,
      });

    expect(verification.status).toBe(201);

    // Step 4: Login
    const login = await request(app)
      .post('/api/auth/login')
      .send({
        email,
        password,
      });

    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();

    users[name] = {
      ...login.body.user,
      token: login.body.token,
    };
  }
});

  afterAll(async () => {
  try {
    if (pool) {
      await pool.query(
        'DELETE FROM pending_registrations WHERE email LIKE $1',
        [`%.${run}@test.dev`]
      );

      await pool.query(
        'DELETE FROM users WHERE email LIKE $1',
        [`%.${run}@test.dev`]
      );
    }
  } finally {
    verificationCodes.clear();
    resetCodes.clear();

    if (pool) {
      await pool.end();
    }
  }
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
  it('requires email verification before login and prevents OTP reuse', async () => {
  const email = `verification.${run}@test.dev`;
  const password = 'Secret123';

  const registration = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Verification Tester',
      email,
      password,
      confirmPassword: password,
    });

  expect(registration.status).toBe(202);
  expect(registration.body.registrationId).toBeTruthy();

  const registrationId = registration.body.registrationId;
  const otp = verificationCodes.get(email);

  expect(otp).toMatch(/^\d{6}$/);

  // Login before email verification must fail
  const beforeVerification = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  expect(beforeVerification.status).toBe(401);

  // Incorrect OTP must fail
  const wrongOtp = otp === '000000' ? '111111' : '000000';

  const invalid = await request(app)
    .post('/api/auth/verify-otp')
    .send({ registrationId, otp: wrongOtp });

  expect(invalid.status).toBe(400);

  // Correct OTP must succeed
  const verified = await request(app)
    .post('/api/auth/verify-otp')
    .send({ registrationId, otp });

  expect(verified.status).toBe(201);

  // Reusing the same OTP must fail
  const reused = await request(app)
    .post('/api/auth/verify-otp')
    .send({ registrationId, otp });

  expect(reused.status).toBe(404);

  // Login after verification must succeed
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  expect(login.status).toBe(200);
  expect(login.body.token).toBeTruthy();
});

it('resets passwords securely and invalidates previous sessions', async () => {
  const email = `recovery.${run}@test.dev`;
  const oldPassword = 'Secret123';
  const newPassword = 'UpdatedSecret456';

  // 1. Register a new test user
  const registration = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Recovery Tester',
      email,
      password: oldPassword,
      confirmPassword: oldPassword,
    });

  expect(registration.status).toBe(202);

  // 2. Verify registration OTP
  const verified = await request(app)
    .post('/api/auth/verify-otp')
    .send({
      registrationId: registration.body.registrationId,
      otp: verificationCodes.get(email),
    });

  expect(verified.status).toBe(201);

  // 3. Login and capture old JWT
  const oldLogin = await request(app)
    .post('/api/auth/login')
    .send({ email, password: oldPassword });

  expect(oldLogin.status).toBe(200);

  const oldToken = oldLogin.body.token;

  // 4. Confirm old session is valid
  const oldSession = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${oldToken}`);

  expect(oldSession.status).toBe(200);

  // 5. Request password reset OTP
  const forgot = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email });

  expect(forgot.status).toBe(202);

  const otp = resetCodes.get(email);

  expect(otp).toMatch(/^\d{6}$/);

  // 6. Reject incorrect OTP
  const wrongOtp = otp === '000000' ? '111111' : '000000';

  const invalid = await request(app)
    .post('/api/auth/verify-reset-otp')
    .send({ email, otp: wrongOtp });

  expect(invalid.status).toBe(400);

  // 7. Verify correct OTP
  const verification = await request(app)
    .post('/api/auth/verify-reset-otp')
    .send({ email, otp });

  expect(verification.status).toBe(200);
  expect(verification.body.resetToken).toBeTruthy();

  const resetToken = verification.body.resetToken;

  // 8. Reject mismatched passwords
  const mismatch = await request(app)
    .post('/api/auth/reset-password')
    .send({
      resetToken,
      password: newPassword,
      confirmPassword: 'DifferentPassword123',
    });

  expect(mismatch.status).toBe(400);

  // 9. Reset password successfully
  const resetBody = {
    resetToken,
    password: newPassword,
    confirmPassword: newPassword,
  };

  const reset = await request(app)
    .post('/api/auth/reset-password')
    .send(resetBody);

  expect(reset.status).toBe(200);

  // 10. Prevent reset token reuse
  const reused = await request(app)
    .post('/api/auth/reset-password')
    .send(resetBody);

  expect(reused.status).toBe(400);

  // 11. Reject old JWT
  const expiredSession = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${oldToken}`);

  expect(expiredSession.status).toBe(401);

  // 12. Reject old password
  const rejectedLogin = await request(app)
    .post('/api/auth/login')
    .send({ email, password: oldPassword });

  expect(rejectedLogin.status).toBe(401);

  // 13. Login using new password
  const newLogin = await request(app)
    .post('/api/auth/login')
    .send({ email, password: newPassword });

  expect(newLogin.status).toBe(200);
  expect(newLogin.body.token).toBeTruthy();

  // 14. Verify new session
  const newSession = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${newLogin.body.token}`);

  expect(newSession.status).toBe(200);
  expect(newSession.body.user.email).toBe(email);
});


});
