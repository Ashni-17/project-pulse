export const STATUSES = [
  { id: 'todo', label: 'To do', dot: 'bg-ink-400', bar: 'bg-ink-400' },
  { id: 'in_progress', label: 'In progress', dot: 'bg-amber-400', bar: 'bg-amber-400' },
  { id: 'done', label: 'Done', dot: 'bg-pulse-500', bar: 'bg-pulse-500' },
];

export const PRIORITIES = [
  { id: 'low', label: 'Low', cls: 'bg-sky-50 text-sky-700 ring-sky-200', bar: 'bg-sky-400' },
  { id: 'medium', label: 'Medium', cls: 'bg-amber-50 text-amber-700 ring-amber-200', bar: 'bg-amber-400' },
  { id: 'high', label: 'High', cls: 'bg-rose-50 text-rose-700 ring-rose-200', bar: 'bg-rose-500' },
];

export const statusLabel = (id) => STATUSES.find((s) => s.id === id)?.label ?? id;
export const todayStr = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
export const isOverdue = (t) => Boolean(t.due_date) && t.status !== 'done' && t.due_date < todayStr();

export function formatDate(value) {
  if (!value) return 'No date';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export const formatDateTime = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function timeAgo(iso) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000));
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return `${Math.round(seconds / 86400)} d ago`;
}

/** Turns an activity row into a readable sentence fragment (the actor is rendered separately). */
export function describeActivity(a) {
  const m = a.meta || {};
  switch (a.action) {
    case 'task.created': return `created “${m.title}”`;
    case 'task.deleted': return `deleted “${m.title}”`;
    case 'task.status_changed': return `moved “${m.title}” from ${statusLabel(m.from)} to ${statusLabel(m.to)}`;
    case 'task.assigned': return m.to ? `assigned “${m.title}” to ${m.to}` : `unassigned “${m.title}”`;
    case 'task.updated': return `updated ${m.fields?.join(', ') || 'details of'} on “${m.title}”`;
    case 'comment.added': return `commented on “${m.title}”`;
    case 'member.added': return `added ${m.name} to the project`;
    case 'member.removed': return `removed ${m.name} from the project`;
    default: return a.action;
  }
}
