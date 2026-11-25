import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, LogOut, Menu, FolderKanban } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Avatar, Logo } from './ui';

const linkCls = ({ isActive }) => clsx('flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
  isActive ? 'bg-white/10 text-white' : 'text-ink-300 hover:bg-white/5 hover:text-white');

export default function Layout() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState([]);
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const refresh = useCallback(() => api.get('/projects').then((d) => setProjects(d.projects)).catch(() => {}), []);
  useEffect(() => { refresh(); }, [refresh, location.pathname]);
  useEffect(() => { window.addEventListener('pulse:projects-changed', refresh); return () => window.removeEventListener('pulse:projects-changed', refresh); }, [refresh]);
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen lg:pl-64">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-ink-200 bg-white/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <button className="btn btn-ghost !p-2" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
        <Logo size={26} /><span className="font-display text-lg font-bold">Pulse</span>
      </header>

      {open && <div className="fixed inset-0 z-40 bg-ink-950/50 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={clsx('fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-ink-950 p-3 transition-transform lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex items-center gap-2.5 px-3 py-3"><Logo /><span className="font-display text-xl font-bold text-white">Pulse</span></div>
        <nav className="mt-3 flex-1 space-y-1 overflow-y-auto" aria-label="Main">
          <NavLink to="/" end className={linkCls}><LayoutDashboard size={17} />Dashboard</NavLink>
          <p className="px-3 pb-1 pt-5 text-xs font-semibold text-ink-500">Your projects</p>
          {projects.map((p) => <NavLink key={p.id} to={`/projects/${p.id}`} className={linkCls}><FolderKanban size={17} /><span className="truncate">{p.name}</span></NavLink>)}
          {!projects.length && <p className="px-3 text-sm text-ink-500">No projects yet.</p>}
        </nav>
        <div className="flex items-center gap-3 border-t border-white/10 px-2 pt-3">
          <Avatar name={user.name} className="!ring-ink-950" />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{user.name}</p><p className="truncate text-xs text-ink-400">{user.email}</p></div>
          <button className="btn !p-2 text-ink-400 hover:bg-white/10 hover:text-white" onClick={logout} aria-label="Sign out"><LogOut size={17} /></button>
        </div>
      </aside>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8"><Outlet /></main>
    </div>
  );
}
