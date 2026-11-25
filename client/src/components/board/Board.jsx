import { useEffect, useState } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCorners, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import Column from './Column.jsx';
import { TaskCardView } from './TaskCard.jsx';
import { STATUSES } from '../../lib/constants.js';

const group = (tasks) => {
  const cols = Object.fromEntries(STATUSES.map((s) => [s.id, []]));
  [...tasks].sort((a, b) => a.position - b.position).forEach((t) => cols[t.status]?.push(t));
  return cols;
};
const locate = (cols, id) => (id in cols ? id : Object.keys(cols).find((k) => cols[k].some((t) => t.id === id)));

/**
 * Multi-column sortable board. While a card is being dragged the layout lives in local `cols`
 * state (so the card visibly hops between columns); when it is dropped we report the final
 * column + index to the parent, which persists it through the API.
 */
export default function Board({ tasks, onMove, onOpen, onCreate, dragDisabled }) {
  const [cols, setCols] = useState(() => group(tasks));
  const [activeId, setActiveId] = useState(null);

  // Re-sync from the source of truth (server/socket) whenever we are not mid-drag.
  useEffect(() => { if (!activeId) setCols(group(tasks)); }, [tasks, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragOver({ active, over }) {
    if (!over) return;
    setCols((prev) => {
      const from = locate(prev, active.id);
      const to = locate(prev, over.id);
      if (!from || !to || from === to) return prev;
      const item = prev[from].find((t) => t.id === active.id);
      const overIsColumn = over.id in prev;
      const overIndex = overIsColumn ? prev[to].length : prev[to].findIndex((t) => t.id === over.id);
      const below = !overIsColumn && active.rect.current.translated && active.rect.current.translated.top > over.rect.top + over.rect.height / 2;
      const at = overIndex + (below ? 1 : 0);
      return {
        ...prev,
        [from]: prev[from].filter((t) => t.id !== active.id),
        [to]: [...prev[to].slice(0, at), { ...item, status: to }, ...prev[to].slice(at)],
      };
    });
  }

  function handleDragEnd({ active, over }) {
    let next = cols;
    if (over) {
      const from = locate(cols, active.id);
      const to = locate(cols, over.id);
      if (from && from === to) {
        const oldIndex = cols[from].findIndex((t) => t.id === active.id);
        const newIndex = over.id in cols ? cols[to].length - 1 : cols[to].findIndex((t) => t.id === over.id);
        if (oldIndex !== newIndex) next = { ...cols, [from]: arrayMove(cols[from], oldIndex, newIndex) };
      }
    }
    setCols(next);
    setActiveId(null);

    const status = locate(next, active.id);
    const index = next[status].findIndex((t) => t.id === active.id);
    const original = tasks.find((t) => t.id === active.id);
    const originalIndex = group(tasks)[original.status].findIndex((t) => t.id === active.id);
    if (original.status !== status || originalIndex !== index) onMove(active.id, status, index, next);
  }

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners}
      onDragStart={({ active }) => setActiveId(active.id)} onDragOver={handleDragOver}
      onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:overflow-visible sm:px-0">
        {STATUSES.map((s) => <Column key={s.id} status={s} tasks={cols[s.id]} onOpen={onOpen} onCreate={onCreate} dragDisabled={dragDisabled} />)}
      </div>
      <DragOverlay>{activeTask && <TaskCardView task={activeTask} overlay />}</DragOverlay>
    </DndContext>
  );
}
