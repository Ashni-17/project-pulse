import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Activity, BarChart3, KanbanSquare, Plus, SearchX, Settings, Users, WifiOff } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useProjectSocket } from '../hooks/useProjectSocket.js';
import { Avatar, EmptyState, PageLoader } from '../components/ui';
import Board from '../components/board/Board.jsx';
import FilterBar, { EMPTY_FILTERS } from '../components/board/FilterBar.jsx';
import TaskModal from '../components/board/TaskModal.jsx';
import Overview from '../components/project/Overview.jsx';
import MembersPanel from '../components/project/MembersPanel.jsx';
import ActivityList from '../components/project/ActivityList.jsx';
import ProjectFormModal from '../components/project/ProjectFormModal.jsx';

const TABS = [['board', 'Board', KanbanSquare], ['overview', 'Overview', BarChart3], ['activity', 'Activity', Activity], ['members', 'Members', Users]];
const upsertMany = (list, incoming) => {
  const byId = new Map(list.map((t) => [t.id, t]));
  incoming.forEach((t) => byId.set(t.id, { ...byId.get(t.id), ...t }));
  return [...byId.values()];
};

export default function ProjectPage() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [state, setState] = useState('loading');
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activity, setActivity] = useState([]);
  const [tab, setTab] = useState('board');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [modal, setModal] = useState(null); // { taskId } | { status }
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const base = `/projects/${projectId}`;
      const [p, m, t, a] = await Promise.all([api.get(base), api.get(`${base}/members`), api.get(`${base}/tasks`), api.get(`${base}/activity?limit=100`)]);
      setProject(p.project); setMembers(m.members); setTasks(t.tasks); setActivity(a.activities);
      setState('ready');
    } catch (err) { setState(err.status === 404 ? 'missing' : 'error'); }
  }, [projectId]);

  useEffect(() => { setState('loading'); setFilters(EMPTY_FILTERS); setTab('board'); load(); }, [load]);

  const leave = useCallback((message) => { toast.error(message); window.dispatchEvent(new Event('pulse:projects-changed')); navigate('/'); }, [navigate, toast]);

  // Live updates: every handler is idempotent, so our own echoed events are harmless.
  const online = useProjectSocket(projectId, {
    'tasks:upsert': ({ tasks: incoming }) => setTasks((prev) => upsertMany(prev, incoming)),
    'task:deleted': ({ id }) => { setTasks((prev) => prev.filter((t) => t.id !== id)); setModal((m) => (m?.taskId === id ? null : m)); },
    'activity:created': (a) => setActivity((prev) => (prev.some((x) => x.id === a.id) ? prev : [a, ...prev])),
    'member:added': ({ member }) => setMembers((prev) => (prev.some((m) => m.id === member.id) ? prev : [...prev, member])),
    'member:removed': ({ userId }) => (userId === user.id ? leave('You were removed from that project') : setMembers((prev) => prev.filter((m) => m.id !== userId))),
    'project:updated': ({ project: p }) => { setProject((prev) => ({ ...prev, ...p })); window.dispatchEvent(new Event('pulse:projects-changed')); },
    'project:deleted': () => leave('This project was deleted by its owner'),
    'project:refresh': load,
    onResync: load,
  });

  const isOwner = project?.role === 'owner';

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return tasks.filter((t) => (!q || t.title.toLowerCase().includes(q)) && (!filters.status || t.status === filters.status)
      && (!filters.priority || t.priority === filters.priority)
      && (!filters.assignee || (filters.assignee === 'none' ? !t.assignee_id : t.assignee_id === filters.assignee)));
  }, [tasks, filters]);
  const filtersActive = Object.values(filters).some(Boolean);

  /** Optimistic drag-and-drop: update the UI immediately, persist, and fall back to the server's state on failure. */
  async function handleMove(id, status, index, nextCols) {
    setTasks((prev) => {
      const placed = new Map(Object.entries(nextCols).flatMap(([col, list]) => list.map((t, i) => [t.id, { status: col, position: i }])));
      return prev.map((t) => (placed.has(t.id) ? { ...t, ...placed.get(t.id) } : t));
    });
    try {
      const { tasks: updated } = await api.patch(`/projects/${projectId}/tasks/${id}/move`, { status, index });
      setTasks((prev) => upsertMany(prev, updated));
    } catch (err) { toast.error(`Couldn’t move the task. ${err.message}`); load(); }
  }

  if (state === 'loading') return <PageLoader />;
  if (state !== 'ready') {
    return (
      <EmptyState icon={state === 'missing' ? SearchX : WifiOff} title={state === 'missing' ? 'Project not found' : 'Couldn’t load this project'}
        text={state === 'missing' ? 'It may have been deleted, or you might not be a member.' : 'Check your connection and try again.'}
        action={state === 'missing' ? <Link className="btn btn-primary" to="/">Back to dashboard</Link> : <button className="btn btn-primary" onClick={load}>Retry</button>} />
    );
  }

  const editing = modal?.taskId ? tasks.find((t) => t.id === modal.taskId) : null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-bold">{project.name}</h1>
          {project.description && <p className="mt-1 max-w-2xl text-ink-500">{project.description}</p>}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2" aria-label={`${online.length} online`} title={`Online: ${online.map((u) => u.name).join(', ')}`}>
            {online.slice(0, 5).map((u) => <Avatar key={u.id} name={u.name} size="sm" />)}
          </div>
          {isOwner && <button className="btn btn-secondary" onClick={() => setSettingsOpen(true)}><Settings size={16} />Settings</button>}
          <button className="btn btn-primary" onClick={() => setModal({ status: 'todo' })}><Plus size={16} />New task</button>
        </div>
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-ink-200" role="tablist">
        {TABS.map(([id, label, Icon]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={clsx('-mb-px inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors', tab === id ? 'border-pulse-600 text-ink-900' : 'border-transparent text-ink-500 hover:text-ink-800')}>
            <Icon size={16} />{label}
          </button>
        ))}
      </div>

      {tab === 'board' && (
        <>
          <FilterBar filters={filters} onChange={setFilters} members={members} resultCount={filtered.length} total={tasks.length} />
          {filtersActive && !!filtered.length && <p className="mb-3 text-sm text-ink-500">Dragging is paused while filters are on. Clear them to reorder cards.</p>}
          {filtersActive && !filtered.length ? (
            <EmptyState icon={SearchX} title="No tasks match your filters" text="Try a different search term or clear the filters."
              action={<button className="btn btn-secondary" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</button>} />
          ) : (
            <Board tasks={filtered} dragDisabled={filtersActive} onMove={handleMove} onOpen={(taskId) => setModal({ taskId })} onCreate={(status) => setModal({ status })} />
          )}
        </>
      )}
      {tab === 'overview' && <Overview projectId={projectId} signature={tasks.map((t) => `${t.id}${t.status}${t.priority}${t.assignee_id}${t.due_date}`).join('|')} />}
      {tab === 'activity' && <div className="panel mx-auto max-w-2xl p-5"><h2 className="mb-4 text-lg font-bold">Latest activity</h2><ActivityList items={activity} /></div>}
      {tab === 'members' && (
        <MembersPanel projectId={projectId} members={members} online={online} isOwner={isOwner}
          onAdded={(m) => setMembers((p) => (p.some((x) => x.id === m.id) ? p : [...p, m]))}
          onRemoved={(id) => { setMembers((p) => p.filter((m) => m.id !== id)); load(); }} />
      )}

      {modal && (
        <TaskModal key={modal.taskId || 'new'} projectId={projectId} task={editing} defaultStatus={modal.status} members={members}
          canDelete={isOwner || editing?.created_by === user.id} onClose={() => setModal(null)}
          onUpsert={(list) => setTasks((p) => upsertMany(p, list))} onDelete={(id) => setTasks((p) => p.filter((t) => t.id !== id))} />
      )}
      {settingsOpen && (
        <ProjectFormModal project={project} onClose={() => setSettingsOpen(false)}
          onSaved={(p) => { setProject((prev) => ({ ...prev, ...p })); setSettingsOpen(false); window.dispatchEvent(new Event('pulse:projects-changed')); }}
          onDeleted={() => { window.dispatchEvent(new Event('pulse:projects-changed')); navigate('/'); }} />
      )}
    </div>
  );
}
