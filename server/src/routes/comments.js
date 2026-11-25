import { Router } from 'express';
import { query } from '../config/db.js';
import { asyncHandler } from '../utils/errors.js';
import { parse, commentSchema } from '../utils/validation.js';
import { getTask } from '../services/tasks.js';
import { logActivity } from '../utils/activity.js';
import { emitToProject } from '../realtime/socket.js';

const router = Router({ mergeParams: true });

const COMMENT_SELECT = `SELECT c.id, c.task_id, c.user_id, c.body, c.created_at, u.name AS user_name
  FROM comments c LEFT JOIN users u ON u.id = c.user_id`;

router.get('/', asyncHandler(async (req, res) => {
  const { projectId, taskId } = req.params;
  await getTask({ query }, projectId, taskId); // confirms the task belongs to this project
  const { rows } = await query(`${COMMENT_SELECT} WHERE c.task_id = $1 ORDER BY c.created_at`, [taskId]);
  res.json({ comments: rows });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { projectId, taskId } = req.params;
  const { body } = parse(commentSchema, req.body);
  const task = await getTask({ query }, projectId, taskId);

  const { rows: [created] } = await query('INSERT INTO comments(task_id, user_id, body) VALUES($1,$2,$3) RETURNING id', [taskId, req.user.id, body]);
  const { rows: [comment] } = await query(`${COMMENT_SELECT} WHERE c.id = $1`, [created.id]);

  emitToProject(projectId, 'comment:created', { comment });
  emitToProject(projectId, 'tasks:upsert', { tasks: [await getTask({ query }, projectId, taskId)] }); // refresh comment count
  await logActivity({ query }, { projectId, taskId, user: req.user, action: 'comment.added', meta: { title: task.title } });
  res.status(201).json({ comment });
}));

export default router;
