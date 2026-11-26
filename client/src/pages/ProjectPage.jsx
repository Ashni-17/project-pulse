
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Link,
  useNavigate,
  useParams,
} from 'react-router-dom';

import {
  Activity,
  BarChart3,
  KanbanSquare,
  Plus,
  SearchX,
  Settings,
  Users,
  WifiOff,
  Sparkles,
  LayoutDashboard,
  ChevronRight,
  ShieldCheck,
  ListTodo,
  CircleDashed,
  Timer,
  CheckCircle2,
  Info,
} from 'lucide-react';

import clsx from 'clsx';

import { api } from '../lib/api.js';

import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

import { useProjectSocket } from '../hooks/useProjectSocket.js';

import {
  Avatar,
  EmptyState,
  PageLoader,
} from '../components/ui';

import Board from '../components/board/Board.jsx';

import FilterBar, {
  EMPTY_FILTERS,
} from '../components/board/FilterBar.jsx';

import TaskModal from '../components/board/TaskModal.jsx';

import Overview from '../components/project/Overview.jsx';

import MembersPanel from '../components/project/MembersPanel.jsx';

import ActivityList from '../components/project/ActivityList.jsx';

import ProjectFormModal from '../components/project/ProjectFormModal.jsx';

import PulseAI from '../components/ai/PulseAI.jsx';


// ==========================================
// PROJECT NAVIGATION TABS
// ==========================================

const TABS = [
  ['board', 'Board', KanbanSquare],
  ['overview', 'Overview', BarChart3],
  ['activity', 'Activity', Activity],
  ['members', 'Members', Users],
  ['ai', 'Pulse AI', Sparkles],
];


// ==========================================
// MERGE TASK UPDATES
// ==========================================

const upsertMany = (list, incoming) => {
  const byId = new Map(
    list.map((task) => [task.id, task])
  );

  incoming.forEach((task) => {
    byId.set(task.id, {
      ...byId.get(task.id),
      ...task,
    });
  });

  return [...byId.values()];
};


// ==========================================
// PREMIUM PROJECT STAT CARD
// ==========================================

function ProjectStat({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div className="min-w-0 rounded-xl border border-pulse-200/80 bg-white/70 p-3 shadow-sm backdrop-blur-sm transition-colors hover:bg-white sm:p-4">

      <div className="flex items-center justify-between gap-2">

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pulse-100 text-pulse-700">

          <Icon
            size={18}
            strokeWidth={1.8}
          />

        </div>

        <span className="text-2xl font-bold tabular-nums text-pulse-900">
          {value}
        </span>

      </div>

      <p className="mt-3 text-xs font-medium text-pulse-800 sm:text-sm">
        {label}
      </p>

    </div>
  );
}



// ==========================================
// PREMIUM PROJECT HEADER
// ==========================================


