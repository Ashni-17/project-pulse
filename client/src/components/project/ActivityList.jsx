import { History } from 'lucide-react';
import { Avatar, EmptyState } from '../ui';
import { describeActivity, formatDateTime, timeAgo } from '../../lib/constants.js';

export default function ActivityList({ items, compact = false }) {
  if (!items.length) return <EmptyState icon={History} title="No activity yet" text="Changes to tasks and members will show up here." />;
  return (
    <ol className="space-y-3">
      {items.map((a) => (
        <li key={a.id} className="flex gap-3">
          <Avatar name={a.user_name || 'Former member'} size={compact ? 'sm' : 'md'} />
          <div className="min-w-0 flex-1 text-sm">
            <p className="text-ink-700"><span className="font-semibold text-ink-900">{a.user_name || 'Former member'}</span> {describeActivity(a)}</p>
            <time className="text-xs text-ink-400" dateTime={a.created_at} title={formatDateTime(a.created_at)}>{timeAgo(a.created_at)}</time>
          </div>
        </li>
      ))}
    </ol>
  );
}
