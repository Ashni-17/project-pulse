import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarDays, MessageSquare } from 'lucide-react';
import clsx from 'clsx';
import { Avatar, Badge } from '../ui';
import { PRIORITIES, formatDate, isOverdue } from '../../lib/constants.js';

/** Pure presentation, reused by the sortable card and by the drag overlay. */
export function TaskCardView({ task, onClick, dragging = false, overlay = false }) {
  const priority = PRIORITIES.find((p) => p.id === task.priority);
  const overdue = isOverdue(task);
  return (
    <div onClick={onClick}
      className={clsx('cursor-grab rounded-lg border border-ink-200 border-l-4 bg-white p-3 shadow-card transition-colors hover:border-ink-300 active:cursor-grabbing',
        priority.id === 'high' ? 'border-l-rose-500' : priority.id === 'medium' ? 'border-l-amber-400' : 'border-l-sky-400',
        dragging && 'opacity-30', overlay && 'rotate-1 shadow-lift ring-2 ring-pulse-400')}>
      <p className="text-sm font-semibold leading-snug text-ink-900">{task.title}</p>
      {task.description && <p className="mt-1 line-clamp-2 text-xs text-ink-500">{task.description}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Badge className={priority.cls}>{priority.label}</Badge>
        {task.due_date && (
          <span className={clsx('inline-flex items-center gap-1 text-xs', overdue ? 'font-semibold text-rose-600' : 'text-ink-500')}>
            <CalendarDays size={12} />{formatDate(task.due_date)}{overdue && ' · overdue'}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          {task.comment_count > 0 && <span className="inline-flex items-center gap-1 text-xs text-ink-500"><MessageSquare size={12} />{task.comment_count}</span>}
          {task.assignee_name && <Avatar name={task.assignee_name} size="sm" />}
        </span>
      </div>
    </div>
  );
}

export default function TaskCard({ task, onOpen, disabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...attributes} {...listeners}>
      <TaskCardView task={task} dragging={isDragging} onClick={() => onOpen(task.id)} />
    </div>
  );
}
