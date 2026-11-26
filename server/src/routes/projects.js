import { Router } from 'express';
import { query, withTransaction } from '../config/db.js';
import { projectAccess, ownerOnly } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { parse, projectSchema } from '../utils/validation.js';
import { computeStats } from '../utils/stats.js';
import { emitToProject, closeProjectRoom } from '../realtime/socket.js';
import membersRouter from './members.js';
import tasksRouter from './tasks.js';
import aiRouter from './ai.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT p.id, p.name, p.description, p.updated_at, pm.role,
            (SELECT COUNT(*)::int FROM project_members x WHERE x.project_id = p.id) AS member_count,
            (SELECT COUNT(*)::int FROM tasks t WHERE t.project_id = p.id) AS task_count
     FROM projects p JOIN project_members pm ON pm.project_id = p.id
     WHERE pm.user_id = $1 ORDER BY p.updated_at DESC`, [req.user.id]);
  res.json({ projects: rows });
}));

router.post('/', asyncHandler(async (req, res) => {
  const data = parse(projectSchema, req.body);
  const project = await withTransaction(async (db) => {
    const { rows: [p] } = await db.query('INSERT INTO projects(name, description, owner_id) VALUES($1,$2,$3) RETURNING *', [data.name, data.description, req.user.id]);
    await db.query(`INSERT INTO project_members(project_id, user_id, role) VALUES($1,$2,'owner')`, [p.id, req.user.id]);
    return p;
  });
  res.status(201).json({ project: { ...project, role: 'owner' } });
}));

// Everything below requires membership of :projectId.
const scoped = Router({ mergeParams: true });
router.use('/:projectId', projectAccess, scoped);

scoped.get('/', asyncHandler(async (req, res) => {
  const { rows: [project] } = await query(
    `SELECT p.*, u.name AS owner_name FROM projects p JOIN users u ON u.id = p.owner_id WHERE p.id = $1`, [req.params.projectId]);
  res.json({ project: { ...project, role: req.membership.role } });
}));

scoped.patch('/', ownerOnly, asyncHandler(async (req, res) => {
  const data = parse(projectSchema, req.body);
  const { rows: [project] } = await query(
    'UPDATE projects SET name=$1, description=$2, updated_at=now() WHERE id=$3 RETURNING *', [data.name, data.description, req.params.projectId]);
  emitToProject(project.id, 'project:updated', { project });
  res.json({ project: { ...project, role: 'owner' } });
}));

scoped.delete('/', ownerOnly, asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  await query('DELETE FROM projects WHERE id=$1', [projectId]);
  emitToProject(projectId, 'project:deleted', { id: projectId });
  closeProjectRoom(projectId);
  res.status(204).end();
}));

scoped.get('/stats', asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { rows: tasks } = await query('SELECT status, priority, assignee_id, due_date FROM tasks WHERE project_id=$1', [projectId]);
  const stats = computeStats(tasks);
  const { rows: members } = await query(
    'SELECT u.id, u.name FROM project_members pm JOIN users u ON u.id = pm.user_id WHERE pm.project_id=$1 ORDER BY u.name', [projectId]);
  res.json({
    ...stats,
    unassigned: stats.byAssignee.unassigned || 0,
    workload: members.map((m) => ({ userId: m.id, name: m.name, count: stats.byAssignee[m.id] || 0 })),
  });
}));

scoped.get('/activity', asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const params = [req.params.projectId];
  let filter = '';
  if (req.query.taskId) { params.push(req.query.taskId); filter = `AND a.task_id = $${params.length}`; }
  params.push(limit);
  const { rows } = await query(
    `SELECT a.*, u.name AS user_name FROM activities a LEFT JOIN users u ON u.id = a.user_id
     WHERE a.project_id = $1 ${filter} ORDER BY a.created_at DESC LIMIT $${params.length}`, params);
  res.json({ activities: rows });
}));

scoped.use('/members', membersRouter);
scoped.use('/tasks', tasksRouter);
scoped.use('/ai', aiRouter);


export default router;
