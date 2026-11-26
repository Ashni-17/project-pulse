
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  FolderPlus,
  FolderKanban,
  FolderOpen,
  Plus,
  ListTodo,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  TrendingUp,
  LayoutDashboard,
} from 'lucide-react';

import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

import {
  Badge,
  EmptyState,
  PageLoader,
} from '../components/ui';

import {
  CompletionRing,
} from '../components/project/Overview.jsx';

import ProjectFormModal from '../components/project/ProjectFormModal.jsx';

import { STATUSES } from '../lib/constants.js';

// ==========================================
// PREMIUM STATISTICS CARD
// ==========================================

function DashboardStat({
  icon: Icon,
  label,
  value,
  tone = 'green',
}) {
  const tones = {
    green: {
      icon: 'bg-pulse-100 text-pulse-700',
      value: 'text-pulse-700',
    },

    blue: {
      icon: 'bg-sky-100 text-sky-600',
      value: 'text-ink-900',
    },

    purple: {
      icon: 'bg-violet-100 text-violet-600',
      value: 'text-ink-900',
    },

    red: {
      icon: 'bg-rose-100 text-rose-600',
      value: 'text-rose-600',
    },

    neutral: {
      icon: 'bg-rose-50 text-rose-500',
      value: 'text-ink-900',
    },
  };

  const style = tones[tone] || tones.green;

  return (
    <div className="group rounded-2xl border border-ink-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-pulse-200 hover:shadow-lift motion-reduce:transform-none motion-reduce:transition-none sm:p-5">

      <div
        className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${style.icon}`}
      >
        <Icon size={22} strokeWidth={1.8} />
      </div>

      <p
        className={`text-3xl font-bold tracking-tight ${style.value}`}
      >
        {value}
      </p>

      <p className="mt-1 text-sm font-medium text-ink-500">
        {label}
      </p>

    </div>
  );
}

// ==========================================
// GRADIENT PROGRESS BAR
// ==========================================

function GradientProgress({ value = 0 }) {
  const percentage = Math.min(
    100,
    Math.max(0, Number(value) || 0)
  );

  return (
    <div
      role="progressbar"
      aria-label="Task completion"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentage}
      className="h-2.5 overflow-hidden rounded-full bg-pulse-50"
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-pulse-700 via-pulse-500 to-pulse-400 transition-all duration-500 motion-reduce:transition-none"
        style={{
          width: `${percentage}%`,
        }}
      />
    </div>
  );
}

// ==========================================
// PREMIUM PROJECT CARD
// ==========================================

function DashboardProjectCard({ project }) {
  const p = project;

  return (
    <Link
      to={`/projects/${p.id}`}
      className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-pulse-300 hover:shadow-lift motion-reduce:transform-none motion-reduce:transition-none"
    >

      {/* Decorative top accent */}

      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-pulse-800 via-pulse-500 to-pulse-300 opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none"
      />

      {/* Project icon and role */}

      <div className="flex items-start justify-between gap-3">

        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pulse-100 to-pulse-50 text-pulse-700">
          <FolderKanban size={24} strokeWidth={1.8} />
        </div>

        <Badge
          className={
            p.role === 'owner'
              ? 'bg-pulse-100 text-pulse-800 ring-pulse-200'
              : 'bg-ink-50 text-ink-600 ring-ink-200'
          }
        >
          {p.role === 'owner' ? 'Owner' : 'Member'}
        </Badge>

      </div>

      {/* Project name and description */}

      <div className="mt-4">

        <h3 className="break-words text-lg font-bold text-ink-900 transition-colors group-hover:text-pulse-700">
          {p.name}
        </h3>

        <p className="mt-2 line-clamp-2 min-h-[2.5rem] break-words text-sm leading-relaxed text-ink-500">
          {p.description || 'No description yet.'}
        </p>

      </div>

      {/* Project completion */}

      <div className="mt-5">

        <div className="mb-2 flex items-center justify-between gap-2 text-sm">

          <span className="text-ink-500">
            {p.stats.completed} of {p.stats.total} done
          </span>

          <span className="font-bold text-pulse-700">
            {p.stats.completionRate}%
          </span>

        </div>

        <GradientProgress
          value={p.stats.completionRate}
        />

      </div>

      {/* Task status breakdown */}

      <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2 text-xs text-ink-500">

        {STATUSES.map((status) => (
          <span
            key={status.id}
            className="inline-flex items-center gap-1.5"
          >

            <span
              className={`h-2 w-2 shrink-0 rounded-full ${status.dot}`}
            />

            {p.stats.byStatus[status.id]}{' '}
            {status.label.toLowerCase()}

          </span>
        ))}

      </div>

      {/* Overdue tasks */}

      {p.stats.overdue > 0 && (
        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">

          <Clock size={14} />

          {p.stats.overdue}{' '}
          {p.stats.overdue === 1
            ? 'overdue task'
            : 'overdue tasks'}

        </div>
      )}

      {/* Project navigation */}

      <div className="mt-auto pt-5">

        <div className="flex items-center justify-between border-t border-ink-100 pt-4">

          <span className="text-sm font-semibold text-pulse-700">
            Open project
          </span>

          <ArrowUpRight
            size={18}
            className="text-pulse-600 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none"
          />

        </div>

      </div>

    </Link>
  );
}

// ==========================================
// DASHBOARD
// ==========================================

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  // ==========================================
  // LOAD DASHBOARD DATA
  // ==========================================

  useEffect(() => {
    let active = true;

    api
      .get('/dashboard')
      .then((response) => {
        if (active) {
          setData(response);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700"
      >
        {error}
      </p>
    );
  }

  if (!data) {
    return <PageLoader />;
  }

  const { totals, projects } = data;

  const firstName =
    user?.name?.trim().split(/\s+/)[0] || 'there';

  const pending = Math.max(
    0,
    totals.total - totals.completed
  );

  // ==========================================
  // USER INTERFACE
  // ==========================================

  return (
    <div className="space-y-6 pb-4">

      {/* ==========================================
          PREMIUM WELCOME BANNER
          ========================================== */}

      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pulse-900 via-pulse-800 to-pulse-600 p-6 text-white shadow-lg sm:p-8">

        {/* Decorative background circles */}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-28 h-72 w-72 rounded-full border border-white/10"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-28 -top-40 h-96 w-96 rounded-full border border-white/10"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 right-20 h-64 w-64 rounded-full bg-white/5"
        />

        {/* Welcome content */}

        <div className="relative flex flex-wrap items-center justify-between gap-6">

          <div className="min-w-0">

            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-pulse-200">

              <LayoutDashboard size={15} />

              Your workspace

            </div>

            <h1 className="break-words text-3xl font-bold tracking-tight sm:text-4xl">
              Hello, {firstName}
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-relaxed text-pulse-100 sm:text-base">

              {totals.assignedToMe
                ? `You have ${totals.assignedToMe} open ${
                    totals.assignedToMe === 1
                      ? 'task'
                      : 'tasks'
                  } assigned to you.`
                : 'Nothing is waiting on you right now.'}

            </p>

          </div>

          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-pulse-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-pulse-50 hover:shadow-lg motion-reduce:transform-none motion-reduce:transition-none"
          >

            <Plus size={19} />

            New project

          </button>

        </div>

      </section>

      {/* ==========================================
          DASHBOARD STATISTICS
          ========================================== */}

      <section
        aria-label="Dashboard statistics"
        className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"
      >

        <DashboardStat
          icon={FolderOpen}
          label="Projects"
          value={totals.projects}
          tone="green"
        />

        <DashboardStat
          icon={ListTodo}
          label="Total tasks"
          value={totals.total}
          tone="blue"
        />

        <DashboardStat
          icon={CheckCircle2}
          label="Completed"
          value={totals.completed}
          tone="green"
        />

        <DashboardStat
          icon={Clock}
          label="Overdue"
          value={totals.overdue}
          tone={totals.overdue ? 'red' : 'neutral'}
        />

      </section>

      {/* ==========================================
          OVERALL PROJECT PROGRESS
          ========================================== */}

      <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm sm:p-6">

        <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">

          {/* Existing completion ring */}

          <div className="shrink-0">
            <CompletionRing
              value={totals.completionRate}
            />
          </div>

          {/* Overall progress information */}

          <div className="w-full min-w-0 flex-1">

            <div className="mb-2 flex items-center gap-2">

              <TrendingUp
                size={21}
                className="shrink-0 text-pulse-600"
              />

              <h2 className="text-lg font-bold text-ink-900 sm:text-xl">
                Overall project progress
              </h2>

            </div>

            <p className="text-sm leading-relaxed text-ink-500">

              {totals.completed} of {totals.total}{' '}
              tasks completed across your projects.

            </p>

            <div className="mt-5">

              <GradientProgress
                value={totals.completionRate}
              />

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">

                <span className="text-sm text-ink-500">
                  {pending}{' '}
                  {pending === 1
                    ? 'pending task'
                    : 'pending tasks'}
                </span>

                <span className="text-sm font-bold text-pulse-700">
                  {totals.completionRate}% completed
                </span>

              </div>

            </div>

          </div>

        </div>

      </section>

      {/* ==========================================
          PROJECTS SECTION
          ========================================== */}

      <section>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">

          <div>

            <h2 className="text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">
              Your projects
            </h2>

            <p className="mt-1 text-sm text-ink-500">
              Manage and track your team's work.
            </p>

          </div>

          <span className="rounded-full border border-pulse-200 bg-pulse-50 px-3 py-1.5 text-xs font-semibold text-pulse-700">

            {projects.length}{' '}
            {projects.length === 1
              ? 'project'
              : 'projects'}

          </span>

        </div>

        {/* Empty project state */}

        {!projects.length ? (

          <EmptyState
            icon={FolderPlus}
            title="Create your first project"
            text="Projects hold your Kanban board, teammates and activity history."
            action={
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setCreating(true)}
              >

                <Plus size={16} />

                New project

              </button>
            }
          />

        ) : (

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">

            {/* Existing projects */}

            {projects.map((project) => (
              <DashboardProjectCard
                key={project.id}
                project={project}
              />
            ))}

            {/* Create new project card */}

            <button
              type="button"
              onClick={() => setCreating(true)}
              className="group flex min-h-[260px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-pulse-200 bg-gradient-to-br from-white to-pulse-50/60 p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:border-pulse-400 hover:shadow-lift motion-reduce:transform-none motion-reduce:transition-none"
            >

              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-pulse-100 text-pulse-700 transition-all duration-300 group-hover:scale-110 group-hover:bg-pulse-600 group-hover:text-white motion-reduce:transform-none motion-reduce:transition-none">

                <Plus size={28} strokeWidth={1.8} />

              </div>

              <h3 className="text-base font-bold text-pulse-800">
                Create new project
              </h3>

              <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-500">
                Start something great together.
              </p>

            </button>

          </div>

        )}

      </section>

      {/* ==========================================
          EXISTING PROJECT CREATION MODAL
          ========================================== */}

      {creating && (

        <ProjectFormModal
          onClose={() => setCreating(false)}
          onSaved={(project) => {

            window.dispatchEvent(
              new Event('pulse:projects-changed')
            );

            navigate(`/projects/${project.id}`);

          }}
        />

      )}

    </div>
  );
}
