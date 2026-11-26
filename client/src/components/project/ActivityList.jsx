import {
  History,
  PlusCircle,
  Pencil,
  Trash2,
  ArrowRightLeft,
  MessageSquare,
  UserPlus,
  UserMinus,
  Settings,
  Activity,
  Clock,
} from 'lucide-react';

import clsx from 'clsx';

import { Avatar, EmptyState } from '../ui';

import {
  describeActivity,
  formatDateTime,
  timeAgo,
} from '../../lib/constants.js';


// ==========================================
// ACTIVITY APPEARANCE
// ==========================================

const ACTIVITY_STYLES = {
  'task.created': {
    icon: PlusCircle,
    label: 'Task created',
    tone: 'bg-pulse-100 text-pulse-700',
  },

  'task.updated': {
    icon: Pencil,
    label: 'Task updated',
    tone: 'bg-amber-100 text-amber-700',
  },

  'task.deleted': {
    icon: Trash2,
    label: 'Task deleted',
    tone: 'bg-rose-100 text-rose-700',
  },

  'task.status_changed': {
    icon: ArrowRightLeft,
    label: 'Status changed',
    tone: 'bg-sky-100 text-sky-700',
  },

  'comment.created': {
    icon: MessageSquare,
    label: 'Comment added',
    tone: 'bg-violet-100 text-violet-700',
  },

  'member.added': {
    icon: UserPlus,
    label: 'Member added',
    tone: 'bg-pulse-100 text-pulse-700',
  },

  'member.removed': {
    icon: UserMinus,
    label: 'Member removed',
    tone: 'bg-rose-100 text-rose-700',
  },

  'project.updated': {
    icon: Settings,
    label: 'Project updated',
    tone: 'bg-sky-100 text-sky-700',
  },
};


const DEFAULT_STYLE = {
  icon: Activity,
  label: 'Project activity',
  tone: 'bg-pulse-100 text-pulse-700',
};


// ==========================================
// ACTIVITY TIMELINE
// ==========================================

export default function ActivityList({
  items,
  compact = false,
}) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-pulse-200 bg-pulse-50/40 py-4">

        <EmptyState
          icon={History}
          title="No activity yet"
          text="Changes to tasks and members will show up here."
        />

      </div>
    );
  }


  return (
    <div className="min-w-0">

      {/* Timeline heading */}

      {!compact && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">

          <div className="flex items-center gap-2">

            <History
              size={17}
              className="text-pulse-700"
            />

            <h3 className="text-sm font-bold text-pulse-900">
              Activity timeline
            </h3>

          </div>

          <span className="rounded-lg border border-pulse-200 bg-pulse-50 px-2.5 py-1.5 text-xs font-semibold text-pulse-800">

            {items.length}{' '}
            {items.length === 1 ? 'update' : 'updates'}

          </span>

        </div>
      )}


      {/* Timeline entries */}

      <ol
        className={clsx(
          'relative',
          compact ? 'space-y-3' : 'space-y-4'
        )}
      >

        {items.map((a, index) => {
          const style =
            ACTIVITY_STYLES[a.action] ||
            DEFAULT_STYLE;

          const Icon = style.icon;

          const isLast =
            index === items.length - 1;

          const name =
            a.user_name || 'Former member';


          return (
            <li
              key={a.id}
              className={clsx(
                'relative flex items-start',
                compact ? 'gap-2' : 'gap-3'
              )}
            >

              {/* Vertical timeline connector */}

              {!isLast && (
                <span
                  aria-hidden="true"
                  className={clsx(
                    'pointer-events-none absolute top-9 w-px bg-pulse-200',

                    compact
                      ? 'bottom-[-12px] left-3.5'
                      : 'bottom-[-16px] left-[18px]'
                  )}
                />
              )}


              {/* Activity type icon */}

              <div
                className={clsx(
                  'relative z-10 flex shrink-0 items-center justify-center rounded-full ring-4 ring-white',

                  compact
                    ? 'h-7 w-7'
                    : 'h-9 w-9',

                  style.tone
                )}
              >

                <Icon
                  size={compact ? 14 : 17}
                  strokeWidth={1.9}
                  aria-hidden="true"
                />

              </div>


              {/* Activity card */}

              <div
                className={clsx(
                  'min-w-0 flex-1 rounded-xl border border-pulse-100 bg-gradient-to-br from-white to-pulse-50/40 shadow-sm transition-colors hover:border-pulse-200',

                  compact ? 'p-2.5' : 'p-4'
                )}
              >

                {/* User information and timestamp */}

                <div className="flex flex-wrap items-center justify-between gap-2">

                  <div className="flex min-w-0 items-center gap-2">

                    <div className="shrink-0">

                      <Avatar
                        name={name}
                        size="sm"
                      />

                    </div>

                    <span className="break-words text-xs font-bold text-ink-900">

                      {name}

                    </span>

                  </div>


                  <time
                    className="inline-flex items-center gap-1 text-[11px] text-ink-500"
                    dateTime={a.created_at}
                    title={formatDateTime(a.created_at)}
                  >

                    <Clock size={11} aria-hidden="true" />

                    {timeAgo(a.created_at)}

                  </time>

                </div>


                {/* Activity description */}

                <p
                  className={clsx(
                    'mt-2 break-words leading-relaxed text-ink-700',

                    compact ? 'text-xs' : 'text-sm'
                  )}
                >

                  <span className="font-semibold text-ink-900">
                    {name}
                  </span>

                  {' '}

                  {describeActivity(a)}

                </p>


                {/* Activity category */}

                <div className="mt-3">

                  <span
                    className={clsx(
                      'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold',

                      style.tone
                    )}
                  >

                    <Icon size={11} aria-hidden="true" />

                    {style.label}

                  </span>

                </div>

              </div>

            </li>
          );
        })}

      </ol>

    </div>
  );
}