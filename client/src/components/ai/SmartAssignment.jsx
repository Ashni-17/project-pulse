import { useEffect, useRef, useState } from "react";

import {
  Users,
  Sparkles,
  UserCheck,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Scale,
} from "lucide-react";

import { api } from "../../lib/api.js";
import { pulseAI, getAIError } from "../../lib/ai.js";
import { useToast } from "../../context/ToastContext.jsx";

import { Avatar, Field, Spinner, ProgressBar } from "../ui";

import {
  AIHeader,
  AILoading,
  AIError,
  AIEmpty,
  AIReviewNotice,
} from "./AIShared.jsx";

// ==========================================
// SMART ASSIGNMENT
// ==========================================

export default function SmartAssignment({
  projectId,
  tasks = [],
  members = [],
  onUpsert,
  onOpenTask,
}) {
  const toast = useToast();

  const [taskId, setTaskId] = useState("");

  const [result, setResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const [error, setError] = useState("");

  const [analyzedSignature, setAnalyzedSignature] = useState("");
  const [analyzedVersion, setAnalyzedVersion] = useState(null);

  const [hasConflict, setHasConflict] = useState(false);

  const busy = useRef(false);

// ==========================================
// AUTOMATIC SCROLL TO AI RECOMMENDATION
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

    // Stop automatic scrolling after generation finishes.
    if (!loading) {
      shouldScrollRef.current = false;
    }
  });

  return () => cancelAnimationFrame(frame);
}, [loading, result, error]);



  // ==========================================
  // ACTIVE TASKS AND TEAM WORKLOAD
  // ==========================================

  const activeTasks = tasks.filter((task) => task.status !== "done");

  const selectedTask = activeTasks.find((task) => task.id === taskId);

  const currentAssignee = members.find(
    (member) => member.id === selectedTask?.assignee_id
  );

  const recommendedMember = members.find(
    (member) => member.id === result?.recommendedMemberId
  );

  const workloads = members.map((member) => ({
    ...member,

    activeTasks: activeTasks.filter((task) => task.assignee_id === member.id)
      .length,
  }));

  const maxWorkload = Math.max(
    1,
    ...workloads.map((member) => member.activeTasks)
  );

  // Detect changes to task and member information.

  const signature = JSON.stringify({
    taskId,

    tasks: tasks
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
      .sort((a, b) => a.id.localeCompare(b.id)),

    members: members
      .map((member) => ({
        id: member.id,
        name: member.name,
        role: member.role,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  });

  const isStale =
    result !== null &&
    (hasConflict ||
      analyzedSignature !== signature ||
      !Number.isInteger(analyzedVersion) ||
      selectedTask?.version !== analyzedVersion);
  const alreadyAssigned =
    !!result && selectedTask?.assignee_id === result.recommendedMemberId;

  // ==========================================
  // SELECT TASK
  // ==========================================

  function changeTask(event) {
    if (busy.current) return;

    setTaskId(event.target.value);
    setResult(null);
    setApplied(false);
    setError("");
    setAnalyzedSignature("");
    setAnalyzedVersion(null);
    setHasConflict(false);
  }

  // ==========================================
  // GENERATE RECOMMENDATION
  // ==========================================

  async function recommend(event) {
    event.preventDefault();

    if (busy.current) return;

    if (!selectedTask) {
      setError("Please select an active task.");
      return;
    }

    if (!members.length) {
      setError("No project members are available.");
      return;
    }

    if (!Number.isInteger(selectedTask.version) || selectedTask.version < 1) {
  setError(
    "Task version is unavailable. Refresh the project and try again."
  );
  return;
}

busy.current = true;
shouldScrollRef.current = true;

setLoading(true);
    setResult(null);
    setApplied(false);
    setError("");

    setAnalyzedVersion(null);
    setHasConflict(false);

    const requestSignature = signature;
    const requestVersion = selectedTask.version;
    try {
      const response = await pulseAI.assign(projectId, selectedTask.id);

      setResult(response);
      setAnalyzedSignature(requestSignature);
      setAnalyzedVersion(requestVersion);
    } catch (err) {
      setError(getAIError(err));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  // ==========================================
  // APPROVE ASSIGNMENT
  // ==========================================

  async function applyAssignment() {
    if (busy.current || !result || applied) return;

    if (isStale) {
      setError(
        "Project data has changed. Generate a fresh recommendation before assigning this task."
      );

      return;
    }

    if (!selectedTask) {
      setError("This task is no longer active or available.");

      return;
    }

    if (!recommendedMember) {
      setError("The recommended member is no longer available.");

      return;
    }

    if (alreadyAssigned) return;

    const approved = window.confirm(
      `Assign "${selectedTask.title}" to ${recommendedMember.name}?`
    );

    if (!approved) return;

    busy.current = true;

    setApplying(true);
    setError("");

    try {
      const { task: updated } = await api.patch(
  `/projects/${projectId}/tasks/${selectedTask.id}`,
  {
    assigneeId: recommendedMember.id,
    expectedVersion: analyzedVersion,
  }
);

      setApplied(true);

      onUpsert?.([updated]);

      toast.success(`Task assigned to ${recommendedMember.name}`);
    } catch (err) {

  if (err.status === 409) {

    setHasConflict(true);

    const message =
      'This task was modified by another operation. Refresh the project and generate a fresh recommendation.';

    setError(message);
    toast.error(message);

  } else {

    setError(getAIError(err));

    toast.error(
      err.message || 'Could not assign the task'
    );

  }

} finally {
      busy.current = false;
      setApplying(false);
    }
  }

  // ==========================================
  // PROJECTED WORKLOAD
  // ==========================================

  const projectedWorkloads = result?.projectedWorkloads || [];

  const maxProjected = Math.max(
    1,
    ...projectedWorkloads.map((member) => member.activeTasks)
  );

  // ==========================================
  // USER INTERFACE
  // ==========================================

  return (
    <section className="space-y-5">
      {/* Task selection */}

      <div className="panel p-5 sm:p-6">
        <AIHeader
          icon={Users}
          title="Smart Assignment"
          description="Find suitable team members using workload-based recommendations."
        />

        <form onSubmit={recommend} className="space-y-4">
          <Field label="Select an active task">
            <select
              className="input"
              value={taskId}
              onChange={changeTask}
              disabled={loading || applying}
              required
            >
              <option value="">Choose a task</option>

              {taskId && !selectedTask && (
                <option value={taskId} disabled>
                  Task no longer available
                </option>
              )}

              {activeTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </Field>

          {/* Selected task details */}

          {selectedTask && (
            <div className="rounded-xl border border-ink-200 bg-ink-50 p-4">
              <h3 className="break-words font-semibold">
                {selectedTask.title}
              </h3>

              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs text-ink-500">Current assignee</p>

                  <p className="mt-1 font-medium">
                    {currentAssignee?.name || "Unassigned"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-ink-500">Priority</p>

                  <p className="mt-1 font-medium capitalize">
                    {selectedTask.priority}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-ink-500">Status</p>

                  <p className="mt-1 font-medium">
                    {selectedTask.status === "todo" ? "To Do" : "In Progress"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!activeTasks.length && (
            <p className="rounded-lg bg-pulse-50 p-3 text-sm text-pulse-800">
              There are no active tasks available for assignment.
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || applying || !selectedTask || !members.length}
            >
              {loading ? (
                <Spinner className="!text-white" />
              ) : (
                <Sparkles size={17} />
              )}

              {loading ? "Analyzing workload..." : "Recommend assignee"}
            </button>
          </div>
        </form>
      </div>

      {/* Current workload */}

      <div className="panel p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <Scale size={21} className="text-pulse-600" />

          <h3 className="text-lg font-bold">Current Team Workload</h3>
        </div>

        <div className="space-y-5">
          {workloads.map((member) => (
            <div key={member.id}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar name={member.name} size="md" />

                  <span className="truncate text-sm font-medium">
                    {member.name}
                  </span>
                </div>

                <span className="shrink-0 text-xs text-ink-500">
                  {member.activeTasks} active task(s)
                </span>
              </div>

              <ProgressBar value={(member.activeTasks / maxWorkload) * 100} />
            </div>
          ))}

          {!workloads.length && (
            <p className="text-sm text-ink-500">
              No project members available.
            </p>
          )}
        </div>

        <p className="mt-4 text-xs text-ink-500">
          Workload is measured using assigned To Do and In Progress tasks.
        </p>
      </div>

      {/* Errors and loading */}

      {/* Automatic scroll destination */}

<div
  ref={resultRef}
  className="scroll-mt-24"
  aria-hidden="true"
/>

{/* Errors and loading */}

<AIError message={error} />

      {loading && (
        <AILoading message="Finding the most balanced assignment..." />
      )}

      {!loading && !result && !error && (
        <AIEmpty
          title="Find the right team member"
          description="Select an active task to receive a workload-based assignment recommendation."
        />
      )}

      {/* AI recommendation */}

      {!loading && result && (
        <div className="panel space-y-5 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Sparkles size={21} className="text-pulse-600" />

            <h3 className="text-lg font-bold">AI Assignment Recommendation</h3>
          </div>
          {/* Outdated recommendation warning */}

{isStale && !applied && (
            <div
              role="status"
              className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
            >
              <AlertTriangle size={19} className="shrink-0" />

              <p>
                Project data has changed. Generate a fresh recommendation before
                making another assignment.
              </p>
            </div>
          )}

          {/* Recommended member */}

          <div className="rounded-2xl bg-gradient-to-br from-pulse-900 via-pulse-800 to-pulse-600 p-5 text-white">
            <p className="text-xs font-medium uppercase tracking-wider text-pulse-200">
              Recommended team member
            </p>

            <div className="mt-4 flex items-center gap-3">
              <Avatar
                name={recommendedMember?.name || result.recommendedMemberName}
                size="lg"
              />

              <div className="min-w-0 flex-1">
                <h3 className="break-words text-xl font-bold">
                  {recommendedMember?.name || result.recommendedMemberName}
                </h3>

                <p className="mt-1 text-sm text-pulse-100">
                  {result.retainsCurrentAssignment
                    ? "Retain current assignment"
                    : "Recommended assignment"}
                </p>
              </div>

              <UserCheck size={28} className="shrink-0 text-pulse-200" />
            </div>

            <p className="mt-4 break-words text-sm leading-relaxed text-pulse-100">
              {result.reason}
            </p>
          </div>

          {/* AI explanation */}

          {result.aiExplanation && (
            <div className="rounded-xl border border-pulse-200 bg-pulse-50 p-4">
              <h4 className="mb-2 text-sm font-semibold text-pulse-800">
                AI Explanation
              </h4>

              <p className="break-words text-sm leading-relaxed text-ink-700">
                {result.aiExplanation}
              </p>
            </div>
          )}

          {/* Assignment comparison */}

          {!alreadyAssigned && (
            <div className="grid items-center gap-3 rounded-xl border border-ink-200 p-4 sm:grid-cols-[1fr_auto_1fr]">
              <div>
                <p className="text-xs text-ink-500">Current assignee</p>

                <p className="mt-1 font-semibold">
                  {currentAssignee?.name || "Unassigned"}
                </p>
              </div>

              <ArrowRight size={20} className="text-pulse-600" />

              <div>
                <p className="text-xs text-ink-500">Recommended assignee</p>

                <p className="mt-1 font-semibold text-pulse-700">
                  {result.recommendedMemberName}
                </p>
              </div>
            </div>
          )}

          {/* Projected team workload */}

          <div className="rounded-xl border border-ink-200 p-4">
            <h4 className="mb-4 font-bold">Projected Team Workload</h4>

            <div className="space-y-4">
              {projectedWorkloads.map((member) => {
                const current = workloads.find(
                  (item) => item.id === member.memberId
                );

                return (
                  <div key={member.memberId}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{member.name}</span>

                      <span className="text-xs text-ink-500">
                        {current ? `${current.activeTasks} → ` : ""}
                        {member.activeTasks} active task(s)
                      </span>
                    </div>

                    <ProgressBar
                      value={(member.activeTasks / maxProjected) * 100}
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-5 rounded-lg bg-ink-50 p-4">
              <p className="text-xs text-ink-500">Projected workload gap</p>

              <p className="mt-1 text-2xl font-bold text-pulse-700">
                {result.workloadGap}
                <span className="ml-1 text-sm font-medium">task(s)</span>
              </p>

              <p className="mt-1 text-xs text-ink-500">
                Difference between the highest and lowest projected active task
                counts.
              </p>
            </div>
          </div>

          {/* Already assigned or approved */}

          {(alreadyAssigned || applied) && (
            <div className="flex items-center gap-2 rounded-xl bg-pulse-50 p-4 text-sm font-medium text-pulse-800">
              <CheckCircle2 size={20} className="shrink-0" />

              {applied
                ? "Assignment successfully updated."
                : "This task already has the recommended assignee. No change is needed."}
            </div>
          )}

          <AIReviewNotice />

          {/* Approval actions */}

          <div className="flex flex-wrap justify-end gap-3 border-t border-ink-100 pt-4">
            {selectedTask && onOpenTask && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={applying}
                onClick={() => onOpenTask(selectedTask.id)}
              >
                View task
              </button>
            )}

            <button
              type="button"
              className="btn btn-primary"
              disabled={
                applying ||
                loading ||
                applied ||
                alreadyAssigned ||
                isStale ||
                !selectedTask ||
                !recommendedMember
              }
              onClick={applyAssignment}
            >
              {applying ? (
                <Spinner className="!text-white" />
              ) : (
                <UserCheck size={17} />
              )}

              {applied
                ? "Assignment applied"
                : alreadyAssigned
                ? "No change needed"
                : applying
                ? "Assigning..."
                : "Approve assignment"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
