import { Search, X } from 'lucide-react';
import { PRIORITIES, STATUSES } from '../../lib/constants.js';

export const EMPTY_FILTERS = { q: '', status: '', priority: '', assignee: '' };

export default function FilterBar({ filters, onChange, members, resultCount, total }) {
  const set = (k) => (e) => onChange({ ...filters, [k]: e.target.value });
  const active = Object.values(filters).some(Boolean);
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input className="input !pl-9" placeholder="Search tasks by title" value={filters.q} onChange={set('q')} aria-label="Search tasks" />
      </div>
      <select className="input !w-auto" value={filters.status} onChange={set('status')} aria-label="Filter by status">
        <option value="">All statuses</option>{STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <select className="input !w-auto" value={filters.priority} onChange={set('priority')} aria-label="Filter by priority">
        <option value="">All priorities</option>{PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      <select className="input !w-auto" value={filters.assignee} onChange={set('assignee')} aria-label="Filter by assignee">
        <option value="">Anyone</option><option value="none">Unassigned</option>
        {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      {active && (
        <>
          <span className="text-sm text-ink-500">{resultCount} of {total} tasks</span>
          <button className="btn btn-ghost !px-2" onClick={() => onChange(EMPTY_FILTERS)}><X size={14} />Clear filters</button>
        </>
      )}
    </div>
  );
}