function ProjectHeader({
  project,
  members,
  online,
  stats,
  isOwner,
  onSettings,
  onCreateTask,
}) {
  return (
    <section className="relative mb-5 overflow-hidden rounded-2xl border border-pulse-200 bg-[linear-gradient(115deg,#f0fdf7,#dff8ed,#c5f1df)] p-5 text-pulse-900 shadow-sm sm:p-7">


      {/* Decorative background */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full border border-pulse-300/30"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-36 -top-44 h-96 w-96 rounded-full border border-pulse-300/20"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-white/30"
      />


      <div className="relative">


        {/* ==========================================
            BREADCRUMB AND PROJECT ROLE
            ========================================== */}

        <div className="flex flex-wrap items-center justify-between gap-3">

          <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-pulse-700">

            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-md transition-colors hover:text-pulse-900"
            >

              <LayoutDashboard size={14} />

              Dashboard

            </Link>

            <ChevronRight
              size={13}
              aria-hidden="true"
            />

            <span className="text-pulse-800">
              Project workspace
            </span>

          </div>


          <span className="inline-flex items-center gap-1.5 rounded-lg border border-pulse-200 bg-white/70 px-2.5 py-1.5 text-xs font-semibold text-pulse-800">

            {isOwner ? (
              <ShieldCheck size={15} />
            ) : (
              <Users size={15} />
            )}

            {isOwner
              ? 'Project owner'
              : 'Project member'}

          </span>

        </div>

        <div className="mt-6 flex flex-wrap items-start justify-between gap-5">

         <div className="w-full min-w-0 xl:flex-1">

            <h1 className="break-words text-2xl font-bold tracking-tight text-pulse-900 sm:text-3xl">

              {project.name}

            </h1>

            <p className="mt-2 max-w-2xl break-words text-sm leading-relaxed text-pulse-800">

              {project.description ||
                'Manage tasks, collaborate with your team and track project progress.'}

            </p>

          </div>


          <div
  className={clsx(
    'grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center xl:shrink-0',
    isOwner ? 'grid-cols-2' : 'grid-cols-1'
  )}
>

            {isOwner && (

              <button
                type="button"
                onClick={onSettings}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-pulse-200 bg-white/80 px-3.5 py-2.5 text-sm font-semibold text-pulse-800 shadow-sm transition-colors hover:border-pulse-400 hover:bg-white"
              >

                <Settings
                  size={17}
                  strokeWidth={1.8}
                />

                Settings

              </button>

            )}


            <button
              type="button"
              onClick={onCreateTask}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pulse-800 to-pulse-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:transform-none"
            >

              <Plus
                size={18}
                strokeWidth={2.2}
              />

              New task

            </button>

          </div>

        </div>


        {/* ==========================================
            LIVE PROJECT STATISTICS
            ========================================== */}

        <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">

          <ProjectStat
            icon={ListTodo}
            label="Total tasks"
            value={stats.total}
          />

          <ProjectStat
            icon={CircleDashed}
            label="To do"
            value={stats.todo}
          />

          <ProjectStat
            icon={Timer}
            label="In progress"
            value={stats.inProgress}
          />

          <ProjectStat
            icon={CheckCircle2}
            label="Completed"
            value={stats.completed}
          />

        </div>


        {/* ==========================================
            PROJECT COMPLETION PROGRESS
            ========================================== */}

        <div className="mt-4 rounded-xl border border-pulse-200 bg-white/60 p-4 shadow-sm">

          <div className="flex items-center justify-between gap-3">

            <div>

              <p className="text-sm font-semibold text-pulse-900">
                Project completion
              </p>

              <p className="mt-1 text-xs text-pulse-700">

                {stats.completed} of {stats.total} tasks completed

              </p>

            </div>

            <span className="text-2xl font-bold tabular-nums text-pulse-700">

              {stats.completionRate}%

            </span>

          </div>


          <div
            role="progressbar"
            aria-label="Project completion"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={stats.completionRate}
            className="mt-4 h-2.5 overflow-hidden rounded-full bg-pulse-200/70"
          >

            <div
              className="h-full rounded-full bg-gradient-to-r from-pulse-700 via-pulse-500 to-pulse-400 transition-all duration-500 motion-reduce:transition-none"
              style={{
                width: `${stats.completionRate}%`,
              }}
            />

          </div>

        </div>


        {/* ==========================================
            TEAM MEMBERS AND ONLINE PRESENCE
            ========================================== */}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">

          <div className="flex min-w-0 items-center gap-3">

            <div
              className="flex shrink-0 -space-x-2"
              aria-label={`${members.length} team members`}
            >

              {members.slice(0, 5).map((member) => (

                <Avatar
                  key={member.id}
                  name={member.name}
                  size="sm"
                  className="!ring-pulse-100"
                />

              ))}


              {members.length > 5 && (

                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[10px] font-bold text-pulse-800 ring-2 ring-pulse-200">

                  +{members.length - 5}

                </span>

              )}

            </div>

            <span className="text-xs font-medium text-pulse-800">

              {members.length} team{' '}

              {members.length === 1
                ? 'member'
                : 'members'}

            </span>

          </div>


          <div
            className="inline-flex items-center gap-2 rounded-lg border border-pulse-200 bg-white/70 px-3 py-2 shadow-sm"
            title={
              online.length
                ? `Online: ${online
                    .map((member) => member.name)
                    .join(', ')}`
                : 'No members currently reported online'
            }
          >

            <span className="relative flex h-2 w-2 shrink-0">

              {online.length > 0 && (

                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pulse-500 opacity-60 motion-reduce:animate-none" />

              )}

              <span
                className={clsx(
                  'relative inline-flex h-2 w-2 rounded-full',

                  online.length > 0
                    ? 'bg-pulse-500'
                    : 'bg-slate-400'
                )}
              />

            </span>

            <span className="text-xs font-semibold text-pulse-800">

              {online.length} online

            </span>

          </div>

        </div>

      </div>

    </section>
  );
}


// ==========================================
// MAIN PROJECT PAGE
// ==========================================

export default function ProjectPage() {
  const { projectId } = useParams();

  const activeProjectRef = useRef(null);

  useLayoutEffect(() => {
    activeProjectRef.current = projectId;

    return () => {
      activeProjectRef.current = null;
    };
  }, [projectId]);


  const { user } = useAuth();

  const navigate = useNavigate();

  const toast = useToast();


  // ==========================================
  // PROJECT STATE
  // ==========================================

  const [state, setState] = useState('loading');

  const [project, setProject] = useState(null);

  const [members, setMembers] = useState([]);

  const [tasks, setTasks] = useState([]);

  const [activity, setActivity] = useState([]);

  const [tab, setTab] = useState('board');

  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const [modal, setModal] = useState(null);

  const [settingsOpen, setSettingsOpen] = useState(false);


  // ==========================================
  // LOAD PROJECT DATA
  // ==========================================

  const load = useCallback(async () => {
    try {
      const base = `/projects/${projectId}`;

      const [p, m, t, a] = await Promise.all([
        api.get(base),

        api.get(`${base}/members`),

        api.get(`${base}/tasks`),

        api.get(`${base}/activity?limit=100`),
      ]);


      // Ignore responses belonging to another project.

      if (activeProjectRef.current !== projectId) {
        return;
      }

      setProject(p.project);
      setMembers(m.members);
      setTasks(t.tasks);
      setActivity(a.activities);

      setState('ready');

    } catch (err) {

      if (activeProjectRef.current !== projectId) {
        return;
      }

      setState(
        err.status === 404
          ? 'missing'
          : 'error'
      );
    }
  }, [projectId]);


  useEffect(() => {
    setState('loading');

    setFilters(EMPTY_FILTERS);

    setTab('board');

    setModal(null);

    setSettingsOpen(false);

    load();

  }, [load]);


  // ==========================================
  // LEAVE PROJECT
  // ==========================================

  const leave = useCallback(
    (message) => {

      toast.error(message);

      window.dispatchEvent(
        new Event('pulse:projects-changed')
      );

      navigate('/');

    },
    [navigate, toast]
  );


  // ==========================================
  // REAL-TIME SOCKET COLLABORATION
  // ==========================================

  const online = useProjectSocket(projectId, {

    'tasks:upsert': ({ tasks: incoming }) => {

      setTasks((previous) =>
        upsertMany(previous, incoming)
      );

    },


    'task:deleted': ({ id }) => {

      setTasks((previous) =>
        previous.filter((task) => task.id !== id)
      );

      setModal((current) =>
        current?.taskId === id
          ? null
          : current
      );

    },


    'activity:created': (item) => {

      setActivity((previous) =>
        previous.some(
          (existing) => existing.id === item.id
        )
          ? previous
          : [item, ...previous]
      );

    },


    'member:added': ({ member }) => {

      setMembers((previous) =>
        previous.some(
          (existing) => existing.id === member.id
        )
          ? previous
          : [...previous, member]
      );

    },


    'member:removed': ({ userId }) => {

      if (userId === user.id) {

        leave('You were removed from that project');

      } else {

        setMembers((previous) =>
          previous.filter(
            (member) => member.id !== userId
          )
        );

      }

    },


    'project:updated': ({ project: updated }) => {

      setProject((previous) => ({
        ...previous,
        ...updated,
      }));

      window.dispatchEvent(
        new Event('pulse:projects-changed')
      );

    },


    'project:deleted': () => {

      leave('This project was deleted by its owner');

    },


    'project:refresh': load,

    onResync: load,

  });


  // ==========================================
  // PROJECT ROLE
  // ==========================================

  const isOwner = project?.role === 'owner';


  // ==========================================
  // DYNAMIC PROJECT STATISTICS
  // ==========================================

  const stats = useMemo(() => {

    const total = tasks.length;

    const todo = tasks.filter(
      (task) => task.status === 'todo'
    ).length;

    const inProgress = tasks.filter(
      (task) => task.status === 'in_progress'
    ).length;

    const completed = tasks.filter(
      (task) => task.status === 'done'
    ).length;

    const completionRate =
      total > 0
        ? Math.round((completed / total) * 100)
        : 0;

    return {
      total,
      todo,
      inProgress,
      completed,
      completionRate,
    };

  }, [tasks]);


  // ==========================================
  // TASK SEARCH AND FILTERING
  // ==========================================

  const filtered = useMemo(() => {

    const q = filters.q.trim().toLowerCase();

    return tasks.filter(
      (task) =>

        (!q ||
          task.title.toLowerCase().includes(q)) &&

        (!filters.status ||
          task.status === filters.status) &&

        (!filters.priority ||
          task.priority === filters.priority) &&

        (!filters.assignee ||
          (
            filters.assignee === 'none'
              ? !task.assignee_id
              : task.assignee_id === filters.assignee
          ))
    );

  }, [tasks, filters]);


  const filtersActive =
    Object.values(filters).some(Boolean);


  // ==========================================
  // OPTIMISTIC DRAG AND DROP
  // ==========================================

  async function handleMove(
    id,
    status,
    index,
    nextCols
  ) {

    setTasks((previous) => {

      const placed = new Map(
        Object.entries(nextCols).flatMap(
          ([column, list]) =>
            list.map((task, i) => [
              task.id,
              {
                status: column,
                position: i,
              },
            ])
        )
      );

      return previous.map((task) =>
        placed.has(task.id)
          ? {
              ...task,
              ...placed.get(task.id),
            }
          : task
      );

    });


    try {

      const { tasks: updated } = await api.patch(
        `/projects/${projectId}/tasks/${id}/move`,
        {
          status,
          index,
        }
      );


      if (activeProjectRef.current !== projectId) {
        return;
      }

      setTasks((previous) =>
        upsertMany(previous, updated)
      );

    } catch (err) {

      if (activeProjectRef.current !== projectId) {
        return;
      }

      toast.error(
        `Couldn’t move the task. ${err.message}`
      );

      load();

    }
  }


  // ==========================================
  // LOADING AND ERROR STATES
  // ==========================================

  if (
    state === 'loading' ||
    (
      state === 'ready' &&
      project?.id !== projectId
    )
  ) {
    return <PageLoader />;
  }


  if (state !== 'ready') {

    return (
      <EmptyState

        icon={
          state === 'missing'
            ? SearchX
            : WifiOff
        }

        title={
          state === 'missing'
            ? 'Project not found'
            : 'Couldn’t load this project'
        }

        text={
          state === 'missing'
            ? 'It may have been deleted, or you might not be a member.'
            : 'Check your connection and try again.'
        }

        action={
          state === 'missing' ? (

            <Link
              className="btn btn-primary"
              to="/"
            >
              Back to dashboard
            </Link>

          ) : (

            <button
              type="button"
              className="btn btn-primary"
              onClick={load}
            >
              Retry
            </button>

          )
        }

      />
    );
  }


  const editing = modal?.taskId
    ? tasks.find(
        (task) => task.id === modal.taskId
      )
    : null;


  // ==========================================
  // PROJECT WORKSPACE UI
  // ==========================================

  return (
    <div className="min-w-0">


      {/* ==========================================
          PREMIUM PROJECT HERO
          ========================================== */}

      <ProjectHeader
        project={project}
        members={members}
        online={online}
        stats={stats}
        isOwner={isOwner}

        onSettings={() =>
          setSettingsOpen(true)
        }

        onCreateTask={() =>
          setModal({ status: 'todo' })
        }
      />


      {/* ==========================================
          PREMIUM NAVIGATION TABS
          ========================================== */}

      <div
        className="mb-6 flex gap-1.5 overflow-x-auto rounded-xl border border-ink-200 bg-white p-1.5 shadow-sm"
        role="tablist"
        aria-label="Project navigation"
      >

        {TABS.map(([id, label, Icon]) => (

          <button
            key={id}
            id={`project-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={`project-panel-${id}`}
            onClick={() => setTab(id)}

            className={clsx(
              'relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-3 text-sm font-semibold transition-all duration-200 motion-reduce:transition-none sm:flex-1',

              tab === id

                ? 'bg-gradient-to-r from-pulse-100 to-pulse-50 text-pulse-800 shadow-sm'

                : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800',

              id === 'ai' &&
                tab !== id &&
                'text-pulse-700'
            )}
          >

            <Icon
              size={18}
              strokeWidth={1.8}
              className={clsx(
                'shrink-0',

                tab === id
                  ? 'text-pulse-700'
                  : id === 'ai'
                    ? 'text-pulse-600'
                    : ''
              )}
            />

            {label}

            {tab === id && (
              <span
                aria-hidden="true"
                className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-pulse-500"
              />
            )}

          </button>

        ))}

      </div>


      {/* ==========================================
          KANBAN BOARD TAB
          ========================================== */}

      {tab === 'board' && (

        <section
          id="project-panel-board"
          role="tabpanel"
          aria-labelledby="project-tab-board"
        >

          {/* Board section heading */}

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">

            <div>

              <h2 className="text-xl font-bold tracking-tight text-ink-900">
                Task board
              </h2>

              <p className="mt-1 text-sm text-ink-500">
                Organize, prioritize and track your team's work.
              </p>

            </div>

            <span className="inline-flex items-center gap-2 rounded-lg border border-pulse-200 bg-pulse-50 px-3 py-2 text-xs font-semibold text-pulse-800">

              <ListTodo size={15} />

              {tasks.length}{' '}

              {tasks.length === 1
                ? 'task'
                : 'tasks'}

            </span>

          </div>


          {/* Existing search and filters */}

          <FilterBar
            filters={filters}
            onChange={setFilters}
            members={members}
            resultCount={filtered.length}
            total={tasks.length}
          />


          {/* Filtered board notice */}

          {filtersActive && !!filtered.length && (

            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">

              <Info
                size={17}
                className="mt-0.5 shrink-0 text-amber-600"
              />

              <div className="w-full min-w-0 xl:flex-1">

                <p className="text-xs font-semibold text-amber-800">
                  Filtered board
                </p>

                <p className="mt-1 text-xs leading-relaxed text-amber-700">
                  Dragging is paused while filters are on.
                  Clear them to reorder cards.
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setFilters(EMPTY_FILTERS)
                }
                className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              >
                Clear
              </button>

            </div>

          )}


          {/* Board or empty search results */}

          {filtersActive && !filtered.length ? (

            <EmptyState
              icon={SearchX}
              title="No tasks match your filters"
              text="Try a different search term or clear the filters."

              action={
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    setFilters(EMPTY_FILTERS)
                  }
                >
                  Clear filters
                </button>
              }
            />

          ) : (

            <Board
              tasks={filtered}
              dragDisabled={filtersActive}
              onMove={handleMove}

              onOpen={(taskId) =>
                setModal({ taskId })
              }

              onCreate={(status) =>
                setModal({ status })
              }
            />

          )}

        </section>

      )}


      {/* ==========================================
          PROJECT OVERVIEW TAB
          ========================================== */}

      {tab === 'overview' && (

        <section
          id="project-panel-overview"
          role="tabpanel"
          aria-labelledby="project-tab-overview"
        >

          <Overview
            projectId={projectId}

            signature={tasks
              .map(
                (task) =>
                  `${task.id}${task.status}${task.priority}${task.assignee_id}${task.due_date}`
              )
              .join('|')}
          />

        </section>

      )}


      {/* ==========================================
          PROJECT ACTIVITY TAB
          ========================================== */}

      {tab === 'activity' && (

        <section
          id="project-panel-activity"
          role="tabpanel"
          aria-labelledby="project-tab-activity"
          className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm"
        >

          <div className="flex items-center gap-3 border-b border-pulse-100 bg-gradient-to-r from-pulse-50 to-white p-5">

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pulse-100 text-pulse-700">

              <Activity
                size={22}
                strokeWidth={1.8}
              />

            </div>

            <div>

              <h2 className="text-lg font-bold text-ink-900">
                Latest activity
              </h2>

              <p className="mt-1 text-xs text-ink-500">
                Stay updated with your team's project changes.
              </p>

            </div>

          </div>

          <div className="p-5 sm:p-6">

            <ActivityList items={activity} />

          </div>

        </section>

      )}


      {/* ==========================================
          PROJECT MEMBERS TAB
          ========================================== */}

      {tab === 'members' && (

        <section
          id="project-panel-members"
          role="tabpanel"
          aria-labelledby="project-tab-members"
        >

          <MembersPanel
            projectId={projectId}
            members={members}
            online={online}
            isOwner={isOwner}

            onAdded={(member) => {

              if (activeProjectRef.current !== projectId) {
                return;
              }

              setMembers((previous) =>
                previous.some(
                  (existing) =>
                    existing.id === member.id
                )
                  ? previous
                  : [...previous, member]
              );

            }}

            onRemoved={(id) => {

              if (activeProjectRef.current !== projectId) {
                return;
              }

              setMembers((previous) =>
                previous.filter(
                  (member) => member.id !== id
                )
              );

              load();

            }}
          />

        </section>

      )}


      {/* ==========================================
          PULSE AI WORKSPACE

          Keep mounted while switching tabs
          to preserve AI results and chat state.
          ========================================== */}

      <div
        id="project-panel-ai"
        role="tabpanel"
        aria-labelledby="project-tab-ai"
        hidden={tab !== 'ai'}
      >

        <PulseAI
          key={projectId}
          projectId={projectId}
          project={project}
          tasks={tasks}
          members={members}
          activity={activity}

          onUpsert={(incoming) => {

            if (activeProjectRef.current !== projectId) {
              return;
            }

            setTasks((previous) =>
              upsertMany(previous, incoming)
            );

          }}

          onOpenTask={(taskId) => {

            if (activeProjectRef.current !== projectId) {
              return;
            }

            setModal({ taskId });

          }}

          onOpenBoard={() => {

            if (activeProjectRef.current !== projectId) {
              return;
            }

            setTab('board');

          }}
        />

      </div>


      {/* ==========================================
          TASK CREATE / EDIT MODAL
          ========================================== */}

      {modal && (!modal.taskId || editing) && (

        <TaskModal
          key={modal.taskId || 'new'}
          projectId={projectId}
          task={editing}
          defaultStatus={modal.status}
          members={members}

          canDelete={
            isOwner ||
            editing?.created_by === user.id
          }

          onClose={() =>
            setModal(null)
          }

          onUpsert={(list) => {

            if (activeProjectRef.current !== projectId) {
              return;
            }

            setTasks((previous) =>
              upsertMany(previous, list)
            );

          }}

          onDelete={(id) => {

            if (activeProjectRef.current !== projectId) {
              return;
            }

            setTasks((previous) =>
              previous.filter(
                (task) => task.id !== id
              )
            );

          }}
        />

      )}


      {/* ==========================================
          PROJECT SETTINGS MODAL
          ========================================== */}

      {settingsOpen && (

        <ProjectFormModal
          project={project}

          onClose={() =>
            setSettingsOpen(false)
          }

          onSaved={(updated) => {

            if (activeProjectRef.current !== projectId) {
              return;
            }

            setProject((previous) => ({
              ...previous,
              ...updated,
            }));

            setSettingsOpen(false);

            window.dispatchEvent(
              new Event('pulse:projects-changed')
            );

          }}

          onDeleted={() => {

            if (activeProjectRef.current !== projectId) {
              return;
            }

            window.dispatchEvent(
              new Event('pulse:projects-changed')
            );

            navigate('/');

          }}
        />

      )}

    </div>
  );
}
