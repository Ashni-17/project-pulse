import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { query } from '../config/db.js';
import { env } from '../config/env.js';
import { HttpError, asyncHandler } from '../utils/errors.js';
import { validateSession } from '../middleware/auth.js';

import {
  parse,
  aiPlannerSchema,
  aiIntelligenceSchema,
  aiAssignmentSchema,
  aiQuestionSchema,
} from '../utils/validation.js';

import {
  generateTasks,
  summarizeProject,
  recommendAssignee,
  askProjectAI,
} from '../services/ai.js';

import {
  getProjectAIContext,
  getAIContextTask,
} from '../services/aiContext.js';


const router = Router({ mergeParams: true });


// ==========================================
// AI RATE LIMITING
// ==========================================

if (env.nodeEnv !== 'test') {

  router.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 5,

      standardHeaders: true,
      legacyHeaders: false,

      keyGenerator: req => req.user.id,

      message: {
        error: 'Too many AI requests. Please wait a minute and try again.',
      },
    })
  );

}


// Prevent simultaneous AI requests from the same user
const activeRequests = new Set();


router.use((req, res, next) => {

  res.setHeader('Cache-Control', 'no-store');

  next();

});


// ==========================================
// SECURITY HELPERS
// ==========================================

async function verifyCurrentAccess(req) {

  // Revalidate the original authentication token.

  const currentUser = await validateSession(req);

  if (currentUser.id !== req.user.id) {
    throw new HttpError(
      401,
      'Your session is no longer valid.'
    );
  }

  // Recheck project membership after AI generation.

  const { rows } = await query(
    `SELECT 1
     FROM project_members
     WHERE project_id = $1
       AND user_id = $2`,
    [req.params.projectId, currentUser.id]
  );

  if (!rows.length) {
    throw new HttpError(
      404,
      'Project not found'
    );
  }

}


function aiHandler(handler) {

  return asyncHandler(async (req, res) => {

    const userId = req.user.id;

    if (activeRequests.has(userId)) {
      throw new HttpError(
        429,
        'An AI request is already running. Please wait.'
      );
    }

    activeRequests.add(userId);

    try {

      const result = await handler(req);

      // Recheck project membership after AI generation
      await verifyCurrentAccess(req);

      res.json(result);

    } finally {

      activeRequests.delete(userId);

    }

  });

}


// ==========================================
// 1. SMART PLANNER
// ==========================================

router.post('/plan', aiHandler(async req => {

  const data = parse(aiPlannerSchema, req.body);

  const context = await getProjectAIContext(
    req.params.projectId,
    req.user.id
  );

  const result = await generateTasks({

    projectName: context.projectName,

    projectDescription: context.projectDescription,

    prompt: data.prompt,

    mode: data.mode,
    members: context.members,

currentDate: context.currentDate,

    existingTasks: context.tasks.map(task => ({
      title: task.title,
      status: task.status,
    })),

  });

  return result;

}));


// ==========================================
// 2. PROJECT INTELLIGENCE
// ==========================================

router.post('/intelligence', aiHandler(async req => {

  parse(aiIntelligenceSchema, req.body);

  const context = await getProjectAIContext(
    req.params.projectId,
    req.user.id
  );

  const result = await summarizeProject({

    projectName: context.projectName,

    projectDescription: context.projectDescription,

    statistics: context.statistics,

    tasks: context.tasks,

    currentDate: context.currentDate,

  });

  return result;

}));


// ==========================================
// 3. SMART ASSIGNMENT
// ==========================================

router.post('/assign', aiHandler(async req => {

  const data = parse(aiAssignmentSchema, req.body);

  const context = await getProjectAIContext(
    req.params.projectId,
    req.user.id
  );

  const task = getAIContextTask(
    context,
    data.taskId
  );

  if (task.status === 'done') {

    throw new HttpError(
      400,
      'Smart Assignment is available only for active tasks.'
    );

  }

  const result = await recommendAssignee({

    task,

    members: context.members,

  });

  return result;

}));


// ==========================================
// 4. ASK PULSE AI
// ==========================================

router.post('/ask', aiHandler(async req => {

  const data = parse(aiQuestionSchema, req.body);

  const context = await getProjectAIContext(
    req.params.projectId,
    req.user.id
  );

  const result = await askProjectAI({

    question: data.question,

    projectName: context.projectName,

    projectDescription: context.projectDescription,

    statistics: context.statistics,

    tasks: context.tasks,

    members: context.members,

    activities: context.activities,

    currentDate: context.currentDate,

  });

  return result;

}));


export default router;