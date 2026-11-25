import { useEffect, useRef, useState } from 'react';
import { Send, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../lib/api.js';
import { getSocket } from '../../lib/socket.js';
import { PRIORITIES, STATUSES, formatDateTime, timeAgo } from '../../lib/constants.js';
import { Avatar, Field, Modal, Spinner } from '../ui';
import ActivityList from '../project/ActivityList.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const toPayload = (f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, (k === 'assigneeId' || k === 'dueDate') && v === '' ? null : v]));
const firstError = (e, key) => e[key]?.[0] ?? e[key];

export default function TaskModal({ projectId, task, defaultStatus = 'todo', members, canDelete, onClose, onUpsert, onDelete }) {
  const isNew = !task;
  const base = `/projects/${projectId}/tasks`;
  const toast = useToast();
  // Snapshot used to send only the fields this person actually changed (avoids overwriting teammates' edits).
  const initial = useRef({
    title: task?.title ?? '', description: task?.description ?? '', status: task?.status ?? defaultStatus,
    priority: task?.priority ?? 'medium', assigneeId: task?.assignee_id ?? '', dueDate: task?.due_date ?? '',
  });
  const [form, setForm] = useState(initial.current);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!form.title.trim()) return setErrors({ title: 'Give the task a title' });
    setSaving(true);
    setErrors({});
    try {
      if (isNew) {
        const { task: created } = await api.post(base, toPayload(form));
        onUpsert([created]);
        toast.success('Task created');
      } else {
        const diff = Object.fromEntries(Object.entries(form).filter(([k, v]) => v !== initial.current[k]));
        if (Object.keys(diff).length) {
          const { task: updated } = await api.patch(`${base}/${task.id}`, toPayload(diff));
          onUpsert([updated]);
          toast.success('Task updated');
        }
      }
      onClose();
    } catch (err) {
      setErrors(err.details);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete “${task.title}”? This also removes its comments.`)) return;
    try {
      await api.del(`${base}/${task.id}`);
      onDelete(task.id);
      toast.success('Task deleted');
      onClose();
    } catch (err) { toast.error(err.message); }
  }

  return (
    <Modal title={isNew ? 'New task' : 'Task details'} size={isNew ? 'lg' : 'xl'} onClose={onClose}>
      <div className={clsx('grid gap-6', !isNew && 'lg:grid-cols-[1.1fr_1fr]')}>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Title" error={firstError(errors, 'title')}>
            <input autoFocus className={clsx('input', errors.title && 'input-error')} value={form.title} onChange={set('title')} maxLength={160} placeholder="e.g. Develop landing page" />
          </Field>
          <Field label="Description" error={firstError(errors, 'description')}>
            <textarea className="input min-h-[96px] resize-y" value={form.description} onChange={set('description')} placeholder="What needs to happen, and what does done look like?" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status"><select className="input" value={form.status} onChange={set('status')}>{STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
            <Field label="Priority"><select className="input" value={form.priority} onChange={set('priority')}>{PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
            <Field label="Assignee" error={firstError(errors, 'assigneeId')}>
              <select className="input" value={form.assigneeId} onChange={set('assigneeId')}>
                <option value="">Unassigned</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
            <Field label="Due date" error={firstError(errors, 'dueDate')}><input type="date" className="input" value={form.dueDate} onChange={set('dueDate')} /></Field>
          </div>
          {!isNew && (
            <p className="text-xs text-ink-500">
              Created by {task.creator_name || 'a former member'} on {formatDateTime(task.created_at)} · Last updated {formatDateTime(task.updated_at)}
            </p>
          )}
          <div className="flex items-center gap-2 pt-1">
            {!isNew && canDelete && <button type="button" className="btn btn-ghost !text-rose-600 hover:!bg-rose-50" onClick={remove}><Trash2 size={16} />Delete</button>}
            <button type="button" className="btn btn-secondary ml-auto" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={saving}>{saving && <Spinner className="!text-white" />}{isNew ? 'Create task' : 'Save changes'}</button>
          </div>
        </form>
        {!isNew && <Discussion projectId={projectId} taskId={task.id} />}
      </div>
    </Modal>
  );
}

/** Comments + per-task history. Both update live through the project's socket room. */
function Discussion({ projectId, taskId }) {
  const [tab, setTab] = useState('comments');
  const [comments, setComments] = useState(null);
  const [history, setHistory] = useState(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.get(`/projects/${projectId}/tasks/${taskId}/comments`).then((d) => setComments(d.comments)).catch(() => setComments([]));
    api.get(`/projects/${projectId}/activity?taskId=${taskId}`).then((d) => setHistory(d.activities.reverse())).catch(() => setHistory([]));

    const socket = getSocket();
    const onComment = ({ comment }) => comment.task_id === taskId && setComments((p) => (p?.some((c) => c.id === comment.id) ? p : [...(p || []), comment]));
    const onActivity = (a) => a.task_id === taskId && setHistory((p) => (p?.some((x) => x.id === a.id) ? p : [...(p || []), a]));
    socket.on('comment:created', onComment);
    socket.on('activity:created', onActivity);
    return () => { socket.off('comment:created', onComment); socket.off('activity:created', onActivity); };
  }, [projectId, taskId]);

  async function send(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      const { comment } = await api.post(`/projects/${projectId}/tasks/${taskId}/comments`, { body });
      setComments((p) => (p?.some((c) => c.id === comment.id) ? p : [...(p || []), comment]));
      setBody('');
    } catch (err) { toast.error(err.message); } finally { setSending(false); }
  }

  return (
    <div className="flex min-h-[18rem] flex-col rounded-xl bg-ink-50 p-4">
      <div className="mb-3 flex gap-1 rounded-lg bg-ink-100 p-1" role="tablist">
        {[['comments', `Comments${comments ? ` (${comments.length})` : ''}`], ['history', 'History']].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={clsx('flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors', tab === id ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800')}>{label}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === 'comments' ? (
          comments === null ? <Spinner className="mx-auto mt-6" /> : comments.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-500">No comments yet. Start the conversation below.</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-2.5">
                  <Avatar name={c.user_name || '?'} size="sm" />
                  <div className="min-w-0 flex-1 rounded-lg bg-white p-2.5 shadow-card">
                    <p className="flex items-baseline justify-between gap-2 text-xs"><span className="font-semibold text-ink-900">{c.user_name || 'Former member'}</span><time className="text-ink-400" title={formatDateTime(c.created_at)}>{timeAgo(c.created_at)}</time></p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink-700">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : history === null ? <Spinner className="mx-auto mt-6" /> : <ActivityList items={history} compact />}
      </div>
      {tab === 'comments' && (
        <form onSubmit={send} className="mt-3 flex items-end gap-2">
          <textarea className="input min-h-[42px] flex-1 resize-none" rows={2} value={body} maxLength={2000} placeholder="Write a comment…" aria-label="Write a comment"
            onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && send(e)} />
          <button className="btn btn-primary !p-2.5" disabled={sending || !body.trim()} aria-label="Send comment"><Send size={16} /></button>
        </form>
      )}
    </div>
  );
}
