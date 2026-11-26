import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Layers,
  MessageSquare,
  NotebookPen,
  ListChecks,
  CheckCircle2,
  Save,
} from "lucide-react";

import clsx from "clsx";

import { api } from "../../lib/api.js";
import { pulseAI, getAIError } from "../../lib/ai.js";
import { useToast } from "../../context/ToastContext.jsx";
import { Field, Spinner } from "../ui";

import {
  AIHeader,
  AILoading,
  AIError,
  AIEmpty,
  AIReviewNotice,
} from "./AIShared.jsx";

// ==========================================
// PLANNING MODES
// ==========================================

const MODES = [
  {
    id: "project",
    label: "Project Breakdown",
    icon: Layers,
    description: "Break a project goal into actionable tasks.",
    placeholder:
      "Example: Plan the development and launch of an e-commerce website.",
  },
  {
    id: "natural",
    label: "Natural Language",
    icon: MessageSquare,
    description: "Describe tasks using everyday language.",
    placeholder:
      "Example: Create a high-priority login task for Alice tomorrow.",
  },
  {
    id: "meeting",
    label: "Meeting to Tasks",
    icon: NotebookPen,
    description: "Extract action items from meeting notes.",
    placeholder:
      "Example: Alice will prepare documentation by Friday. Bob will review API security tomorrow.",
  },
];

const normalize = (title) => title.trim().toLowerCase().replace(/\s+/g, " ");

// ==========================================
// SMART PLANNER
// ==========================================

