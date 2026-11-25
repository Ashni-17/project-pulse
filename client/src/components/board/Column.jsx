import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import clsx from 'clsx';
import TaskCard from './TaskCard.jsx';

export default function Column({ status, tasks, onOpen, onCreate, dragDisabled }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  return (
    <section aria-label={status.label} className={clsx('flex min-h-[14rem] w-[85vw] shrink-0 snap-center flex-col rounded-xl bg-ink-100/70 p-2.5 transition-colors sm:w-auto sm:flex-1 sm:shrink', isOver && 'bg-pulse-50 ring-1 ring-pulse-300')}>
      <header className="mb-2.5 flex items-center justify-between px-1.5 pt-1">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink-800">
          <span className={clsx('h-2.5 w-2.5 rounded-full', status.dot)} />{status.label}
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-ink-500">{tasks.length}</span>
        </h3>
        <button className="btn btn-ghost !p-1" onClick={() => onCreate(status.id)} aria-label={`Add task to ${status.label}`}><Plus size={16} /></button>
      </header>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex flex-1 flex-col gap-2">
          {tasks.map((t) => <TaskCard key={t.id} task={t} onOpen={onOpen} disabled={dragDisabled} />)}
          {!tasks.length && <p className="rounded-lg border border-dashed border-ink-300 px-3 py-6 text-center text-xs text-ink-400">Drop a task here</p>}
        </div>
      </SortableContext>
    </section>
  );
}
