import { emitToProject } from '../realtime/socket.js';

/** Persists an activity entry and broadcasts it to everyone viewing the project. */
export async function logActivity(db, { projectId, taskId = null, user, action, meta = {} }) {
  const { rows: [row] } = await db.query(
    `INSERT INTO activities(project_id, task_id, user_id, action, meta) VALUES($1,$2,$3,$4,$5) RETURNING *`,
    [projectId, taskId, user.id, action, meta],
  );
  const activity = { ...row, user_name: user.name };
  emitToProject(projectId, 'activity:created', activity);
  return activity;
}
