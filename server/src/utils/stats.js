/**
 * Pure dashboard maths, kept free of I/O so it can be unit tested.
 * `tasks` is an array of { status, priority, assignee_id, due_date: 'YYYY-MM-DD' | null }.
 */
export function computeStats(tasks, today = new Date().toISOString().slice(0, 10)) {
  const byStatus = { todo: 0, in_progress: 0, done: 0 };
  const byPriority = { low: 0, medium: 0, high: 0 };
  const byAssignee = {};
  let overdue = 0;

  for (const t of tasks) {
    byStatus[t.status] += 1;
    byPriority[t.priority] += 1;
    const key = t.assignee_id || 'unassigned';
    byAssignee[key] = (byAssignee[key] || 0) + 1;
    if (t.due_date && t.status !== 'done' && t.due_date < today) overdue += 1;
  }

  const total = tasks.length;
  const completed = byStatus.done;
  return {
    total, byStatus, byPriority, byAssignee, completed, overdue,
    completionRate: total ? Math.round((completed / total) * 100) : 0,
  };
}
