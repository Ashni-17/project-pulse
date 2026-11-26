import { useState } from 'react';

import {
  Sparkles,
  ListChecks,
  BarChart3,
  Users,
  MessageSquare,
  ShieldCheck,
  Activity,
  ArrowUpRight,
} from 'lucide-react';

import clsx from 'clsx';

import SmartPlanner from './SmartPlanner.jsx';
import ProjectIntelligence from './ProjectIntelligence.jsx';
import SmartAssignment from './SmartAssignment.jsx';
import AskPulseAI from './AskPulseAI.jsx';


// ==========================================
// AI WORKSPACE MODULES
// ==========================================

const MODULES = [
  {
    id: 'planner',
    label: 'Smart Planner',
    icon: ListChecks,
    description:
      'Generate tasks from goals, instructions and meeting notes.',
  },
  {
    id: 'intelligence',
    label: 'Project Intelligence',
    icon: BarChart3,
    description:
      'Analyze progress, risks and priority recommendations.',
  },
  {
    id: 'assignment',
    label: 'Smart Assignment',
    icon: Users,
    description:
      'Discover workload-based task assignments.',
  },
  {
    id: 'ask',
    label: 'Ask Pulse AI',
    icon: MessageSquare,
    description:
      'Ask questions and discover useful project insights.',
  },
];


// ==========================================
// PULSE AI WORKSPACE
// ==========================================

export default function PulseAI({
  projectId,
  project,
  tasks = [],
  members = [],
  activity = [],
  onUpsert,
  onOpenTask,
  onOpenBoard,
}) {

  const [activeModule, setActiveModule] =
    useState('planner');

  const activeTasks = tasks.filter(
    (task) => task.status !== 'done'
  ).length;


  return (

    <section className="space-y-5">


      {/* =====================================
          PREMIUM GREEN GRADIENT HERO
      ====================================== */}

      <div className="relative isolate overflow-hidden rounded-2xl bg-gradient-to-br from-pulse-900 via-pulse-700 to-pulse-600 p-6 text-white shadow-card sm:p-8">


        {/* Decorative background */}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/5"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 right-24 h-72 w-72 rounded-full bg-white/5"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-10 top-10 hidden text-pulse-300/20 lg:block"
        >
          <Activity
            size={180}
            strokeWidth={1}
          />
        </div>


        {/* Hero content */}

        <div className="relative z-10">

          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-pulse-100">

            <Sparkles size={14} />

            Intelligent Workspace

          </div>

          <div className="flex items-center gap-3">

            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 sm:h-14 sm:w-14">

              <Sparkles
                size={28}
                className="text-pulse-100"
              />

            </div>

            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">

              Pulse AI

            </h2>

          </div>

          <p className="mt-4 text-lg font-medium text-pulse-50">

            Plan smarter. Collaborate better.
            Deliver faster.

          </p>

          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-pulse-100">

            Your intelligent project assistant for
            task planning, progress analysis,
            workload balancing and project insights.

          </p>


          {/* Project context */}

          <div className="mt-6 flex flex-wrap gap-2">

            <span className="max-w-full break-words rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium">

              Project: {project?.name || 'Current project'}

            </span>

            <span className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium">

              {activeTasks} active tasks

            </span>

            <span className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium">

              {members.length} team members

            </span>

          </div>


          {/* AI transparency */}

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/15 pt-4 text-xs text-pulse-100">

            <span className="flex items-center gap-1.5">

              <Sparkles size={15} />

              Powered by Gemini

            </span>

            <span className="flex items-center gap-1.5">

              <ShieldCheck size={15} />

              Human-controlled actions

            </span>

          </div>

        </div>

      </div>


      {/* =====================================
          AI MODULE NAVIGATION
      ====================================== */}

      <div>

        <div className="mb-3">

          <h3 className="text-lg font-bold text-ink-900">

            AI Tools

          </h3>

          <p className="mt-1 text-sm text-ink-500">

            Choose how Pulse AI can help your project.

          </p>

        </div>

        <div
          role="group"
          aria-label="Pulse AI tools"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >

          {MODULES.map((module) => {

            const Icon = module.icon;

            const selected =
              activeModule === module.id;

            return (

              <button
                key={module.id}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  setActiveModule(module.id)
                }
                className={clsx(
                  'group relative rounded-xl border p-4 text-left transition-all duration-200',

                  selected
                    ? 'border-pulse-500 bg-pulse-50 shadow-sm ring-1 ring-pulse-500'
                    : 'border-ink-200 bg-white hover:border-pulse-300 hover:bg-pulse-50/50'
                )}
              >

                <div className="mb-3 flex items-center justify-between gap-2">

                  <div
                    className={clsx(
                      'flex h-10 w-10 items-center justify-center rounded-xl transition-colors',

                      selected
                        ? 'bg-pulse-600 text-white'
                        : 'bg-pulse-100 text-pulse-700'
                    )}
                  >

                    <Icon size={21} />

                  </div>

                  <ArrowUpRight
                    size={16}
                    className={clsx(
                      'transition-colors',

                      selected
                        ? 'text-pulse-600'
                        : 'text-ink-300 group-hover:text-pulse-600'
                    )}
                  />

                </div>

                <h4
                  className={clsx(
                    'text-sm font-bold',

                    selected
                      ? 'text-pulse-900'
                      : 'text-ink-900'
                  )}
                >

                  {module.label}

                </h4>

                <p className="mt-2 text-xs leading-relaxed text-ink-500">

                  {module.description}

                </p>

              </button>

            );

          })}

        </div>

      </div>


      {/* =====================================
          AI MODULE CONTENT

          Keep modules mounted while switching
          between AI tools to preserve state.
      ====================================== */}

      <div hidden={activeModule !== 'planner'}>

        <SmartPlanner
          projectId={projectId}
          tasks={tasks}
          members={members}
          onUpsert={onUpsert}
          onOpenBoard={onOpenBoard}
        />

      </div>


      <div hidden={activeModule !== 'intelligence'}>

        <ProjectIntelligence
          projectId={projectId}
          tasks={tasks}
          onUpsert={onUpsert}
          onOpenTask={onOpenTask}
        />

      </div>


      <div hidden={activeModule !== 'assignment'}>

        <SmartAssignment
          projectId={projectId}
          tasks={tasks}
          members={members}
          onUpsert={onUpsert}
          onOpenTask={onOpenTask}
        />

      </div>


      <div hidden={activeModule !== 'ask'}>

        <AskPulseAI
          projectId={projectId}
          tasks={tasks}
          members={members}
          activity={activity}
          onOpenTask={onOpenTask}
        />

      </div>


      {/* =====================================
          RESPONSIBLE AI FOOTER
      ====================================== */}

      <div className="flex items-start gap-3 rounded-xl border border-ink-200 bg-white p-4">

        <ShieldCheck
          size={21}
          className="mt-0.5 shrink-0 text-pulse-600"
        />

        <div>

          <p className="text-sm font-semibold text-ink-800">

            Responsible AI assistance

          </p>

          <p className="mt-1 text-xs leading-relaxed text-ink-500">

            Relevant project information and your
            instructions are processed by Gemini
            to generate suggestions. AI responses
            may contain inaccuracies. Review
            recommendations before approving
            changes, and avoid entering sensitive
            or confidential information.

          </p>

        </div>

      </div>

    </section>

  );

}