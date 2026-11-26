
import { useEffect, useState } from 'react';
import clsx from 'clsx';

import {
  BarChart3,
  ListTodo,
  CheckCircle2,
  Timer,
  CalendarClock,
  Flag,
  Users,
  TrendingUp,
  UserRound,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

import { api } from '../../lib/api.js';

import {
  PRIORITIES,
  STATUSES,
} from '../../lib/constants.js';

import {
  Avatar,
  PageLoader,
  ProgressBar,
} from '../ui';


// ==========================================
// COMPLETION RING
// Shared with Dashboard
// ==========================================

export function CompletionRing({
  value,
  size = 132,
}) {
  const r = 52;
  const c = 2 * Math.PI * r;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={`${value}% complete`}
    >
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        strokeWidth="10"
        className="stroke-ink-100"
      />

      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        strokeWidth="10"
        strokeLinecap="round"
        className="stroke-pulse-500 transition-all duration-700"
        strokeDasharray={c}
        strokeDashoffset={c - (c * value) / 100}
        transform="rotate(-90 60 60)"
      />

      <text
        x="60"
        y="58"
        textAnchor="middle"
        className="fill-ink-900 font-display text-[26px] font-bold"
      >
        {value}%
      </text>

      <text
        x="60"
        y="76"
        textAnchor="middle"
        className="fill-ink-500 text-[10px]"
      >
        complete
      </text>
    </svg>
  );
}


// ==========================================
// EXISTING SHARED STAT COMPONENT
// Preserved for compatibility
// ==========================================

export const Stat = ({ label, value, tone }) => (
  <div className="panel p-4">

    <p className="text-sm text-ink-500">
      {label}
    </p>

    <p
      className={clsx(
        'mt-1 font-display text-3xl font-bold',
        tone || 'text-ink-900'
      )}
    >
      {value}
    </p>

  </div>
);


// ==========================================
// PREMIUM OVERVIEW STAT CARD
// ==========================================

const TONES = {
  green: {
    icon: 'bg-pulse-100 text-pulse-700',
    value: 'text-pulse-800',
  },

  blue: {
    icon: 'bg-sky-100 text-sky-700',
    value: 'text-sky-700',
  },

  rose: {
    icon: 'bg-rose-100 text-rose-600',
    value: 'text-rose-600',
  },
};


