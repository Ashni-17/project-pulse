import { describe, it, expect } from 'vitest';
import { computeStats } from '../src/utils/stats.js';

const task = (status, due_date = null, priority = 'medium', assignee_id = null) => ({ status, priority, due_date, assignee_id });

describe('computeStats', () => {
  it('returns zeros for an empty project', () => {
    const s = computeStats([], '2026-01-10');
    expect(s).toMatchObject({ total: 0, completed: 0, overdue: 0, completionRate: 0 });
  });

  it('counts tasks by status and computes the completion rate', () => {
    const s = computeStats([task('todo'), task('in_progress'), task('done'), task('done')], '2026-01-10');
    expect(s.byStatus).toEqual({ todo: 1, in_progress: 1, done: 2 });
    expect(s.completionRate).toBe(50);
  });

  it('flags only unfinished tasks past their due date as overdue', () => {
    const s = computeStats([
      task('todo', '2026-01-09'), task('in_progress', '2026-01-01'),
      task('done', '2026-01-01'), task('todo', '2026-01-10'), task('todo', null),
    ], '2026-01-10');
    expect(s.overdue).toBe(2);
  });

  it('groups workload by assignee', () => {
    const s = computeStats([task('todo', null, 'high', 'u1'), task('done', null, 'low', 'u1'), task('todo')]);
    expect(s.byAssignee).toEqual({ u1: 2, unassigned: 1 });
    expect(s.byPriority).toEqual({ low: 1, medium: 1, high: 1 });
  });
});
