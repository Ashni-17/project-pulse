
import { useEffect, useRef, useState } from "react";

import {
  Send,
  Trash2,
  ClipboardList,
  MessageSquare,
  History,
  CalendarDays,
  Flag,
  UserRound,
  ListTodo,
  AlertTriangle,
  Check,
  Plus,
  Clock,
  MessagesSquare,
} from "lucide-react";

import clsx from "clsx";
import { api } from "../../lib/api.js";
import { getSocket } from "../../lib/socket.js";

import {
  PRIORITIES,
  STATUSES,
  formatDateTime,
  timeAgo,
} from "../../lib/constants.js";

import {
  Avatar,
  Field,
  Modal,
  Spinner,
} from "../ui";

import ActivityList from "../project/ActivityList.jsx";
import { useToast } from "../../context/ToastContext.jsx";


const toPayload = (f) =>
  Object.fromEntries(
    Object.entries(f).map(([k, v]) => [
      k,
      (k === "assigneeId" || k === "dueDate") &&
      v === ""
        ? null
        : v,
    ])
  );

const firstError = (e, key) =>
  e[key]?.[0] ?? e[key];


const inputStyle =
  "input !rounded-xl !bg-ink-50 hover:border-pulse-300 focus:!bg-white";


// ==========================================
// TASK MODAL
// ==========================================