function OverviewStat({
  icon: Icon,
  label,
  value,
  tone = 'green',
}) {
  const colors = TONES[tone];

  return (
    <div className="min-w-0 rounded-2xl border border-ink-200 bg-white p-4 shadow-sm transition-all hover:border-pulse-300 hover:shadow-md sm:p-5">

      <div
        className={clsx(
          'flex h-11 w-11 items-center justify-center rounded-xl',
          colors.icon
        )}
      >
        <Icon size={22} strokeWidth={1.8} />
      </div>

      <p
        className={clsx(
          'mt-4 font-display text-3xl font-bold tabular-nums',
          colors.value
        )}
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
// REUSABLE SECTION HEADING
// ==========================================

function SectionHeading({
  icon: Icon,
  title,
  description,
}) {
  return (
    <div className="mb-5 flex items-center gap-3">

      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pulse-100 text-pulse-700">

        <Icon size={20} strokeWidth={1.8} />

      </div>

      <div className="min-w-0">

        <h3 className="text-sm font-bold text-ink-900">
          {title}
        </h3>

        {description && (
          <p className="mt-0.5 text-xs text-ink-500">
            {description}
          </p>
        )}

      </div>

    </div>
  );
}


// ==========================================
// DISTRIBUTION CHART
// ==========================================

function DistributionCard({
  icon,
  title,
  description,
  items,
  counts,
  total,
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">

      <SectionHeading
        icon={icon}
        title={title}
        description={description}
      />

      <div className="space-y-5">

        {items.map((item) => {
          const count = counts[item.id] ?? 0;

          const percentage = total
            ? (count / total) * 100
            : 0;

          return (
            <div key={item.id}>

              <div className="mb-2 flex items-center justify-between gap-2 text-sm">

                <div className="flex items-center gap-2">

                  <span
                    className={clsx(
                      'h-2.5 w-2.5 rounded-full',
                      item.bar
                    )}
                  />

                  <span className="font-medium text-ink-700">
                    {item.label}
                  </span>

                </div>

                <div className="flex items-center gap-2">

                  <span className="text-xs tabular-nums text-ink-500">
                    {Math.round(percentage)}%
                  </span>

                  <span className="font-bold tabular-nums text-ink-900">
                    {count}
                  </span>

                </div>

              </div>

              <ProgressBar
                value={percentage}
                barClassName={item.bar}
              />

            </div>
          );
        })}

      </div>

    </section>
  );
}


// ==========================================
// PROJECT OVERVIEW
// ==========================================

export default function Overview({
  projectId,
  signature,
}) {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);

  const stats =
    snapshot?.projectId === projectId
      ? snapshot.data
      : null;

  const currentError =
    error?.projectId === projectId
      ? error.message
      : null;


  // Refresh analytics whenever task data changes.
  // Ignore responses from outdated requests.

  useEffect(() => {
    let active = true;

    setError(null);

    api
      .get(`/projects/${projectId}/stats`)
      .then((data) => {
        if (!active) return;

        setSnapshot({
          projectId,
          data,
        });

        setError(null);
      })
      .catch((err) => {
        if (!active) return;

        setError({
          projectId,
          message:
            err.message ||
            'Could not load project analytics.',
        });
      });

    return () => {
      active = false;
    };

  }, [projectId, signature, retry]);


  // Initial loading and error states

  if (!stats && currentError) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-ink-200 bg-white p-8 text-center shadow-sm"
      >

        <AlertCircle
          size={32}
          className="mx-auto mb-3 text-rose-500"
        />

        <h3 className="font-bold text-ink-900">
          Could not load analytics
        </h3>

        <p className="mt-2 text-sm text-ink-500">
          {currentError}
        </p>

        <button
          type="button"
          className="btn btn-primary mt-4"
          onClick={() => setRetry((n) => n + 1)}
        >
          <RefreshCw size={15} />
          Try again
        </button>

      </div>
    );
  }

  if (!stats) return <PageLoader />;


  const max = Math.max(
    1,
    ...stats.workload.map((w) => w.count),
    stats.unassigned
  );

  const remaining = Math.max(
    0,
    stats.total - stats.completed
  );

  const completionRate = Math.min(
    100,
    Math.max(0, stats.completionRate || 0)
  );


  return (
    <div className="min-w-0 space-y-5">


      {/* ==========================================
          LIGHT GREEN OVERVIEW HEADER
          ========================================== */}

      <section className="relative overflow-hidden rounded-2xl border border-pulse-200 bg-[linear-gradient(115deg,#f0fdf7,#dff8ed,#c5f1df)] p-5 shadow-sm sm:p-6">

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border border-pulse-300/40"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-28 -top-36 h-80 w-80 rounded-full border border-pulse-300/30"
        />

        <div className="relative flex flex-wrap items-center justify-between gap-4">

          <div className="flex min-w-0 items-center gap-3">

            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-pulse-700 shadow-sm">

              <BarChart3 size={25} />

            </div>

            <div>

              <h2 className="text-xl font-bold text-pulse-900 sm:text-2xl">
                Project overview
              </h2>

              <p className="mt-1 text-xs leading-relaxed text-pulse-800 sm:text-sm">
                Track progress, performance and team workload.
              </p>

            </div>

          </div>

          <button
            type="button"
            onClick={() => setRetry((n) => n + 1)}
            className="inline-flex items-center gap-2 rounded-lg border border-pulse-200 bg-white/80 px-3 py-2 text-xs font-semibold text-pulse-800 transition-colors hover:bg-white"
          >

            <RefreshCw size={14} />
            Refresh analytics

          </button>

        </div>

      </section>


      {/* Failed refresh: retain previously loaded data */}

      {currentError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
        >

          <AlertCircle size={17} className="shrink-0" />

          <p>
            Analytics could not be refreshed.
            Showing the last loaded statistics.
          </p>

        </div>
      )}


      {/* ==========================================
          PROJECT STATISTICS
          ========================================== */}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">

        <OverviewStat
          icon={ListTodo}
          label="Total tasks"
          value={stats.total}
        />

        <OverviewStat
          icon={CheckCircle2}
          label="Completed"
          value={stats.completed}
        />

        <OverviewStat
          icon={Timer}
          label="In progress"
          value={stats.byStatus.in_progress}
          tone="blue"
        />

        <OverviewStat
          icon={CalendarClock}
          label="Overdue"
          value={stats.overdue}
          tone="rose"
        />

      </div>


      {/* ==========================================
          PROJECT COMPLETION
          ========================================== */}

      <section className="rounded-2xl border border-pulse-200 bg-gradient-to-br from-white via-white to-pulse-50 p-5 shadow-sm sm:p-6">

        <SectionHeading
          icon={TrendingUp}
          title="Project completion"
          description="Overall progress towards your project goals."
        />

        <div className="flex flex-col items-center gap-6 sm:flex-row">

          <div className="shrink-0">

            <CompletionRing
              value={completionRate}
              size={156}
            />

          </div>

          <div className="w-full min-w-0 flex-1">

            <h3 className="text-xl font-bold text-pulse-900">

              {stats.completed} of {stats.total} tasks completed

            </h3>

            <p className="mt-2 text-sm text-ink-500">

              {stats.total === 0
                ? 'Create tasks to start tracking your progress.'
                : remaining === 0
                  ? 'All tasks are completed.'
                  : `${remaining} ${remaining === 1 ? 'task' : 'tasks'} remaining.`}

            </p>

            <div
              role="progressbar"
              aria-label="Project completion"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={completionRate}
              className="mt-5 h-3 overflow-hidden rounded-full bg-pulse-100"
            >

              <div
                className="h-full rounded-full bg-gradient-to-r from-pulse-800 via-pulse-500 to-pulse-400 transition-all duration-700 motion-reduce:transition-none"
                style={{
                  width: `${completionRate}%`,
                }}
              />

            </div>

            <div className="mt-2 flex justify-between text-xs text-ink-500">

              <span>0%</span>

              <span className="font-bold text-pulse-700">
                {completionRate}% complete
              </span>

              <span>100%</span>

            </div>

          </div>

        </div>

      </section>


      {/* ==========================================
          STATUS AND PRIORITY DISTRIBUTION
          ========================================== */}

      <div className="grid gap-4 md:grid-cols-2">

        <DistributionCard
          icon={BarChart3}
          title="Tasks by status"
          description="Track the current stage of your tasks."
          items={STATUSES}
          counts={stats.byStatus}
          total={stats.total}
        />

        <DistributionCard
          icon={Flag}
          title="Tasks by priority"
          description="Understand the distribution of priorities."
          items={PRIORITIES}
          counts={stats.byPriority}
          total={stats.total}
        />

      </div>


      {/* ==========================================
          TEAM WORKLOAD
          ========================================== */}

      <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm sm:p-6">

        <SectionHeading
          icon={Users}
          title="Workload by member"
          description="Compare task allocation across your team."
        />

        <div className="divide-y divide-ink-100">

          {stats.workload.map((w) => (

            <div
              key={w.userId}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-3 py-4 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)_auto] sm:gap-5"
            >

              <div className="flex min-w-0 items-center gap-2.5">

                <div className="shrink-0">

                  <Avatar
                    name={w.name}
                    size="sm"
                  />

                </div>

                <span
                  className="truncate text-sm font-semibold text-ink-700"
                  title={w.name}
                >
                  {w.name}
                </span>

              </div>


              <div
                role="progressbar"
                aria-label={`Task allocation for ${w.name}`}
                aria-valuemin={0}
                aria-valuemax={max}
                aria-valuenow={w.count}
                className="h-2.5 overflow-hidden rounded-full bg-pulse-50"
              >

                <div
                  className="h-full rounded-full bg-gradient-to-r from-pulse-800 to-pulse-400 transition-all duration-500 motion-reduce:transition-none"
                  style={{
                    width: `${(w.count / max) * 100}%`,
                  }}
                />

              </div>

              <span className="min-w-[28px] rounded-lg bg-pulse-50 px-2 py-1 text-center text-sm font-bold tabular-nums text-pulse-800">

                {w.count}

              </span>

            </div>

          ))}


          {/* Unassigned tasks */}

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-3 py-4 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)_auto] sm:gap-5">

            <div className="flex min-w-0 items-center gap-2.5">

              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-500">

                <UserRound size={15} />

              </div>

              <span className="truncate text-sm font-medium text-ink-500">
                Unassigned
              </span>

            </div>

            <ProgressBar
              value={(stats.unassigned / max) * 100}
              barClassName="bg-ink-300"
            />

            <span className="min-w-[28px] rounded-lg bg-ink-100 px-2 py-1 text-center text-sm font-bold tabular-nums text-ink-600">

              {stats.unassigned}

            </span>

          </div>

        </div>

        <p className="mt-3 border-t border-ink-100 pt-3 text-xs leading-relaxed text-ink-500">

          Workload bars compare task counts against the
          highest allocation shown above.

        </p>

      </section>

    </div>
  );
}
