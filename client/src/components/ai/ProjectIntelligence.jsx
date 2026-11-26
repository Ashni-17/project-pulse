import { useEffect, useRef, useState } from "react";

import {
  BarChart3,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  RefreshCw,
  TrendingUp,
  CalendarClock,
  ListChecks,
} from "lucide-react";

import { api } from "../../lib/api.js";
import { pulseAI, getAIError } from "../../lib/ai.js";
import { useToast } from "../../context/ToastContext.jsx";

import { Spinner, ProgressBar } from "../ui";

import {
  AIHeader,
  AILoading,
  AIError,
  AIEmpty,
  AIReviewNotice,
} from "./AIShared.jsx";

// ==========================================
// PRIORITY STYLES
// ==========================================

const PRIORITY_STYLES = {
  low: "bg-sky-100 text-sky-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-rose-100 text-rose-700",
};

function PriorityBadge({ priority }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
        PRIORITY_STYLES[priority] || "bg-ink-100 text-ink-600"
      }`}
    >
      {priority}
    </span>
  );
}

// ==========================================
// REUSABLE INSIGHT CARD
// ==========================================

function InsightCard({
  icon: Icon,
  title,
  items = [],
  emptyText,
  tone = "green",
}) {
  const tones = {
    green: "bg-pulse-100 text-pulse-700",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-sky-100 text-sky-700",
  };

  return (
    <div className="panel p-5">
      <div className="mb-4 flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}
        >
          <Icon size={20} />
        </div>

        <h3 className="font-bold text-ink-900">{title}</h3>
      </div>

      {items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((item, index) => (
            <li
              key={index}
              className="flex items-start gap-2 text-sm leading-relaxed text-ink-700"
            >
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-pulse-500" />

              <span className="min-w-0 break-words">{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-500">{emptyText}</p>
      )}
    </div>
  );
}

// ==========================================
// PROJECT INTELLIGENCE
// ==========================================

export default function ProjectIntelligence({
  projectId,
  tasks = [],
  onUpsert,
  onOpenTask,
}) {
  const toast = useToast();

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [applyingId, setApplyingId] = useState(null);
  const [appliedIds, setAppliedIds] = useState([]);

  const [generatedAt, setGeneratedAt] = useState(null);
  const [analyzedSignature, setAnalyzedSignature] = useState("");

  const [analyzedVersions, setAnalyzedVersions] = useState({});

  const [hasConflict, setHasConflict] = useState(false);

  const busy = useRef(false);

  // ==========================================
// AUTOMATIC SCROLL TO AI ANALYSIS
// ==========================================

const resultRef = useRef(null);
const shouldScrollRef = useRef(false);

useEffect(() => {
  if (!shouldScrollRef.current) return;

  if (!loading && !result && !error) return;

  const frame = requestAnimationFrame(() => {
    const target = resultRef.current;

    // Avoid scrolling when this AI module is hidden.
    if (!target || target.getClientRects().length === 0) {
      shouldScrollRef.current = false;
      return;
    }

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    target.scrollIntoView({
      behavior: reducedMotion ? "instant" : "smooth",
      block: "start",
    });

    // Stop automatic scrolling after analysis finishes.
    if (!loading) {
      shouldScrollRef.current = false;
    }
  });

  return () => cancelAnimationFrame(frame);
}, [loading, result, error]);

  // ==========================================
  // LIVE PROJECT STATISTICS
  // ==========================================

  const total = tasks.length;

  const completed = tasks.filter((task) => task.status === "done").length;

  const inProgress = tasks.filter(
    (task) => task.status === "in_progress"
  ).length;

  const pending = total - completed;

  const today = new Date().toISOString().slice(0, 10);

  const overdue = tasks.filter(
    (task) => task.status !== "done" && task.due_date && task.due_date < today
  ).length;

  const completionRate = total ? Math.round((completed / total) * 100) : 0;

  // Detect changes after the AI analysis.

  const signature = JSON.stringify(
    tasks
      .map((task) => ({
        id: task.id,
        version: task.version,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assignee: task.assignee_id,
        dueDate: task.due_date,
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  );

  const isStale =
    result !== null && (hasConflict || analyzedSignature !== signature);

  const taskMap = new Map(tasks.map((task) => [task.id, task]));

  // ==========================================
  // GENERATE PROJECT ANALYSIS
  // ==========================================

  async function analyze() {
    if (busy.current) return;

    if (
      tasks.some((task) => !Number.isInteger(task.version) || task.version < 1)
    ) {
      setError(
        "Task versions are unavailable. Refresh the project and try again."
      );
      return;
    }

    busy.current = true;
shouldScrollRef.current = true;

setLoading(true);
setError("");

    const requestSignature = signature;

    const requestVersions = Object.fromEntries(
      tasks.map((task) => [task.id, task.version])
    );

    try {
      const response = await pulseAI.intelligence(projectId);

      setResult(response);
      setAppliedIds([]);
      setGeneratedAt(new Date());
      setAnalyzedSignature(requestSignature);
      setAnalyzedVersions(requestVersions);
      setHasConflict(false);
    } catch (err) {
      setError(getAIError(err));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  // ==========================================
  // APPROVE PRIORITY CHANGE
  // ==========================================

  async function applyPriority(suggestion) {
    if (busy.current) return;

    if (appliedIds.includes(suggestion.taskId)) {
      return;
    }

    const task = taskMap.get(suggestion.taskId);

    if (isStale) {
      setError(
        "Project data has changed. Refresh the AI analysis before applying recommendations."
      );
      return;
    }

    if (!task || task.status === "done") {
      setError("This task is no longer available for a priority change.");
      return;
    }

    if (task.priority === suggestion.suggestedPriority) {
      setError("This task already has the suggested priority.");
      return;
    }

    const expectedVersion = analyzedVersions[task.id];

    if (
      !Number.isInteger(expectedVersion) ||
      expectedVersion < 1 ||
      task.version !== expectedVersion
    ) {
      setHasConflict(true);

      setError(
        "This task has changed. Refresh the AI analysis before applying recommendations."
      );

      return;
    }

    const approved = window.confirm(
      `Change the priority of "${task.title}" from ${task.priority} to ${suggestion.suggestedPriority}?`
    );

    if (!approved) return;

    busy.current = true;

    setApplyingId(task.id);
    setError("");

    try {
      const { task: updated } = await api.patch(
        `/projects/${projectId}/tasks/${task.id}`,
        {
          priority: suggestion.suggestedPriority,
          expectedVersion,
        }
      );

      setAppliedIds((previous) => [...previous, task.id]);

      onUpsert?.([updated]);

      toast.success("Task priority updated");
    } catch (err) {
      if (err.status === 409) {
        setHasConflict(true);

        const message =
          "This task was modified by another operation. Refresh the project and generate a fresh AI analysis.";

        setError(message);
        toast.error(message);
      } else {
        setError(getAIError(err));

        toast.error(err.message || "Could not update priority");
      }
    } finally {
      busy.current = false;
      setApplyingId(null);
    }
  }

  // ==========================================
  // USER INTERFACE
  // ==========================================

  return (
    <section className="space-y-5">
      {/* Header */}

      <div className="panel p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <AIHeader
            icon={BarChart3}
            title="Project Intelligence"
            description="Understand project progress, identify risks and discover actionable improvements."
          />

          <button
            type="button"
            className="btn btn-primary"
            onClick={analyze}
            disabled={loading || !!applyingId}
          >
            {loading ? (
              <Spinner className="!text-white" />
            ) : result ? (
              <RefreshCw size={17} />
            ) : (
              <Sparkles size={17} />
            )}

            {loading
              ? "Analyzing..."
              : result
              ? "Refresh analysis"
              : "Analyze project"}
          </button>
        </div>

        {/* Live completion overview */}

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pulse-900 via-pulse-800 to-pulse-600 p-5 text-white sm:p-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-white/5"
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-20 right-20 h-48 w-48 rounded-full bg-white/5"
          />

          <div className="relative">
            <div className="flex items-center gap-2 text-sm font-medium text-pulse-100">
              <TrendingUp size={18} />
              Live project completion
            </div>

            <div className="my-3 text-4xl font-bold">{completionRate}%</div>

            <ProgressBar
              value={completionRate}
              className="!bg-white/20"
              barClassName="bg-pulse-300"
            />

            <p className="mt-3 text-sm text-pulse-100">
              {completed} of {total} tasks completed
            </p>
          </div>
        </div>

        {/* Live statistics */}

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              label: "Total tasks",
              value: total,
              icon: ListChecks,
              tone: "text-ink-700",
            },
            {
              label: "In progress",
              value: inProgress,
              icon: TrendingUp,
              tone: "text-sky-600",
            },
            {
              label: "Pending",
              value: pending,
              icon: CalendarClock,
              tone: "text-amber-600",
            },
            {
              label: "Overdue",
              value: overdue,
              icon: AlertTriangle,
              tone: "text-rose-600",
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                className="rounded-xl border border-ink-200 bg-ink-50 p-4"
              >
                <Icon size={19} className={item.tone} />

                <p className="mt-2 text-2xl font-bold text-ink-900">
                  {item.value}
                </p>

                <p className="text-xs text-ink-500">{item.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Error handling */}

      {/* Automatic scroll destination */}

<div
  ref={resultRef}
  className="scroll-mt-24"
  aria-hidden="true"
/>

{/* Error handling */}

<AIError message={error} />
      {/* Loading state */}

      {loading && (
        <AILoading message="Analyzing project progress and identifying insights..." />
      )}

      {/* Initial state */}

      {!loading && !result && !error && (
        <AIEmpty
          title="Discover your project insights"
          description="Analyze your project to receive progress summaries, achievements, potential risks and priority recommendations."
        />
      )}

      {/* AI analysis results */}

      {!loading && result && (
        <div className="space-y-5">
          {/* Analysis timestamp */}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-bold">AI analysis</h3>

            {generatedAt && (
              <span className="text-xs text-ink-500">
                Generated at {generatedAt.toLocaleString()}
              </span>
            )}
          </div>

          {/* Stale analysis warning */}

          {isStale && (
            <div
              role="status"
              className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
            >
              <AlertTriangle size={19} className="shrink-0" />

              <p>
                Project tasks have changed since this analysis. Refresh the
                analysis to receive updated recommendations.
              </p>
            </div>
          )}

          {/* AI summary */}

          <div className="panel border-pulse-200 p-5 sm:p-6">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles size={21} className="text-pulse-600" />

              <h3 className="font-bold">AI Progress Summary</h3>
            </div>

            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-700">
              {result.summary}
            </p>
          </div>

          {/* Achievements and risks */}

          <div className="grid gap-4 lg:grid-cols-2">
            <InsightCard
              icon={CheckCircle2}
              title="Achievements"
              items={result.achievements}
              emptyText="No achievements were identified."
              tone="green"
            />

            <InsightCard
              icon={AlertTriangle}
              title="Potential Risks"
              items={result.risks}
              emptyText="No specific risks were identified by this analysis."
              tone="amber"
            />
          </div>

          {/* Improvement recommendations */}

          <InsightCard
            icon={Lightbulb}
            title="Improvement Recommendations"
            items={result.recommendations}
            emptyText="No additional recommendations were generated."
            tone="blue"
          />

          {/* Priority recommendations */}

          <div className="panel space-y-4 p-5 sm:p-6">
            <div>
              <h3 className="text-lg font-bold">
                Smart Priority Recommendations
              </h3>

              <p className="mt-1 text-sm text-ink-500">
                Review suggested priority changes before applying them to your
                tasks.
              </p>
            </div>

            {result.prioritySuggestions.length === 0 && (
              <div className="rounded-xl bg-pulse-50 p-4 text-sm text-pulse-800">
                No priority changes were suggested.
              </div>
            )}

            {result.prioritySuggestions.map((suggestion) => {
              const task = taskMap.get(suggestion.taskId);

              const applied = appliedIds.includes(suggestion.taskId);

              const unavailable = !task || task.status === "done";

              const alreadyMatches =
                task?.priority === suggestion.suggestedPriority;

              return (
                <div
                  key={suggestion.taskId}
                  className="rounded-xl border border-ink-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="break-words font-semibold text-ink-900">
                        {task?.title || "Task no longer available"}
                      </h4>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {task && (
                          <>
                            <PriorityBadge priority={task.priority} />

                            {!alreadyMatches && (
                              <ArrowRight size={16} className="text-ink-400" />
                            )}
                          </>
                        )}

                        {!alreadyMatches && (
                          <PriorityBadge
                            priority={suggestion.suggestedPriority}
                          />
                        )}
                      </div>
                    </div>

                    {applied && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-pulse-700">
                        <CheckCircle2 size={16} />
                        Applied
                      </span>
                    )}
                  </div>

                  <p className="mt-3 break-words text-sm leading-relaxed text-ink-600">
                    {suggestion.reason}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    {task && onOpenTask && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={!!applyingId}
                        onClick={() => onOpenTask(task.id)}
                      >
                        View task
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={
                        loading ||
                        !!applyingId ||
                        applied ||
                        unavailable ||
                        alreadyMatches ||
                        isStale
                      }
                      onClick={() => applyPriority(suggestion)}
                    >
                      {applyingId === suggestion.taskId && (
                        <Spinner className="!text-white" />
                      )}

                      {applied
                        ? "Applied"
                        : unavailable
                        ? "Unavailable"
                        : alreadyMatches
                        ? "Already updated"
                        : applyingId === suggestion.taskId
                        ? "Applying..."
                        : "Approve priority change"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <AIReviewNotice />
        </div>
      )}
    </section>
  );
}