export default function TaskModal({
  projectId,
  task,
  defaultStatus = "todo",
  members,
  canDelete,
  onClose,
  onUpsert,
  onDelete,
}) {
  const isNew = !task;
  const base = `/projects/${projectId}/tasks`;
  const toast = useToast();

  const initial = useRef({
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? defaultStatus,
    priority: task?.priority ?? "medium",
    assigneeId: task?.assignee_id ?? "",
    dueDate: task?.due_date ?? "",
  });

  const initialVersion = useRef(
    task?.version ?? null
  );

  const [hasConflict, setHasConflict] =
    useState(false);

  const [form, setForm] =
    useState(initial.current);

  const [errors, setErrors] = useState({});

  const [saving, setSaving] = useState(false);

  const busy = useRef(false);


  const isStale =
    !isNew &&
    (
      hasConflict ||
      !Number.isInteger(initialVersion.current) ||
      initialVersion.current < 1 ||
      task.version !== initialVersion.current
    );


  const set = (key) => (e) =>
    setForm((f) => ({
      ...f,
      [key]: e.target.value,
    }));


  // ==========================================
  // CREATE OR UPDATE TASK
  // ==========================================

  async function submit(e) {
    e.preventDefault();

    if (busy.current) return;

    if (isStale) {
      toast.error(
        "This task has changed. Close and reopen it before saving."
      );
      return;
    }

    if (!form.title.trim()) {
      return setErrors({
        title: "Give the task a title",
      });
    }

    busy.current = true;
    setSaving(true);
    setErrors({});

    try {
      if (isNew) {
        const { task: created } =
          await api.post(base, toPayload(form));

        onUpsert([created]);
        toast.success("Task created");

      } else {
        const diff = Object.fromEntries(
          Object.entries(form).filter(
            ([key, value]) =>
              value !== initial.current[key]
          )
        );

        if (Object.keys(diff).length) {
          const { task: updated } =
            await api.patch(`${base}/${task.id}`, {
              ...toPayload(diff),
              expectedVersion: initialVersion.current,
            });

          onUpsert([updated]);
          toast.success("Task updated");
        }
      }

      onClose();

    } catch (err) {
      if (err.status === 409) {
        setHasConflict(true);

        toast.error(
          "This task was modified by another operation. Review the latest task details before saving."
        );

      } else {
        setErrors(err.details || {});

        toast.error(
          err.message || "Could not save the task"
        );
      }

    } finally {
      busy.current = false;
      setSaving(false);
    }
  }


  // ==========================================
  // DELETE TASK
  // ==========================================

  async function remove() {
    if (busy.current || isStale) return;

    if (
      !window.confirm(
        `Delete “${task.title}”? This also removes its comments.`
      )
    ) return;

    busy.current = true;
    setSaving(true);

    try {
      await api.del(`${base}/${task.id}`);

      onDelete(task.id);
      toast.success("Task deleted");
      onClose();

    } catch (err) {
      toast.error(
        err.message || "Could not delete the task"
      );

    } finally {
      busy.current = false;
      setSaving(false);
    }
  }


  // ==========================================
  // MODAL UI
  // ==========================================

  return (
    <Modal
      title={isNew ? "New task" : "Task details"}
      size={isNew ? "lg" : "xl"}
      onClose={onClose}
    >

      {/* Light green introduction */}

      <div className="mb-5 flex items-center gap-3 rounded-xl border border-pulse-200 bg-[linear-gradient(115deg,#f0fdf7,#dff8ed,#c5f1df)] p-4">

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-pulse-700 shadow-sm">

          <ClipboardList size={23} />

        </div>

        <div className="min-w-0">

          <h3 className="text-base font-bold text-pulse-900">

            {isNew
              ? "Create a new task"
              : "Manage your task"}

          </h3>

          <p className="mt-1 text-xs leading-relaxed text-pulse-800">

            {isNew
              ? "Plan the work and assign responsibilities."
              : "Update details and collaborate with your team."}

          </p>

        </div>

      </div>


      <div
        className={clsx(
          "grid min-w-0 gap-5",
          !isNew &&
            "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
        )}
      >

        {/* Concurrent editing warning */}

        {isStale && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 lg:col-span-2"
          >

            <AlertTriangle
              size={21}
              className="mt-0.5 shrink-0"
            />

            <div>

              <p className="font-semibold">
                Task details may be outdated
              </p>

              <p className="mt-1 text-xs leading-relaxed">

                This task has changed or its version is
                unavailable. Copy any unsaved changes you
                want to keep, then refresh the project and
                reopen this task to review the latest details.

              </p>

            </div>

          </div>
        )}


        {/* Task form */}

        <form
          onSubmit={submit}
          className="min-w-0 space-y-4"
          noValidate
        >

          <div className="flex items-center gap-2 border-b border-ink-100 pb-3">

            <ListTodo
              size={17}
              className="text-pulse-700"
            />

            <h3 className="text-sm font-bold text-ink-900">
              Task information
            </h3>

          </div>


          <Field
            label="Title"
            error={firstError(errors, "title")}
          >

            <input
              autoFocus
              className={clsx(
                inputStyle,
                errors.title && "input-error"
              )}
              value={form.title}
              onChange={set("title")}
              maxLength={160}
              placeholder="e.g. Develop landing page"
            />

          </Field>


          <Field
            label="Description"
            error={firstError(errors, "description")}
          >

            <textarea
              className={`${inputStyle} min-h-[110px] resize-y`}
              value={form.description}
              onChange={set("description")}
              maxLength={5000}
              placeholder="What needs to happen, and what does done look like?"
            />

          </Field>


          {/* Task properties */}

          <div className="grid grid-cols-1 gap-3 rounded-xl border border-pulse-100 bg-pulse-50/40 p-3 sm:grid-cols-2">

            <Field
              label={
                <span className="flex items-center gap-1.5">
                  <ListTodo
                    size={14}
                    className="text-pulse-700"
                  />
                  Status
                </span>
              }
              error={firstError(errors, "status")}
            >

              <select
                className="input !rounded-lg"
                value={form.status}
                onChange={set("status")}
              >

                {STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}

              </select>

            </Field>


            <Field
              label={
                <span className="flex items-center gap-1.5">
                  <Flag
                    size={14}
                    className="text-pulse-700"
                  />
                  Priority
                </span>
              }
              error={firstError(errors, "priority")}
            >

              <select
                className="input !rounded-lg"
                value={form.priority}
                onChange={set("priority")}
              >

                {PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}

              </select>

            </Field>


            <Field
              label={
                <span className="flex items-center gap-1.5">
                  <UserRound
                    size={14}
                    className="text-pulse-700"
                  />
                  Assignee
                </span>
              }
              error={firstError(errors, "assigneeId")}
            >

              <select
                className="input !rounded-lg"
                value={form.assigneeId}
                onChange={set("assigneeId")}
              >

                <option value="">Unassigned</option>

                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}

              </select>

            </Field>


            <Field
              label={
                <span className="flex items-center gap-1.5">
                  <CalendarDays
                    size={14}
                    className="text-pulse-700"
                  />
                  Due date
                </span>
              }
              error={firstError(errors, "dueDate")}
            >

              <input
                type="date"
                className="input min-w-0 !rounded-lg"
                value={form.dueDate}
                onChange={set("dueDate")}
              />

            </Field>

          </div>


          {/* Task metadata */}

          {!isNew && (
            <div className="flex items-start gap-2 rounded-xl border border-ink-100 bg-ink-50 p-3">

              <Clock
                size={16}
                className="mt-0.5 shrink-0 text-pulse-700"
              />

              <div className="space-y-1 text-xs leading-relaxed text-ink-500">

                <p>
                  Created by{" "}
                  <span className="font-semibold text-ink-700">
                    {task.creator_name || "a former member"}
                  </span>
                </p>

                <p>
                  {formatDateTime(task.created_at)}
                </p>

                <p>
                  Last updated{" "}
                  {formatDateTime(task.updated_at)}
                </p>

              </div>

            </div>
          )}


          {/* Form actions */}

          <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 pt-4">

            {!isNew && canDelete && (
              <button
                type="button"
                className="btn btn-ghost !rounded-xl !text-rose-600 hover:!bg-rose-50"
                onClick={remove}
                disabled={saving || isStale}
              >

                <Trash2 size={16} />
                Delete

              </button>
            )}


            <button
              type="button"
              className="btn btn-secondary ml-auto !rounded-xl"
              onClick={onClose}
            >
              Cancel
            </button>


            <button
              type="submit"
              className="btn btn-primary !rounded-xl bg-gradient-to-r from-pulse-800 to-pulse-600 shadow-sm"
              disabled={saving || isStale}
            >

              {saving ? (
                <Spinner className="!text-white" />
              ) : isNew ? (
                <Plus size={16} />
              ) : (
                <Check size={16} />
              )}

              {isNew ? "Create task" : "Save changes"}

            </button>

          </div>

        </form>


        {!isNew && (
          <Discussion
            projectId={projectId}
            taskId={task.id}
          />
        )}

      </div>

    </Modal>
  );
}


