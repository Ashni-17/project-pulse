import { Router } from 'express';
import { query } from '../config/db.js';
import { asyncHandler } from '../utils/errors.js';
import { computeStats } from '../utils/stats.js';

const router = Router();

// Cross-project overview for the signed-in user.
router.get('/', asyncHandler(async (req, res) => {
  const uid = req.user.id;
  const { rows: projects } = await query(
    `SELECT p.id, p.name, p.description, pm.role FROM projects p
     JOIN project_members pm ON pm.project_id = p.id WHERE pm.user_id = $1 ORDER BY p.updated_at DESC`, [uid]);
  const { rows: tasks } = await query(
    `SELECT t.project_id, t.status, t.priority, t.assignee_id, t.due_date FROM tasks t
     JOIN project_members pm ON pm.project_id = t.project_id WHERE pm.user_id = $1`, [uid]);

  const byProject = {};
  for (const t of tasks) (byProject[t.project_id] ||= []).push(t);

  res.json({
    totals: {
      projects: projects.length,
      ...computeStats(tasks),
      assignedToMe: tasks.filter((t) => t.assignee_id === uid && t.status !== 'done').length,
    },
    projects: projects.map((p) => ({ ...p, stats: computeStats(byProject[p.id] || []) })),
  });
}));

export default router;
