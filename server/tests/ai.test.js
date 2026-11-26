import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest';

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

// ==========================================
// MOCK AI SERVICES
// ==========================================

const aiMocks = vi.hoisted(() => ({
  generateTasks: vi.fn(),
  summarizeProject: vi.fn(),
  recommendAssignee: vi.fn(),
  askProjectAI: vi.fn(),
}));

vi.mock('../src/services/ai.js', () => aiMocks);

process.env.JWT_SECRET ||= 'test-secret';
process.env.NODE_ENV = 'test';

// ==========================================
// AI INTEGRATION TESTS
// ==========================================

describe.skipIf(!process.env.DATABASE_URL)(
  'Project Pulse AI Security',
  () => {

    let app;
    let pool;
    let secret;

    const ownerId = randomUUID();
    const memberId = randomUUID();
    const outsiderId = randomUUID();

    const projectId = randomUUID();
    const otherProjectId = randomUUID();

    const taskId = randomUUID();
    const completedTaskId = randomUUID();
    const otherTaskId = randomUUID();

    const run = randomUUID();

    const endpoint = `/api/projects/${projectId}/ai`;

    function auth(userId, tokenVersion = 0) {

      const token = jwt.sign(
        { tokenVersion },
        secret,
        {
          subject: userId,
          algorithm: 'HS256',
          expiresIn: '1h',
        }
      );

      return {
        Authorization: `Bearer ${token}`,
      };
    }

    // ==========================================
    // DATABASE SNAPSHOT
    // ==========================================

    async function getSnapshot() {

      const tasks = await pool.query(
        `SELECT *
         FROM tasks
         WHERE project_id = $1
         ORDER BY id`,
        [projectId]
      );

      const activities = await pool.query(
        `SELECT *
         FROM activities
         WHERE project_id = $1
         ORDER BY id`,
        [projectId]
      );

      return {
        tasks: tasks.rows,
        activities: activities.rows,
      };
    }

    // ==========================================
    // TEST SETUP
    // ==========================================

    beforeAll(async () => {

      const databaseUrl = new URL(
        process.env.DATABASE_URL
      );

      if (
        databaseUrl.pathname !== '/project_pulse_test'
      ) {
        throw new Error(
          'Safety check failed: AI tests must use project_pulse_test database'
        );
      }

      app = (await import('../src/app.js')).default;

      pool = (
        await import('../src/config/db.js')
      ).pool;

      secret = (
        await import('../src/config/env.js')
      ).env.jwtSecret;

      // Create isolated test users.

      for (const [id, name] of [
        [ownerId, 'AI Owner'],
        [memberId, 'AI Member'],
        [outsiderId, 'AI Outsider'],
      ]) {

        await pool.query(
          `INSERT INTO users
           (id, name, email, password_hash,
            email_verified_at, token_version)
           VALUES ($1, $2, $3, NULL, NOW(), 0)`,
          [
            id,
            name,
            `${id}.${run}@test.dev`,
          ]
        );
      }

      // Create two isolated projects.

      await pool.query(
        `INSERT INTO projects
         (id, name, description, owner_id)
         VALUES ($1, $2, $3, $4)`,
        [
          projectId,
          'AI Security Test Project',
          'Testing AI permissions',
          ownerId,
        ]
      );

      await pool.query(
        `INSERT INTO projects
         (id, name, description, owner_id)
         VALUES ($1, $2, $3, $4)`,
        [
          otherProjectId,
          'Private Project',
          'Cross-project isolation test',
          outsiderId,
        ]
      );

      // Add project memberships.

      await pool.query(
        `INSERT INTO project_members
         (project_id, user_id, role)
         VALUES
         ($1, $2, 'owner'),
         ($1, $3, 'member'),
         ($4, $5, 'owner')`,
        [
          projectId,
          ownerId,
          memberId,
          otherProjectId,
          outsiderId,
        ]
      );

      // Create test tasks.

      await pool.query(
        `INSERT INTO tasks
         (id, project_id, title, description,
          status, priority, assignee_id,
          position, created_by)
         VALUES
         ($1, $2, 'Develop Login Page', '',
          'todo', 'medium', $3, 0, $4),

         ($5, $2, 'Completed Task', '',
          'done', 'low', $4, 0, $4),

         ($6, $7, 'Private Task', '',
          'todo', 'high', $8, 0, $8)`,
        [
          taskId,
          projectId,
          memberId,
          ownerId,
          completedTaskId,
          otherTaskId,
          otherProjectId,
          outsiderId,
        ]
      );

    });

    // ==========================================
    // RESET MOCKS BEFORE EACH TEST
    // ==========================================

    beforeEach(() => {

      vi.resetAllMocks();

      aiMocks.generateTasks.mockResolvedValue({
        overview: 'One suggestion ready for review.',
        tasks: [
          {
            title: 'Write API documentation',
            description: 'Document the endpoints',
            priority: 'medium',
            dueDate: null,
            assigneeId: memberId,
          },
        ],
        duplicatesSkipped: 0,
      });

      aiMocks.summarizeProject.mockResolvedValue({
        summary: 'Project progress summary.',
        achievements: [],
        risks: [],
        recommendations: [],
        prioritySuggestions: [],
      });

      aiMocks.recommendAssignee.mockResolvedValue({
        recommendedMemberId: ownerId,
        recommendedMemberName: 'AI Owner',
        reason: 'Workload recommendation.',
      });

      aiMocks.askProjectAI.mockResolvedValue({
        answer: 'One active task is available.',
        relatedTaskIds: [taskId],
        suggestedActions: [],
      });

    });

    // ==========================================
    // TEST 1: UNAUTHENTICATED ACCESS
    // ==========================================

    it('rejects unauthenticated AI requests', async () => {

      const response = await request(app)
        .post(`${endpoint}/intelligence`)
        .send({});

      expect(response.status).toBe(401);

      expect(
        aiMocks.summarizeProject
      ).not.toHaveBeenCalled();

    });

    // ==========================================
    // TEST 2: INVALID JWT
    // ==========================================

    it('rejects invalid JWT tokens', async () => {

      const response = await request(app)
        .post(`${endpoint}/intelligence`)
        .set('Authorization', 'Bearer invalid-token')
        .send({});

      expect(response.status).toBe(401);

      expect(
        aiMocks.summarizeProject
      ).not.toHaveBeenCalled();

    });

    // ==========================================
    // TEST 3: NON-MEMBER ACCESS
    // ==========================================

    it('blocks non-members from project AI', async () => {

      const response = await request(app)
        .post(`${endpoint}/intelligence`)
        .set(auth(outsiderId))
        .send({});

      expect(response.status).toBe(404);

      expect(
        aiMocks.summarizeProject
      ).not.toHaveBeenCalled();

    });

    // ==========================================
    // TEST 4: INVALID PLANNING MODE
    // ==========================================

    it('rejects invalid planning modes', async () => {

      const response = await request(app)
        .post(`${endpoint}/plan`)
        .set(auth(ownerId))
        .send({
          mode: 'invalid',
          prompt: 'Generate project tasks',
        });

      expect(response.status).toBe(400);

      expect(
        aiMocks.generateTasks
      ).not.toHaveBeenCalled();

    });

    // ==========================================
    // TEST 5: EMPTY PROMPT
    // ==========================================

    it('rejects empty AI prompts', async () => {

      const response = await request(app)
        .post(`${endpoint}/plan`)
        .set(auth(ownerId))
        .send({
          mode: 'natural',
          prompt: '',
        });

      expect(response.status).toBe(400);

      expect(
        aiMocks.generateTasks
      ).not.toHaveBeenCalled();

    });

    // ==========================================
    // TEST 6: CROSS-PROJECT TASK ISOLATION
    // ==========================================

    it('rejects tasks belonging to another project', async () => {

      const response = await request(app)
        .post(`${endpoint}/assign`)
        .set(auth(ownerId))
        .send({
          taskId: otherTaskId,
        });

      expect(response.status).toBe(404);

      expect(
        aiMocks.recommendAssignee
      ).not.toHaveBeenCalled();

    });

    // ==========================================
    // TEST 7: COMPLETED TASK ASSIGNMENT
    // ==========================================

    it('rejects assignment requests for completed tasks', async () => {

      const response = await request(app)
        .post(`${endpoint}/assign`)
        .set(auth(ownerId))
        .send({
          taskId: completedTaskId,
        });

      expect(response.status).toBe(400);

      expect(
        aiMocks.recommendAssignee
      ).not.toHaveBeenCalled();

    });

    // ==========================================
    // TEST 8: VALID MEMBER ACCESS
    // ==========================================

    it('allows authorized project members to use AI', async () => {

      const response = await request(app)
        .post(`${endpoint}/intelligence`)
        .set(auth(memberId))
        .send({});

      expect(response.status).toBe(200);

      expect(response.body.summary).toBe(
        'Project progress summary.'
      );

      expect(
        aiMocks.summarizeProject
      ).toHaveBeenCalledTimes(1);

    });

    // ==========================================
    // TEST 9: SESSION INVALIDATION
    // ==========================================

    it('rejects AI results if the session becomes invalid during generation', async () => {

      aiMocks.summarizeProject.mockImplementationOnce(
        async () => {

          // Simulate password-reset session invalidation.

          await pool.query(
            `UPDATE users
             SET token_version = token_version + 1
             WHERE id = $1`,
            [ownerId]
          );

          return {
            summary: 'This result must not be returned.',
          };

        }
      );

      try {

        const response = await request(app)
          .post(`${endpoint}/intelligence`)
          .set(auth(ownerId))
          .send({});

        expect(
          aiMocks.summarizeProject
        ).toHaveBeenCalledTimes(1);

        expect(response.status).toBe(401);

        expect(response.body).not.toHaveProperty(
          'summary'
        );

      } finally {

        await pool.query(
          `UPDATE users
           SET token_version = 0
           WHERE id = $1`,
          [ownerId]
        );

      }

    });

    // ==========================================
    // TEST 10: MEMBERSHIP REVOCATION
    // ==========================================

    it('rejects AI results if membership is removed during generation', async () => {

      aiMocks.summarizeProject.mockImplementationOnce(
        async () => {

          await pool.query(
            `DELETE FROM project_members
             WHERE project_id = $1
               AND user_id = $2`,
            [projectId, memberId]
          );

          return {
            summary: 'Private project information.',
          };

        }
      );

      try {

        const response = await request(app)
          .post(`${endpoint}/intelligence`)
          .set(auth(memberId))
          .send({});

        expect(
          aiMocks.summarizeProject
        ).toHaveBeenCalledTimes(1);

        expect(response.status).toBe(404);

        expect(response.body).not.toHaveProperty(
          'summary'
        );

      } finally {

        await pool.query(
          `INSERT INTO project_members
           (project_id, user_id, role)
           VALUES ($1, $2, 'member')
           ON CONFLICT DO NOTHING`,
          [projectId, memberId]
        );

      }

    });

    // ==========================================
    // TEST 11: PLANNER MUST NOT SAVE TASKS
    // ==========================================

    it('generates suggestions without creating tasks or activities', async () => {

      const before = await getSnapshot();

      const response = await request(app)
        .post(`${endpoint}/plan`)
        .set(auth(ownerId))
        .send({
          mode: 'natural',
          prompt: 'Create API documentation tasks',
        });

      expect(response.status).toBe(200);

      expect(response.body.tasks).toHaveLength(1);

      const after = await getSnapshot();

      expect(after).toEqual(before);

    });

    // ==========================================
    // TEST 12: NO AUTOMATIC REASSIGNMENT
    // ==========================================

    it('recommends an assignee without modifying tasks or activities', async () => {

      const before = await getSnapshot();

      const response = await request(app)
        .post(`${endpoint}/assign`)
        .set(auth(ownerId))
        .send({ taskId });

      expect(response.status).toBe(200);

      expect(
        response.body.recommendedMemberId
      ).toBe(ownerId);

      const after = await getSnapshot();

      expect(after).toEqual(before);

    });

    // ==========================================
    // TEST 13: ASK AI IS READ-ONLY
    // ==========================================

    it('answers project questions without modifying tasks or activities', async () => {

      const before = await getSnapshot();

      const response = await request(app)
        .post(`${endpoint}/ask`)
        .set(auth(memberId))
        .send({
          question: 'What tasks are pending?',
        });

      expect(response.status).toBe(200);

      expect(response.body.answer).toBeTruthy();

      const after = await getSnapshot();

      expect(after).toEqual(before);

    });

    // ==========================================
    // TEST CLEANUP
    // ==========================================

    afterAll(async () => {

      if (!pool) return;

      try {

        await pool.query(
          `DELETE FROM projects
           WHERE id = ANY($1::uuid[])`,
          [[projectId, otherProjectId]]
        );

        await pool.query(
          `DELETE FROM users
           WHERE id = ANY($1::uuid[])`,
          [[ownerId, memberId, outsiderId]]
        );

      } finally {

        await pool.end();

      }

    });

  }
);