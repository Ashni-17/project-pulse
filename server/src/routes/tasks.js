import { Router } from 'express';
import { query, withTransaction } from '../config/db.js';
import { HttpError, asyncHandler } from '../utils/errors.js';
import { parse, createTaskSchema, updateTaskSchema, moveTaskSchema } from '../utils/validation.js';
import { TASK_SELECT, getTask, assertProjectMember } from '../services/tasks.js';
import { logActivity } from '../utils/activity.js';
import { emitToProject } from '../realtime/socket.js';
import commentsRouter from './comments.js';

const router = Router({ mergeParams: true });
router.use('/:taskId/comments', commentsRouter);

const COLUMNS = { title: 'title', description: 'description', status: 'status', priority: 'priority', assigneeId: 'assignee_id', dueDate: 'due_date' };
const nextPosition = async (db, projectId, status) =>
  (await db.query('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM tasks WHERE project_id=$1 AND status=$2', [projectId, status])).rows[0].next;

// List + search/filter: ?search=&status=&priority=&assignee=<uuid|none>
router.get('/', asyncHandler(async (req, res) => {
  const where = ['t.project_id = $1'];
  const params = [req.params.projectId];
  const { search, status, priority, assignee } = req.query;
  if (search) { params.push(`%${String(search).replace(/[\\%_]/g, '\\$&')}%`); where.push(`t.title ILIKE $${params.length}`); }
  if (status) { params.push(status); where.push(`t.status = $${params.length}`); }
  if (priority) { params.push(priority); where.push(`t.priority = $${params.length}`); }
  if (assignee === 'none') where.push('t.assignee_id IS NULL');
  else if (assignee) { params.push(assignee); where.push(`t.assignee_id = $${params.length}`); }
  const { rows } = await query(`${TASK_SELECT} WHERE ${where.join(' AND ')} ORDER BY t.position, t.created_at`, params);
  res.json({ tasks: rows });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const data = parse(createTaskSchema, req.body);
  if (data.assigneeId) await assertProjectMember({ query }, projectId, data.assigneeId);

  const position = await nextPosition({ query }, projectId, data.status);
  const { rows: [created] } = await query(
    `INSERT INTO tasks(project_id, title, description, status, priority, assignee_id, due_date, position, created_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [projectId, data.title, data.description, data.status, data.priority, data.assigneeId ?? null, data.dueDate ?? null, position, req.user.id]);
  const task = await getTask({ query }, projectId, created.id);

  emitToProject(projectId, 'tasks:upsert', { tasks: [task] });
  await logActivity({ query }, { projectId, taskId: task.id, user: req.user, action: 'task.created', meta: { title: task.title } });
  if (task.assignee_id) {
    await logActivity({ query }, { projectId, taskId: task.id, user: req.user, action: 'task.assigned', meta: { title: task.title, from: null, to: task.assignee_name } });
  }
  res.status(201).json({ task });
}));

router.get('/:taskId', asyncHandler(async (req, res) => {
  res.json({ task: await getTask({ query }, req.params.projectId, req.params.taskId) });
}));

router.patch('/:taskId', asyncHandler(async (req, res) => {
  const { projectId, taskId } = req.params;
  const data = parse(updateTaskSchema, req.body);
  const before = await getTask({ query }, projectId, taskId);
  if (data.assigneeId) await assertProjectMember({ query }, projectId, data.assigneeId);

  const sets = [];
  const values = [];
  const changed = [];
  for (const [key, column] of Object.entries(COLUMNS)) {
    if (!(key in data)) continue;
    if (String(before[column] ?? '') === String(data[key] ?? '')) continue;
    values.push(data[key]);
    sets.push(`${column} = $${values.length}`);
    changed.push(key);
  }
  if (!changed.length) return res.json({ task: before });

  if (changed.includes('status')) { // moving via the form drops the card at the bottom of its new column
    values.push(await nextPosition({ query }, projectId, data.status));
    sets.push(`position = $${values.length}`);
  }
  values.push(taskId, projectId);
  await query(`UPDATE tasks SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length - 1} AND project_id = $${values.length}`, values);
  const after = await getTask({ query }, projectId, taskId);
  emitToProject(projectId, 'tasks:upsert', { tasks: [after] });

  const log = (action, meta) => logActivity({ query }, { projectId, taskId, user: req.user, action, meta: { title: after.title, ...meta } });
  if (changed.includes('status')) await log('task.status_changed', { from: before.status, to: after.status });
  if (changed.includes('assigneeId')) await log('task.assigned', { from: before.assignee_name, to: after.assignee_name });
  const other = changed.filter((k) => !['status', 'assigneeId'].includes(k));
  if (other.length) await log('task.updated', { fields: other });
  res.json({ task: after });
}));

/**
 * Drag-and-drop endpoint. The client sends the destination column and the index the card was
 * dropped at; the server rewrites positions for the affected columns inside one transaction so
 * every client converges on the same order.
 */
router.patch('/:taskId/move', asyncHandler(async (req, res) => {
  const { projectId, taskId } = req.params;
  const { status, index } = parse(moveTaskSchema, req.body);

  const { tasks, from } = await withTransaction(async (db) => {
    const { rows: [task] } = await db.query('SELECT id, title, status FROM tasks WHERE id=$1 AND project_id=$2 FOR UPDATE', [taskId, projectId]);
    if (!task) throw new HttpError(404, 'Task not found');

    const { rows: siblings } = await db.query(
      'SELECT id FROM tasks WHERE project_id=$1 AND status=$2 AND id<>$3 ORDER BY position, created_at FOR UPDATE', [projectId, status, taskId]);
    const ids = siblings.map((r) => r.id);
    ids.splice(Math.min(index, ids.length), 0, taskId);

    await db.query(
      `UPDATE tasks t SET position = v.ord - 1, status = $2,
         updated_at = CASE WHEN t.id = $3 THEN now() ELSE t.updated_at END
       FROM unnest($1::uuid[]) WITH ORDINALITY AS v(id, ord) WHERE t.id = v.id`, [ids, status, taskId]);

    if (task.status !== status) { // close the gap left behind in the source column
      await db.query(
        `UPDATE tasks t SET position = v.ord - 1
         FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY position, created_at) AS ord FROM tasks WHERE project_id=$1 AND status=$2) v
         WHERE t.id = v.id`, [projectId, task.status]);
    }
    const { rows } = await db.query(`${TASK_SELECT} WHERE t.project_id = $1 AND t.status = ANY($2) ORDER BY t.position`, [projectId, [status, task.status]]);
    return { tasks: rows, from: task };
  });

  emitToProject(projectId, 'tasks:upsert', { tasks });
  if (from.status !== status) {
    await logActivity({ query }, { projectId, taskId, user: req.user, action: 'task.status_changed', meta: { title: from.title, from: from.status, to: status } });
  }
  res.json({ tasks });
}));

router.delete('/:taskId', asyncHandler(async (req, res) => {
  const { projectId, taskId } = req.params;
  const task = await getTask({ query }, projectId, taskId);
  if (req.membership.role !== 'owner' && task.created_by !== req.user.id) {
    throw new HttpError(403, 'Only the project owner or the task creator can delete this task');
  }
  await query('DELETE FROM tasks WHERE id=$1 AND project_id=$2', [taskId, projectId]);
  emitToProject(projectId, 'task:deleted', { id: taskId });
  await logActivity({ query }, { projectId, user: req.user, action: 'task.deleted', meta: { title: task.title } });
  res.status(204).end();
}));

export default router;
