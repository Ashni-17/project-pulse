import { useEffect, useRef, useState } from 'react';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

import {
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';

import Column from './Column.jsx';
import { TaskCardView } from './TaskCard.jsx';
import { STATUSES } from '../../lib/constants.js';

// ==========================================
// GROUP TASKS BY STATUS
// ==========================================

const group = (tasks) => {
  const cols = Object.fromEntries(
    STATUSES.map((status) => [status.id, []])
  );

  [...tasks]
    .sort(
      (a, b) =>
        a.position - b.position ||
        String(a.created_at ?? '').localeCompare(
          String(b.created_at ?? '')
        ) ||
        String(a.id).localeCompare(String(b.id))
    )
    .forEach((task) => {
      cols[task.status]?.push(task);
    });

  return cols;
};

// ==========================================
// LOCATE TASK OR COLUMN
// ==========================================

const isColumn = (cols, id) =>
  Object.prototype.hasOwnProperty.call(cols, id);

const locate = (cols, id) =>
  isColumn(cols, id)
    ? id
    : Object.keys(cols).find((key) =>
        cols[key].some((task) => task.id === id)
      );

// ==========================================
// SHARED CROSS-COLUMN MOVEMENT
// ==========================================

function moveAcrossColumns(cols, active, over) {
  const from = locate(cols, active.id);
  const to = locate(cols, over.id);

  if (!from || !to || from === to) {
    return cols;
  }

  const item = cols[from].find(
    (task) => task.id === active.id
  );

  if (!item) return cols;

  const overIsColumn = isColumn(cols, over.id);

  const destination = cols[to].filter(
    (task) => task.id !== active.id
  );

  const overIndex = overIsColumn
    ? destination.length
    : destination.findIndex(
        (task) => task.id === over.id
      );

  if (overIndex < 0) return cols;

  const translated = active.rect.current.translated;

  const below =
    !overIsColumn &&
    translated &&
    translated.top >
      over.rect.top + over.rect.height / 2;

  const index = Math.max(
    0,
    Math.min(
      destination.length,
      overIndex + (below ? 1 : 0)
    )
  );

  return {
    ...cols,

    [from]: cols[from].filter(
      (task) => task.id !== active.id
    ),

    [to]: [
      ...destination.slice(0, index),

      {
        ...item,
        status: to,
      },

      ...destination.slice(index),
    ],
  };
}

// ==========================================
// KANBAN BOARD
// ==========================================

export default function Board({
  tasks,
  onMove,
  onOpen,
  onCreate,
  dragDisabled,
}) {
  const [cols, setCols] = useState(() => group(tasks));
  const [activeId, setActiveId] = useState(null);

  // Keep the latest drag state available immediately.
  const colsRef = useRef(cols);
  const draggingRef = useRef(false);

  function updateColumns(next) {
    colsRef.current = next;
    setCols(next);
  }

  // Re-sync with authoritative task state whenever
  // a task is not being dragged.

  useEffect(() => {
    if (!draggingRef.current) {
      const next = group(tasks);

      colsRef.current = next;
      setCols(next);
    }
  }, [tasks, activeId]);

  // ==========================================
  // DRAG AND DROP SENSORS
  // ==========================================

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),

    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 180,
        tolerance: 8,
      },
    }),

    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ==========================================
  // HANDLE DRAG START
  // ==========================================

  function handleDragStart({ active }) {
    if (dragDisabled) return;

    draggingRef.current = true;

    updateColumns(group(tasks));
    setActiveId(active.id);
  }

  // ==========================================
  // HANDLE CROSS-COLUMN DRAGGING
  // ==========================================

  function handleDragOver({ active, over }) {
    if (
      !over ||
      dragDisabled ||
      !draggingRef.current
    ) {
      return;
    }

    const previous = colsRef.current;

    const next = moveAcrossColumns(
      previous,
      active,
      over
    );

    if (next !== previous) {
      updateColumns(next);
    }
  }

  // ==========================================
  // HANDLE DRAG CANCELLATION
  // ==========================================

  function handleDragCancel() {
    draggingRef.current = false;

    updateColumns(group(tasks));
    setActiveId(null);
  }

  // ==========================================
  // HANDLE FINAL DROP
  // ==========================================

  function handleDragEnd({ active, over }) {
    if (
      !over ||
      dragDisabled ||
      !draggingRef.current
    ) {
      handleDragCancel();
      return;
    }

    const original = tasks.find(
      (task) => task.id === active.id
    );

    // The task may have been deleted by another user.

    if (!original) {
      handleDragCancel();
      return;
    }

    // Read the latest drag state rather than relying
    // on a potentially outdated React render.

    const current = colsRef.current;

    const from = locate(current, active.id);
    const to = locate(current, over.id);

    if (!from || !to) {
      handleDragCancel();
      return;
    }

    let next = current;

    // CASE 1: Same-column reordering.

    if (from === to) {
      const oldIndex = current[from].findIndex(
        (task) => task.id === active.id
      );

      const newIndex = isColumn(current, over.id)
        ? current[to].length - 1
        : current[to].findIndex(
            (task) => task.id === over.id
          );

      if (
        oldIndex >= 0 &&
        newIndex >= 0 &&
        oldIndex !== newIndex
      ) {
        next = {
          ...current,

          [from]: arrayMove(
            current[from],
            oldIndex,
            newIndex
          ),
        };
      }
    }

    // CASE 2: Final cross-column drop.
    // Handles drops even when the last DragOver
    // event has not moved the task.

    else {
      next = moveAcrossColumns(
        current,
        active,
        over
      );
    }

    const status = locate(next, active.id);

    if (!status || status !== to) {
      handleDragCancel();
      return;
    }

    const index = next[status].findIndex(
      (task) => task.id === active.id
    );

    const originalIndex = group(tasks)[
      original.status
    ]?.findIndex(
      (task) => task.id === active.id
    );

    if (index < 0 || originalIndex === undefined) {
      handleDragCancel();
      return;
    }

    // Reconcile with the latest server tasks so that
    // newly created or deleted tasks are not lost
    // from the optimistic state.

    const latest = group(tasks);

    const destination = latest[status].filter(
      (task) => task.id !== active.id
    );

    const followingTask = next[status]
      .slice(index + 1)
      .find((task) =>
        destination.some(
          (currentTask) => currentTask.id === task.id
        )
      );

    const precedingTask = next[status]
      .slice(0, index)
      .reverse()
      .find((task) =>
        destination.some(
          (currentTask) => currentTask.id === task.id
        )
      );

    let finalIndex;

    if (followingTask) {
      finalIndex = destination.findIndex(
        (task) => task.id === followingTask.id
      );
    } else if (precedingTask) {
      finalIndex =
        destination.findIndex(
          (task) => task.id === precedingTask.id
        ) + 1;
    } else {
      finalIndex = Math.min(
        index,
        destination.length
      );
    }

    const reconciled = Object.fromEntries(
      Object.entries(latest).map(
        ([key, items]) => [
          key,
          items.filter(
            (task) => task.id !== active.id
          ),
        ]
      )
    );

    reconciled[status].splice(finalIndex, 0, {
      ...original,
      status,
    });

    draggingRef.current = false;

    updateColumns(reconciled);
    setActiveId(null);

    // Persist only when the task position or
    // status actually changes.

    if (
      original.status !== status ||
      originalIndex !== finalIndex
    ) {
      onMove(
        active.id,
        status,
        finalIndex,
        reconciled
      );
    }
  }

  // ==========================================
  // CURRENTLY DRAGGED TASK
  // ==========================================

  const activeTask = activeId
    ? tasks.find((task) => task.id === activeId)
    : null;

  // ==========================================
  // PREMIUM KANBAN LAYOUT
  // ==========================================

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* Custom board scrollbar */}

      <style>{`
        .pulse-kanban-scroll {
          scrollbar-width: thin;
          scrollbar-color: #a4f3dc #ecfdf7;
        }

        .pulse-kanban-scroll::-webkit-scrollbar {
          height: 7px;
        }

        .pulse-kanban-scroll::-webkit-scrollbar-track {
          background: #ecfdf7;
          border-radius: 10px;
        }

        .pulse-kanban-scroll::-webkit-scrollbar-thumb {
          background: #a4f3dc;
          border-radius: 10px;
        }

        .pulse-kanban-scroll::-webkit-scrollbar-thumb:hover {
          background: #30d0ab;
        }
      `}</style>

      {/* Responsive board container */}

      <div
        className="pulse-kanban-scroll -mx-4 flex min-w-0 snap-x items-start gap-4 overflow-x-auto px-4 pb-5 pt-2 sm:mx-0 sm:px-0 xl:gap-5"
      >
        {STATUSES.map((status) => (
          <Column
            key={status.id}
            status={status}
            tasks={cols[status.id]}
            onOpen={onOpen}
            onCreate={onCreate}
            dragDisabled={dragDisabled}
          />
        ))}
      </div>

      {/* Floating drag preview */}

      <DragOverlay>
        {activeTask && (
          <div className="rotate-2 cursor-grabbing rounded-xl shadow-2xl ring-2 ring-pulse-400 motion-reduce:transform-none">
            <TaskCardView
              task={activeTask}
              overlay
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