export default function SmartPlanner({
  projectId,
  members = [],
  tasks = [],
  onUpsert,
  onOpenBoard,
}) {
  const toast = useToast();

  const [mode, setMode] = useState("project");
  const [prompt, setPrompt] = useState("");

  const [suggestions, setSuggestions] = useState([]);
  const [overview, setOverview] = useState("");
  const [duplicatesSkipped, setDuplicatesSkipped] = useState(0);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [generated, setGenerated] = useState(false);
  const [error, setError] = useState("");
  const [savedCount, setSavedCount] = useState(0);

  const busy = useRef(false);

  // ==========================================
  // AUTOMATIC SCROLL TO AI RESULTS
  // ==========================================

  const resultRef = useRef(null);
  const shouldScrollRef = useRef(false);

  useEffect(() => {
    if (!shouldScrollRef.current) return;

    if (!loading && !generated && !error) return;

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
  }, [loading, generated, error]);

  const currentMode = MODES.find((item) => item.id === mode);

  const pendingSuggestions = suggestions.filter((item) => !item.saved);

  const selected = pendingSuggestions.filter((item) => item.selected);

  const allSelected =
    pendingSuggestions.length > 0 &&
    selected.length === pendingSuggestions.length;

  // ==========================================
  // CHANGE PLANNING MODE
  // ==========================================

  function changeMode(nextMode) {
    if (busy.current || nextMode === mode) return;

    if (
      pendingSuggestions.length > 0 &&
      !window.confirm("Discard the current unsaved suggestions?")
    ) {
      return;
    }

    setMode(nextMode);
    setPrompt("");
    setSuggestions([]);
    setOverview("");
    setDuplicatesSkipped(0);
    setGenerated(false);
    setSavedCount(0);
    setError("");
  }

  // ==========================================
  // GENERATE AI SUGGESTIONS
  // ==========================================

  async function generate(event) {
    event.preventDefault();

    if (busy.current) return;

    if (prompt.trim().length < 3) {
      setError("Please enter a meaningful instruction.");
      return;
    }

    if (
      pendingSuggestions.length > 0 &&
      !window.confirm("Replace the current unsaved suggestions?")
    ) {
      return;
    }

    busy.current = true;
    shouldScrollRef.current = true;

    setLoading(true);
    setError("");
    setSuggestions([]);
    setOverview("");
    setDuplicatesSkipped(0);
    setGenerated(false);
    setSavedCount(0);

    try {
      const result = await pulseAI.plan(projectId, mode, prompt.trim());

      setSuggestions(
        result.tasks.map((task, index) => ({
          ...task,
          localId: index,
          selected: true,
          saved: false,
          saveError: "",
        }))
      );

      setOverview(result.overview);
      setDuplicatesSkipped(result.duplicatesSkipped || 0);
      setGenerated(true);
    } catch (err) {
      setError(getAIError(err));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  // ==========================================
  // EDIT SUGGESTIONS
  // ==========================================

  function updateSuggestion(localId, key, value) {
    if (busy.current) return;

    setSuggestions((previous) =>
      previous.map((item) =>
        item.localId === localId && !item.saved
          ? {
              ...item,
              [key]: value,
              saveError: "",
            }
          : item
      )
    );
  }

  function toggleAll() {
    if (busy.current) return;

    setSuggestions((previous) =>
      previous.map((item) =>
        item.saved
          ? item
          : {
              ...item,
              selected: !allSelected,
            }
      )
    );
  }

  // ==========================================
  // SAVE APPROVED TASKS
  // ==========================================

  async function saveSelected() {
    if (busy.current || !selected.length) return;

    setError("");

    const existingTitles = new Set(tasks.map((task) => normalize(task.title)));

    const validMemberIds = new Set(members.map((member) => member.id));

    // Validate all selected suggestions before saving.

    for (const item of selected) {
      const title = item.title.trim();

      if (!title || title.length > 150) {
        setError(
          "Every selected task must have a title between 1 and 150 characters."
        );
        return;
      }

      if (item.description.length > 2000) {
        setError("Task descriptions cannot exceed 2000 characters.");
        return;
      }

      if (existingTitles.has(normalize(title))) {
        setError(
          `Duplicate task title: "${title}". Edit or deselect this suggestion.`
        );
        return;
      }

      if (item.assigneeId && !validMemberIds.has(item.assigneeId)) {
        setError(`The assignee for "${title}" is no longer a project member.`);
        return;
      }

      existingTitles.add(normalize(title));
    }

    busy.current = true;
    setSaving(true);

    let successful = 0;
    let failed = 0;

    try {
      // Save sequentially using the existing task API.

      for (const item of selected) {
        try {
          const { task: created } = await api.post(
            `/projects/${projectId}/tasks`,
            {
              title: item.title.trim(),
              description: item.description.trim(),
              priority: item.priority,
              status: "todo",
              assigneeId: item.assigneeId || null,
              dueDate: item.dueDate || null,
            }
          );

          successful++;

          setSuggestions((previous) =>
            previous.map((suggestion) =>
              suggestion.localId === item.localId
                ? {
                    ...suggestion,
                    saved: true,
                    selected: false,
                    saveError: "",
                  }
                : suggestion
            )
          );

          onUpsert?.([created]);
        } catch (err) {
          failed++;

          setSuggestions((previous) =>
            previous.map((suggestion) =>
              suggestion.localId === item.localId
                ? {
                    ...suggestion,
                    saveError: err.message || "Could not save this task.",
                  }
                : suggestion
            )
          );

          // Stop if the project or session is inaccessible,
          // or the server cannot be reached.

          if ([0, 401, 403, 404].includes(err.status)) {
            setError(
              "Saving was interrupted. Check your connection and project access before retrying."
            );
            break;
          }
        }
      }

      setSavedCount((previous) => previous + successful);

      if (successful > 0) {
        toast.success(
          `${successful} task${successful === 1 ? "" : "s"} created`
        );
      }

      if (failed > 0) {
        toast.error(
          "Some tasks could not be saved. Review the remaining suggestions."
        );
      }
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  // ==========================================
  // USER INTERFACE
  // ==========================================

  return (
    <section className="space-y-5">
      <div className="panel p-5 sm:p-6">
        <AIHeader
          icon={ListChecks}
          title="Smart Planner"
          description="Turn project goals, natural language and meeting notes into actionable tasks."
        />

        {/* Planning modes */}

        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          {MODES.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                disabled={loading || saving}
                aria-pressed={mode === item.id}
                onClick={() => changeMode(item.id)}
                className={clsx(
                  "rounded-xl border p-4 text-left transition-colors disabled:opacity-60",
                  mode === item.id
                    ? "border-pulse-500 bg-pulse-50"
                    : "border-ink-200 bg-white hover:border-pulse-300"
                )}
              >
                <Icon size={22} className="mb-3 text-pulse-700" />

                <p className="text-sm font-bold text-ink-900">{item.label}</p>

                <p className="mt-1 text-xs leading-relaxed text-ink-500">
                  {item.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Prompt input */}

        <form onSubmit={generate} className="space-y-4">
          <Field
            label={
              mode === "project"
                ? "Describe your project goal"
                : mode === "natural"
                ? "Describe the tasks you need"
                : "Paste your meeting notes"
            }
          >
            <textarea
              className="input min-h-[140px] resize-y"
              value={prompt}
              maxLength={10000}
              disabled={loading || saving}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={currentMode.placeholder}
              required
            />
          </Field>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-ink-500">
              {prompt.length.toLocaleString()} / 10,000 characters
            </span>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || saving || prompt.trim().length < 3}
            >
              {loading ? (
                <Spinner className="!text-white" />
              ) : (
                <Sparkles size={17} />
              )}

              {loading ? "Generating..." : "Generate task suggestions"}
            </button>
          </div>
        </form>
      </div>

      {/* Loading and errors */}

      {/* Automatic scroll destination */}

      <div ref={resultRef} className="scroll-mt-24" aria-hidden="true" />

      {/* Loading and errors */}

      <AIError message={error} />

      {loading && <AILoading message="Preparing your task suggestions..." />}

      {/* Initial empty state */}

      {!loading && !generated && !error && (
        <AIEmpty
          title="Start with an idea"
          description="Choose a planning mode and describe what you want to achieve. Pulse AI will prepare tasks for your review."
        />
      )}

      {/* No generated tasks */}

      {!loading && generated && !suggestions.length && (
        <AIEmpty
          title="No new tasks suggested"
          description={
            duplicatesSkipped
              ? `${duplicatesSkipped} duplicate suggestion(s) were skipped.`
              : "Try providing more specific project instructions or action items."
          }
        />
      )}

      {/* Generated task review */}

      {!loading && suggestions.length > 0 && (
        <div className="panel space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">Review task suggestions</h3>

              <p className="mt-1 text-sm text-ink-500">
                {suggestions.length} suggested · {savedCount} saved ·{" "}
                {selected.length} selected
              </p>
            </div>

            {pendingSuggestions.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={saving}
                onClick={toggleAll}
              >
                {allSelected ? "Deselect all" : "Select all"}
              </button>
            )}
          </div>

          {savedCount === 0 && overview && (
            <p className="rounded-lg bg-pulse-50 p-3 text-sm text-pulse-800">
              {overview}
            </p>
          )}

          {duplicatesSkipped > 0 && (
            <p className="text-xs text-ink-500">
              {duplicatesSkipped} duplicate suggestion(s) skipped.
            </p>
          )}

          {/* Editable suggestion cards */}

          {suggestions.map((item, index) => (
            <div
              key={item.localId}
              className={clsx(
                "rounded-xl border p-4",
                item.saved
                  ? "border-pulse-200 bg-pulse-50"
                  : item.selected
                  ? "border-pulse-300 bg-white"
                  : "border-ink-200 bg-ink-50"
              )}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-pulse-600"
                    checked={item.selected}
                    disabled={saving || item.saved}
                    onChange={(event) =>
                      updateSuggestion(
                        item.localId,
                        "selected",
                        event.target.checked
                      )
                    }
                  />
                  Task suggestion {index + 1}
                </label>

                {item.saved && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-pulse-700">
                    <CheckCircle2 size={16} />
                    Saved
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <Field label="Task title">
                  <input
                    className="input"
                    value={item.title}
                    maxLength={150}
                    disabled={saving || item.saved}
                    onChange={(event) =>
                      updateSuggestion(
                        item.localId,
                        "title",
                        event.target.value
                      )
                    }
                  />
                </Field>

                <Field label="Description">
                  <textarea
                    className="input min-h-[80px] resize-y"
                    value={item.description}
                    maxLength={2000}
                    disabled={saving || item.saved}
                    onChange={(event) =>
                      updateSuggestion(
                        item.localId,
                        "description",
                        event.target.value
                      )
                    }
                  />
                </Field>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Priority">
                    <select
                      className="input"
                      value={item.priority}
                      disabled={saving || item.saved}
                      onChange={(event) =>
                        updateSuggestion(
                          item.localId,
                          "priority",
                          event.target.value
                        )
                      }
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </Field>

                  <Field label="Assignee">
                    <select
                      className="input"
                      value={item.assigneeId || ""}
                      disabled={saving || item.saved}
                      onChange={(event) =>
                        updateSuggestion(
                          item.localId,
                          "assigneeId",
                          event.target.value || null
                        )
                      }
                    >
                      <option value="">Unassigned</option>

                      {item.assigneeId &&
                        !members.some(
                          (member) => member.id === item.assigneeId
                        ) && (
                          <option value={item.assigneeId} disabled>
                            Member no longer available
                          </option>
                        )}

                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Due date">
                    <input
                      type="date"
                      className="input"
                      value={item.dueDate || ""}
                      disabled={saving || item.saved}
                      onChange={(event) =>
                        updateSuggestion(
                          item.localId,
                          "dueDate",
                          event.target.value || null
                        )
                      }
                    />
                  </Field>
                </div>

                {item.saveError && <AIError message={item.saveError} />}
              </div>
            </div>
          ))}

          <AIReviewNotice />

          {/* Approval actions */}

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-ink-100 pt-4">
            {savedCount > 0 && onOpenBoard && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={saving}
                onClick={onOpenBoard}
              >
                View board
              </button>
            )}

            <button
              type="button"
              className="btn btn-primary"
              disabled={saving || !selected.length}
              onClick={saveSelected}
            >
              {saving ? (
                <Spinner className="!text-white" />
              ) : (
                <Save size={17} />
              )}

              {saving
                ? "Saving tasks..."
                : `Approve & save (${selected.length})`}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
