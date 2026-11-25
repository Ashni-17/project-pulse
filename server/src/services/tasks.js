import { HttpError } from '../utils/errors.js';

export const TASK_SELECT = `
  SELECT t.id, t.project_id, t.title, t.description, t.status, t.priority, t.assignee_id, t.due_date,
         t.position, t.created_by, t.created_at, t.updated_at,
         a.name AS assignee_name, c.name AS creator_name,
         (SELECT COUNT(*)::int FROM comments cm WHERE cm.task_id = t.id) AS comment_count
  FROM tasks t
  LEFT JOIN users a ON a.id = t.assignee_id
  LEFT JOIN users c ON c.id = t.created_by`;

export async function getTask(db, projectId, taskId) {
  const { rows } = await db.query(`${TASK_SELECT} WHERE t.id = $1 AND t.project_id = $2`, [taskId, projectId]);
  if (!rows[0]) throw new HttpError(404, 'Task not found');
  return rows[0];
}

export async function assertProjectMember(db, projectId, userId) {
  const { rows } = await db.query('SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2', [projectId, userId]);
  if (!rows[0]) throw new HttpError(400, 'Tasks can only be assigned to project members', { assigneeId: ['Not a member of this project'] });
}
