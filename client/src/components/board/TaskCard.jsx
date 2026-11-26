
import { useSortable } from '@dnd-kit/sortable';

import { CSS } from '@dnd-kit/utilities';

import {
  CalendarDays,
  MessageSquare,
  GripVertical,
  Flag,
  UserRound,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

import clsx from 'clsx';

import { Avatar } from '../ui';

import {
  PRIORITIES,
  formatDate,
  isOverdue,
} from '../../lib/constants.js';


// ==========================================
// PREMIUM PRIORITY THEMES
// ==========================================

const PRIORITY_THEMES = {
  high: {
    accent: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-700',
  },

  medium: {
    accent: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-700',
  },

  low: {
    accent: 'bg-pulse-500',
    badge: 'bg-pulse-50 text-pulse-700',
  },
};


// ==========================================
// TASK CARD PRESENTATION
// ==========================================

// Reused by both the sortable task card
// and the floating drag overlay.

export function TaskCardView({
  task,
  onClick,
  dragging = false,
  overlay = false,
  disabled = false,
}) {
  const priority = PRIORITIES.find(
    (item) => item.id === task.priority
  );

  const theme =
    PRIORITY_THEMES[task.priority] ||
    PRIORITY_THEMES.medium;

  const overdue = isOverdue(task);

  const completed = task.status === 'done';


  return (
    <div
      onClick={onClick}
      className={clsx(
        'group relative min-w-0 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-sm transition-all duration-200 motion-reduce:transition-none',

        disabled
          ? 'cursor-pointer'
          : 'cursor-grab active:cursor-grabbing',

        !dragging &&
          !overlay &&
          'hover:-translate-y-0.5 hover:border-pulse-300 hover:shadow-lg motion-reduce:hover:transform-none',

        dragging &&
          'opacity-30',

        overlay &&
          'cursor-grabbing border-pulse-300 shadow-xl'
      )}
    >

      {/* ==========================================
          PRIORITY ACCENT LINE
          ========================================== */}

      <div
        aria-hidden="true"
        className={clsx(
          'h-[3px] w-full',

          theme.accent
        )}
      />


      {/* ==========================================
          MAIN CARD CONTENT
          ========================================== */}

      <div className="p-3.5">


        {/* ==========================================
            PRIORITY AND DRAG INDICATOR
            ========================================== */}

        <div className="flex items-center justify-between gap-2">

          <span
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold',

              theme.badge
            )}
          >

            <Flag
              size={12}
              strokeWidth={2}
            />

            {priority?.label || 'Unknown'}

          </span>


          <div className="flex shrink-0 items-center gap-2">

            {/* Completed task indicator */}

            {completed && (
              <span
                title="Completed task"
                className="text-pulse-600"
              >
                <CheckCircle2
                  size={17}
                  strokeWidth={2}
                  aria-label="Completed"
                />
              </span>
            )}


            {/* Visual drag indicator */}

            {!disabled && (
              <GripVertical
                size={17}
                strokeWidth={1.8}
                aria-hidden="true"
                className="text-ink-300 transition-colors group-hover:text-pulse-600"
              />
            )}

          </div>

        </div>


        {/* ==========================================
            TASK TITLE
            ========================================== */}

        <p
          className="mt-3 break-words text-sm font-bold leading-relaxed text-ink-900 transition-colors group-hover:text-pulse-800"
          title={task.title}
        >
          {task.title}
        </p>


        {/* ==========================================
            TASK DESCRIPTION
            ========================================== */}

        {task.description && (
          <p className="mt-1.5 line-clamp-2 break-words text-xs leading-relaxed text-ink-500">
            {task.description}
          </p>
        )}


        {/* ==========================================
            DEADLINE AND OVERDUE INDICATOR
            ========================================== */}

        {task.due_date && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">

            <span
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium',

                overdue
                  ? 'bg-rose-50 text-rose-700'
                  : 'bg-ink-50 text-ink-600'
              )}
            >

              <CalendarDays
                size={13}
                strokeWidth={1.8}
              />

              {formatDate(task.due_date)}

            </span>


            {overdue && (
              <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1.5 text-[10px] font-semibold text-rose-700">

                <AlertCircle size={12} />

                Overdue

              </span>
            )}

          </div>
        )}


        {/* ==========================================
            CARD FOOTER
            ========================================== */}

        <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-ink-100 pt-3">


          {/* ==========================================
              ASSIGNED TEAM MEMBER
              ========================================== */}

          {task.assignee_name ? (

            <div className="flex min-w-0 flex-1 items-center gap-2">

              <div className="shrink-0">

                <Avatar
                  name={task.assignee_name}
                  size="sm"
                />

              </div>

              <span
                className="truncate text-[11px] font-medium text-ink-600"
                title={task.assignee_name}
              >
                {task.assignee_name}
              </span>

            </div>

          ) : (

            <div className="flex min-w-0 flex-1 items-center gap-2">

              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-ink-300 bg-ink-50 text-ink-400">

                <UserRound
                  size={14}
                  strokeWidth={1.7}
                />

              </div>

              <span className="truncate text-[11px] font-medium text-ink-500">
                Unassigned
              </span>

            </div>

          )}


          {/* ==========================================
              COMMENTS COUNT
              ========================================== */}

          {task.comment_count > 0 && (

            <span
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-ink-50 px-2 py-1.5 text-[11px] font-medium text-ink-500"
              title={`${task.comment_count} comments`}
            >

              <MessageSquare
                size={13}
                strokeWidth={1.8}
              />

              {task.comment_count}

            </span>

          )}

        </div>

      </div>

    </div>
  );
}


// ==========================================
// SORTABLE TASK CARD
// ==========================================

export default function TaskCard({
  task,
  onOpen,
  disabled,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled,
  });


  // Preserve dnd-kit positioning and animation.

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };


  return (
    <div
      ref={setNodeRef}
      style={style}
      className="min-w-0 rounded-xl"
      {...attributes}
      {...listeners}
    >

      <TaskCardView
        task={task}
        dragging={isDragging}
        disabled={disabled}
        onClick={() => onOpen(task.id)}
      />

    </div>
  );
}
