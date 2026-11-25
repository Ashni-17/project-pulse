import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FolderPlus, Plus } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Badge, EmptyState, PageLoader, ProgressBar } from '../components/ui';
import { CompletionRing, Stat } from '../components/project/Overview.jsx';
import ProjectFormModal from '../components/project/ProjectFormModal.jsx';
import { STATUSES } from '../lib/constants.js';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { api.get('/dashboard').then(setData).catch((e) => setError(e.message)); }, []);
  if (error) return <p className="rounded-lg bg-rose-50 p-4 text-rose-700">{error}</p>;
  if (!data) return <PageLoader />;
  const { totals, projects } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Hello, {user.name.split(' ')[0]}</h1>
          <p className="text-ink-500">{totals.assignedToMe ? `You have ${totals.assignedToMe} open ${totals.assignedToMe === 1 ? 'task' : 'tasks'} assigned to you.` : 'Nothing is waiting on you right now.'}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} />New project</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <div className="panel flex items-center justify-center p-5"><CompletionRing value={totals.completionRate} /></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
          <Stat label="Projects" value={totals.projects} />
          <Stat label="Total tasks" value={totals.total} />
          <Stat label="Completed" value={totals.completed} tone="text-pulse-700" />
          <Stat label="Overdue" value={totals.overdue} tone={totals.overdue ? 'text-rose-600' : undefined} />
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-xl font-bold">Projects</h2>
        {!projects.length ? (
          <EmptyState icon={FolderPlus} title="Create your first project" text="Projects hold your Kanban board, teammates and activity history."
            action={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} />New project</button>} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => (
              <Link key={p.id} to={`/projects/${p.id}`} className="panel group block p-5 transition-shadow hover:shadow-lift">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-bold group-hover:text-pulse-700">{p.name}</h3>
                  <Badge className={p.role === 'owner' ? 'bg-ink-900 text-white ring-ink-900' : 'bg-ink-50 text-ink-600 ring-ink-200'}>{p.role === 'owner' ? 'Owner' : 'Member'}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-ink-500">{p.description || 'No description yet.'}</p>
                <div className="mt-4 flex justify-between text-sm"><span className="text-ink-500">{p.stats.completed} of {p.stats.total} done</span><span className="font-semibold">{p.stats.completionRate}%</span></div>
                <ProgressBar className="mt-1.5" value={p.stats.completionRate} />
                <div className="mt-3 flex gap-3 text-xs text-ink-500">
                  {STATUSES.map((s) => <span key={s.id} className="inline-flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${s.dot}`} />{p.stats.byStatus[s.id]} {s.label.toLowerCase()}</span>)}
                </div>
                {p.stats.overdue > 0 && <p className="mt-2 text-xs font-semibold text-rose-600">{p.stats.overdue} overdue</p>}
              </Link>
            ))}
          </div>
        )}
      </section>
      {creating && <ProjectFormModal onClose={() => setCreating(false)} onSaved={(p) => { window.dispatchEvent(new Event('pulse:projects-changed')); navigate(`/projects/${p.id}`); }} />}
    </div>
  );
}
