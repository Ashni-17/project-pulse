
import { useEffect, useState } from 'react';

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
    .sort((a, b) => a.position - b.position)
    .forEach((task) => {
      cols[task.status]?.push(task);
    });

  return cols;
};


// ==========================================
// LOCATE TASK OR COLUMN
// ==========================================

const locate = (cols, id) =>
  id in cols
    ? id
    : Object.keys(cols).find((key) =>
        cols[key].some((task) => task.id === id)
      );


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


  // Re-sync with server and real-time socket updates
  // whenever a task is not being dragged.

  useEffect(() => {
    if (!activeId) {
      setCols(group(tasks));
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
  // HANDLE CROSS-COLUMN DRAGGING
  // ==========================================

  function handleDragOver({ active, over }) {
    if (!over || dragDisabled) return;

    setCols((previous) => {
      const from = locate(previous, active.id);
      const to = locate(previous, over.id);

      if (!from || !to || from === to) {
        return previous;
      }

      const item = previous[from].find(
        (task) => task.id === active.id
      );

      if (!item) return previous;

      const overIsColumn = over.id in previous;

      const overIndex = overIsColumn
        ? previous[to].length
        : previous[to].findIndex(
            (task) => task.id === over.id
          );

      const below =
        !overIsColumn &&
        active.rect.current.translated &&
        active.rect.current.translated.top >
          over.rect.top + over.rect.height / 2;

      const at = overIndex + (below ? 1 : 0);

      return {
        ...previous,

        [from]: previous[from].filter(
          (task) => task.id !== active.id
        ),

        [to]: [
          ...previous[to].slice(0, at),

          {
            ...item,
            status: to,
          },

          ...previous[to].slice(at),
        ],
      };
    });
  }


  // ==========================================
  // HANDLE DRAG CANCELLATION
  // ==========================================

  function handleDragCancel() {
    setCols(group(tasks));
    setActiveId(null);
  }


  // ==========================================
  // HANDLE FINAL DROP
  // ==========================================

  function handleDragEnd({ active, over }) {

    // Restore the current server state when dropped
    // outside the board or when dragging is disabled.

    if (!over || dragDisabled) {
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

    let next = cols;

    const from = locate(cols, active.id);
    const to = locate(cols, over.id);

    if (!from || !to) {
      handleDragCancel();
      return;
    }

    if (from === to) {
      const oldIndex = cols[from].findIndex(
        (task) => task.id === active.id
      );

      const newIndex =
        over.id in cols
          ? cols[to].length - 1
          : cols[to].findIndex(
              (task) => task.id === over.id
            );

      if (
        oldIndex >= 0 &&
        newIndex >= 0 &&
        oldIndex !== newIndex
      ) {
        next = {
          ...cols,

          [from]: arrayMove(
            cols[from],
            oldIndex,
            newIndex
          ),
        };
      }
    }

    const status = locate(next, active.id);

    if (!status) {
      handleDragCancel();
      return;
    }

    const index = next[status].findIndex(
      (task) => task.id === active.id
    );

    const originalIndex = group(tasks)[
      original.status
    ].findIndex(
      (task) => task.id === active.id
    );

    setCols(next);
    setActiveId(null);

    // Persist only when the task position or status changes.

    if (
      original.status !== status ||
      originalIndex !== index
    ) {
      onMove(
        active.id,
        status,
        index,
        next
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

      onDragStart={({ active }) => {
        setActiveId(active.id);
      }}

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


      {/* ==========================================
          RESPONSIVE BOARD CONTAINER
          ========================================== */}

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


      {/* ==========================================
          FLOATING DRAG PREVIEW
          ========================================== */}

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
