import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { api } from '../../lib/api.js';
import { PRIORITIES, STATUSES } from '../../lib/constants.js';
import { Avatar, PageLoader, ProgressBar } from '../ui';

export function CompletionRing({ value, size = 132 }) {
  const r = 52, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={`${value}% complete`}>
      <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-ink-100" />
      <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" strokeLinecap="round" className="stroke-pulse-500 transition-all duration-700"
        strokeDasharray={c} strokeDashoffset={c - (c * value) / 100} transform="rotate(-90 60 60)" />
      <text x="60" y="58" textAnchor="middle" className="fill-ink-900 font-display text-[26px] font-bold">{value}%</text>
      <text x="60" y="76" textAnchor="middle" className="fill-ink-500 text-[10px]">complete</text>
    </svg>
  );
}

export const Stat = ({ label, value, tone }) => (
  <div className="panel p-4">
    <p className="text-sm text-ink-500">{label}</p>
    <p className={clsx('mt-1 font-display text-3xl font-bold', tone || 'text-ink-900')}>{value}</p>
  </div>
);

/** Project analytics. `signature` changes whenever tasks change, which triggers a fresh fetch. */
export default function Overview({ projectId, signature }) {
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get(`/projects/${projectId}/stats`).then(setStats).catch(() => {}); }, [projectId, signature]);
  if (!stats) return <PageLoader />;
  const max = Math.max(1, ...stats.workload.map((w) => w.count), stats.unassigned);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total tasks" value={stats.total} />
        <Stat label="Completed" value={stats.completed} tone="text-pulse-700" />
        <Stat label="In progress" value={stats.byStatus.in_progress} />
        <Stat label="Overdue" value={stats.overdue} tone={stats.overdue ? 'text-rose-600' : undefined} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[auto_1fr_1fr]">
        <div className="panel flex items-center justify-center p-5"><CompletionRing value={stats.completionRate} /></div>
        <div className="panel p-5">
          <h3 className="mb-4 font-bold">Tasks by status</h3>
          <div className="space-y-3">
            {STATUSES.map((s) => (
              <div key={s.id}>
                <div className="mb-1 flex justify-between text-sm"><span>{s.label}</span><span className="font-semibold">{stats.byStatus[s.id]}</span></div>
                <ProgressBar value={stats.total ? (stats.byStatus[s.id] / stats.total) * 100 : 0} barClassName={s.bar} />
              </div>
            ))}
          </div>
        </div>
        <div className="panel p-5">
          <h3 className="mb-4 font-bold">Tasks by priority</h3>
          <div className="space-y-3">
            {PRIORITIES.map((p) => (
              <div key={p.id}>
                <div className="mb-1 flex justify-between text-sm"><span>{p.label}</span><span className="font-semibold">{stats.byPriority[p.id]}</span></div>
                <ProgressBar value={stats.total ? (stats.byPriority[p.id] / stats.total) * 100 : 0} barClassName={p.bar} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="panel p-5">
        <h3 className="mb-4 font-bold">Workload by member</h3>
        <ul className="space-y-3">
          {stats.workload.map((w) => (
            <li key={w.userId} className="flex items-center gap-3">
              <Avatar name={w.name} size="sm" /><span className="w-32 truncate text-sm">{w.name}</span>
              <ProgressBar className="flex-1" value={(w.count / max) * 100} /><span className="w-6 text-right text-sm font-semibold">{w.count}</span>
            </li>
          ))}
          <li className="flex items-center gap-3 text-ink-500">
            <span className="h-6 w-6" /><span className="w-32 text-sm">Unassigned</span>
            <ProgressBar className="flex-1" value={(stats.unassigned / max) * 100} barClassName="bg-ink-300" /><span className="w-6 text-right text-sm font-semibold">{stats.unassigned}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
