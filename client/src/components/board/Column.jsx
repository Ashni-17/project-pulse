
import { useDroppable } from '@dnd-kit/core';

import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import {
  Plus,
  CircleDashed,
  Timer,
  CheckCircle2,
  Inbox,
} from 'lucide-react';

import clsx from 'clsx';

import TaskCard from './TaskCard.jsx';


// ==========================================
// PREMIUM COLUMN THEMES
// ==========================================

const COLUMN_THEMES = {
  todo: {
    icon: CircleDashed,

    container:
      'border-slate-200 bg-slate-100/80',

    header:
      'bg-gradient-to-r from-slate-200 to-slate-100',

    text: 'text-slate-700',

    count: 'bg-white/80 text-slate-700',

    accent: 'bg-slate-400',

    button:
      'text-slate-600 hover:bg-slate-200 hover:text-slate-900',

    addButton:
      'border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-white/70',
  },

  in_progress: {
    icon: Timer,

    container:
      'border-sky-200 bg-sky-50/60',

    header:
      'bg-gradient-to-r from-sky-100 to-sky-50',

    text: 'text-sky-800',

    count: 'bg-white/80 text-sky-700',

    accent: 'bg-sky-500',

    button:
      'text-sky-700 hover:bg-sky-200 hover:text-sky-900',

    addButton:
      'border-sky-200 text-sky-700 hover:border-sky-400 hover:bg-white/70',
  },

  done: {
    icon: CheckCircle2,

    container:
      'border-pulse-200 bg-pulse-50/70',

    header:
      'bg-gradient-to-r from-pulse-100 to-pulse-50',

    text: 'text-pulse-800',

    count: 'bg-white/80 text-pulse-700',

    accent: 'bg-pulse-500',

    button:
      'text-pulse-700 hover:bg-pulse-200 hover:text-pulse-900',

    addButton:
      'border-pulse-200 text-pulse-700 hover:border-pulse-400 hover:bg-white/70',
  },
};


// ==========================================
// KANBAN COLUMN
// ==========================================

export default function Column({
  status,
  tasks,
  onOpen,
  onCreate,
  dragDisabled,
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status.id,
    disabled: dragDisabled,
  });

  const theme =
    COLUMN_THEMES[status.id] || COLUMN_THEMES.todo;

  const StatusIcon = theme.icon;


  return (
    <section
      aria-label={status.label}
      className={clsx(
        'flex min-h-[26rem] w-[85vw] min-w-0 max-w-[340px] shrink-0 snap-center flex-col rounded-2xl border p-3 shadow-sm transition-all duration-200 motion-reduce:transition-none sm:w-auto sm:min-w-[240px] sm:max-w-none sm:flex-1',

        theme.container,

        isOver &&
          !dragDisabled &&
          'ring-2 ring-pulse-400 ring-offset-2 ring-offset-pulse-50'
      )}
    >

      {/* ==========================================
          PREMIUM COLUMN HEADER
          ========================================== */}

      <header
        className={clsx(
          'flex items-center justify-between gap-2 rounded-xl px-3 py-3',

          theme.header
        )}
      >

        <h3
          className={clsx(
            'flex min-w-0 items-center gap-2 text-sm font-bold',

            theme.text
          )}
        >

          <StatusIcon
            size={19}
            strokeWidth={2}
            className="shrink-0"
          />

          <span className="truncate">
            {status.label}
          </span>

          <span
            className={clsx(
              'inline-flex min-w-[25px] shrink-0 items-center justify-center rounded-lg px-2 py-1 text-xs font-bold',

              theme.count
            )}
          >
            {tasks.length}
          </span>

        </h3>


        {/* Quick add task button */}

        <button
          type="button"
          onClick={() => onCreate(status.id)}
          aria-label={`Add task to ${status.label}`}
          title={`Add task to ${status.label}`}
          className={clsx(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/80 bg-white/70 transition-colors',

            theme.button
          )}
        >
          <Plus size={18} />
        </button>

      </header>


      {/* Status accent line */}

      <div
        aria-hidden="true"
        className={clsx(
          'mb-4 mt-3 h-[3px] shrink-0 rounded-full',

          theme.accent
        )}
      />


      {/* ==========================================
          SORTABLE TASK LIST
          ========================================== */}

      <SortableContext
        items={tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >

        <div
          ref={setNodeRef}
          className={clsx(
            'flex min-h-[140px] flex-1 flex-col gap-3 rounded-xl transition-colors motion-reduce:transition-none',

            isOver &&
              !dragDisabled &&
              'bg-pulse-100/40'
          )}
        >

          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onOpen={onOpen}
              disabled={dragDisabled}
            />
          ))}


          {/* ==========================================
              EMPTY COLUMN STATE
              ========================================== */}

          {!tasks.length && (
            <div
              className={clsx(
                'flex min-h-[140px] flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors',

                isOver && !dragDisabled
                  ? 'border-pulse-400 bg-pulse-100/70'
                  : 'border-slate-300/80 bg-white/40'
              )}
            >

              <div
                className={clsx(
                  'mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm',

                  theme.text
                )}
              >
                <Inbox
                  size={22}
                  strokeWidth={1.6}
                />
              </div>

              <p className="text-sm font-semibold text-ink-700">
                {isOver && !dragDisabled
                  ? 'Drop task here'
                  : 'No tasks yet'}
              </p>

              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                {dragDisabled
                  ? 'Create a task to get started.'
                  : 'Drag a task here or create a new one.'}
              </p>

            </div>
          )}

        </div>

      </SortableContext>


      {/* ==========================================
          BOTTOM ADD TASK BUTTON
          ========================================== */}

      <button
        type="button"
        onClick={() => onCreate(status.id)}
        className={clsx(
          'group mt-4 flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-3 text-sm font-semibold transition-all duration-200 motion-reduce:transition-none',

          theme.addButton
        )}
      >

        <Plus
          size={17}
          className="transition-transform duration-200 group-hover:rotate-90 motion-reduce:transform-none"
        />

        Add task

      </button>

    </section>
  );
}
