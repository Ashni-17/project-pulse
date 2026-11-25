import { Router } from 'express';
import { query } from '../config/db.js';
import { ownerOnly } from '../middleware/auth.js';
import { HttpError, asyncHandler } from '../utils/errors.js';
import { parse, memberSchema } from '../utils/validation.js';
import { logActivity } from '../utils/activity.js';
import { emitToProject, evictUser } from '../realtime/socket.js';

const router = Router({ mergeParams: true });

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, pm.role, pm.joined_at FROM project_members pm
     JOIN users u ON u.id = pm.user_id WHERE pm.project_id = $1 ORDER BY (pm.role = 'owner') DESC, u.name`, [req.params.projectId]);
  res.json({ members: rows });
}));

router.post('/', ownerOnly, asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { email } = parse(memberSchema, req.body);
  const { rows: [user] } = await query('SELECT id, name, email FROM users WHERE email=$1', [email]);
  if (!user) throw new HttpError(404, 'No registered user has that email', { email: ['Ask them to create a Project Pulse account first'] });

  const inserted = await query(
    `INSERT INTO project_members(project_id, user_id, role) VALUES($1,$2,'member') ON CONFLICT DO NOTHING RETURNING joined_at`, [projectId, user.id]);
  if (!inserted.rowCount) throw new HttpError(409, `${user.name} is already on this project`, { email: ['Already a member'] });

  const member = { ...user, role: 'member', joined_at: inserted.rows[0].joined_at };
  emitToProject(projectId, 'member:added', { member });
  await logActivity({ query }, { projectId, user: req.user, action: 'member.added', meta: { name: user.name } });
  res.status(201).json({ member });
}));

router.delete('/:userId', ownerOnly, asyncHandler(async (req, res) => {
  const { projectId, userId } = req.params;
  const { rows: [target] } = await query(
    `SELECT u.name, pm.role FROM project_members pm JOIN users u ON u.id = pm.user_id WHERE pm.project_id=$1 AND pm.user_id=$2`, [projectId, userId]);
  if (!target) throw new HttpError(404, 'Member not found');
  if (target.role === 'owner') throw new HttpError(400, 'The project owner cannot be removed');

  await query('DELETE FROM project_members WHERE project_id=$1 AND user_id=$2', [projectId, userId]);
  const { rows: freed } = await query(
    `UPDATE tasks SET assignee_id = NULL, updated_at = now() WHERE project_id=$1 AND assignee_id=$2 RETURNING id`, [projectId, userId]);

  emitToProject(projectId, 'member:removed', { userId });
  if (freed.length) {
    const { rows: tasks } = await query(`SELECT id FROM tasks WHERE id = ANY($1)`, [freed.map((r) => r.id)]);
    emitToProject(projectId, 'project:refresh', { reason: 'assignees-cleared', count: tasks.length });
  }
  await evictUser(projectId, userId);
  await logActivity({ query }, { projectId, user: req.user, action: 'member.removed', meta: { name: target.name } });
  res.status(204).end();
}));

export default router;