// ==========================================
// REAL-TIME COMMENTS AND TASK HISTORY
// ==========================================

function Discussion({ projectId, taskId }) {
  const [tab, setTab] = useState("comments");

  const [comments, setComments] = useState(null);

  const [history, setHistory] = useState(null);

  const [body, setBody] = useState("");

  const [sending, setSending] = useState(false);

  const sendingRef = useRef(false);

  const toast = useToast();


  useEffect(() => {
    let active = true;

    api
      .get(`/projects/${projectId}/tasks/${taskId}/comments`)
      .then((d) => {
        if (!active) return;

        setComments((previous) => {
          const byId = new Map(
            d.comments.map((c) => [c.id, c])
          );

          (previous || []).forEach((c) =>
            byId.set(c.id, c)
          );

          return [...byId.values()].sort(
            (a, b) =>
              new Date(a.created_at) -
              new Date(b.created_at)
          );
        });
      })
      .catch(() => {
        if (active) {
          setComments((previous) => previous || []);
        }
      });


    api
      .get(`/projects/${projectId}/activity?taskId=${taskId}`)
      .then((d) => {
        if (!active) return;

        setHistory((previous) => {
          const byId = new Map(
            d.activities.map((a) => [a.id, a])
          );

          (previous || []).forEach((a) =>
            byId.set(a.id, a)
          );

          return [...byId.values()].sort(
            (a, b) =>
              new Date(a.created_at) -
              new Date(b.created_at)
          );
        });
      })
      .catch(() => {
        if (active) {
          setHistory((previous) => previous || []);
        }
      });


    const socket = getSocket();

    const onComment = ({ comment }) =>
      comment.task_id === taskId &&
      setComments((p) =>
        p?.some((c) => c.id === comment.id)
          ? p
          : [...(p || []), comment]
      );

    const onActivity = (a) =>
      a.task_id === taskId &&
      setHistory((p) =>
        p?.some((x) => x.id === a.id)
          ? p
          : [...(p || []), a]
      );

    socket.on("comment:created", onComment);

    socket.on("activity:created", onActivity);

    return () => {
      active = false;

      socket.off("comment:created", onComment);

      socket.off("activity:created", onActivity);
    };

  }, [projectId, taskId]);


  // ==========================================
  // SEND COMMENT
  // ==========================================

  async function send(e) {
    e.preventDefault();

    if (sendingRef.current || !body.trim()) return;

    sendingRef.current = true;
    setSending(true);

    try {
      const { comment } = await api.post(
        `/projects/${projectId}/tasks/${taskId}/comments`,
        { body }
      );

      setComments((p) =>
        p?.some((c) => c.id === comment.id)
          ? p
          : [...(p || []), comment]
      );

      setBody("");

    } catch (err) {
      toast.error(err.message);

    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }


  // ==========================================
  // DISCUSSION UI
  // ==========================================

  return (
    <div className="flex min-h-[22rem] min-w-0 flex-col rounded-2xl border border-pulse-200 bg-gradient-to-b from-pulse-50 to-white p-3.5 sm:p-4">


      {/* Collaboration heading */}

      <div className="mb-4 flex items-center gap-2.5">

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pulse-100 text-pulse-700">

          <MessagesSquare size={20} />

        </div>

        <div>

          <h3 className="text-sm font-bold text-pulse-900">
            Collaboration
          </h3>

          <p className="mt-0.5 text-xs text-pulse-700">
            Discuss and track changes.
          </p>

        </div>

      </div>


      {/* Comments and history tabs */}

      <div
        className="mb-4 flex gap-1 rounded-xl border border-pulse-200 bg-pulse-100/60 p-1"
        role="tablist"
        aria-label="Task discussion"
      >

        {[
          [
            "comments",
            `Comments${comments ? ` (${comments.length})` : ""}`,
            MessageSquare,
          ],
          ["history", "History", History],
        ].map(([id, label, Icon]) => (

          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={clsx(
              "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-semibold transition-colors",

              tab === id
                ? "bg-white text-pulse-800 shadow-sm"
                : "text-pulse-700 hover:bg-white/50"
            )}
          >

            <Icon size={15} className="shrink-0" />

            {label}

          </button>

        ))}

      </div>


      {/* Discussion content */}

      <div className="min-h-[160px] max-h-[360px] flex-1 overflow-y-auto pr-1">

        {tab === "comments" ? (

          comments === null ? (

            <Spinner className="mx-auto mt-6" />

          ) : comments.length === 0 ? (

            <div className="flex flex-col items-center px-3 py-10 text-center">

              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-pulse-100 text-pulse-600">

                <MessageSquare size={23} />

              </div>

              <p className="text-sm font-semibold text-pulse-900">
                Start the conversation
              </p>

              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                Share updates, feedback or questions with your team.
              </p>

            </div>

          ) : (

            <ul className="space-y-3">

              {comments.map((c) => (

                <li
                  key={c.id}
                  className="flex items-start gap-2.5"
                >

                  <div className="shrink-0">

                    <Avatar
                      name={c.user_name || "?"}
                      size="sm"
                    />

                  </div>


                  <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm border border-pulse-100 bg-white p-3 shadow-sm">

                    <div className="flex flex-wrap items-baseline justify-between gap-1">

                      <span className="break-words text-xs font-bold text-pulse-900">

                        {c.user_name || "Former member"}

                      </span>

                      <time
                        className="text-[10px] text-ink-500"
                        title={formatDateTime(c.created_at)}
                      >

                        {timeAgo(c.created_at)}

                      </time>

                    </div>

                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-700">

                      {c.body}

                    </p>

                  </div>

                </li>

              ))}

            </ul>

          )

        ) : history === null ? (

          <Spinner className="mx-auto mt-6" />

        ) : (

          <ActivityList items={history} compact />

        )}

      </div>


      {/* Comment composer */}

      {tab === "comments" && (

        <form
          onSubmit={send}
          className="mt-4 rounded-xl border border-pulse-200 bg-white p-2.5 shadow-sm"
        >

          <textarea
            className="input min-h-[65px] w-full resize-none !rounded-lg !border-transparent !bg-ink-50"
            rows={2}
            value={body}
            maxLength={2000}
            disabled={sending}
            placeholder="Write a comment…"
            aria-label="Write a comment"
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) =>
              (e.metaKey || e.ctrlKey) &&
              e.key === "Enter" &&
              send(e)
            }
          />


          <div className="mt-2 flex items-center justify-between gap-2">

            <span className="text-[10px] tabular-nums text-ink-500">

              {body.length}/2000

            </span>

            <button
              type="submit"
              className="btn btn-primary !rounded-lg bg-gradient-to-r from-pulse-800 to-pulse-600"
              disabled={sending || !body.trim()}
              aria-label="Send comment"
            >

              {sending ? (
                <Spinner className="!text-white" />
              ) : (
                <Send size={15} />
              )}

              Send

            </button>

          </div>

        </form>

      )}

    </div>
  );
}
