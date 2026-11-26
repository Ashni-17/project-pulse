import { useEffect, useRef, useState } from "react";

import {
  Sparkles,
  MessageSquare,
  Send,
  ArrowUpRight,
  ClipboardList,
  Lightbulb,
  Trash2,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

import { pulseAI, getAIError } from "../../lib/ai.js";

import { Spinner } from "../ui";

import { AIHeader, AIError, AIReviewNotice } from "./AIShared.jsx";

// ==========================================
// SUGGESTED QUESTIONS
// ==========================================

const QUESTIONS = [
  "What is our current project progress?",
  "Which tasks are overdue or approaching their deadlines?",
  "Who has the highest active workload?",
  "What should our team focus on next?",
  "Summarize the recent project activities.",
  "Which high-priority tasks are still pending?",
];

const STATUS_LABELS = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

const PRIORITY_STYLES = {
  low: "bg-sky-100 text-sky-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-rose-100 text-rose-700",
};

// ==========================================
// ASK PULSE AI
// ==========================================

export default function AskPulseAI({
  projectId,
  tasks = [],
  members = [],
  activity = [],
  onOpenTask,
}) {
  const [question, setQuestion] = useState("");

  const [messages, setMessages] = useState([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const busy = useRef(false);

  const nextId = useRef(0);
  const questionInputRef = useRef(null);

  // ==========================================
  // AUTOMATIC CONVERSATION SCROLLING
  // ==========================================

  const latestAnswerRef = useRef(null);
  const loadingRef = useRef(null);
  const errorRef = useRef(null);
  const shouldScrollRef = useRef(false);

  useEffect(() => {
    if (!shouldScrollRef.current) return;

    const frame = requestAnimationFrame(() => {
      const target = loading
        ? loadingRef.current
        : error
        ? errorRef.current
        : latestAnswerRef.current;

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

      // Stop automatic scrolling after the request finishes.
      if (!loading) {
        shouldScrollRef.current = false;
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [loading, messages, error]);

  // ==========================================
  // PROJECT CONTEXT SIGNATURE
  // ==========================================

  const signature = JSON.stringify({
    tasks: tasks
      .map((task) => ({
        id: task.id,
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

    activities: activity.slice(0, 20).map((item) => item.id),
  });

  const taskMap = new Map(tasks.map((task) => [task.id, task]));

  // ==========================================
  // SEND QUESTION
  // ==========================================

  async function ask(event) {
    event.preventDefault();

    if (busy.current) return;

    const text = question.trim();

    if (text.length < 3) {
      setError("Please enter a meaningful question.");

      return;
    }

    if (text.length > 1000) {
      setError("Questions cannot exceed 1000 characters.");

      return;
    }

    busy.current = true;
    shouldScrollRef.current = true;

    setLoading(true);
    setError("");
    setQuestion("");
    setError("");
    setQuestion("");

    const requestSignature = signature;

    const userMessage = {
      id: nextId.current++,
      role: "user",
      text,
      createdAt: new Date(),
    };

    setMessages((previous) => [...previous, userMessage]);

    try {
      const result = await pulseAI.ask(projectId, text);

      const aiMessage = {
        id: nextId.current++,

        role: "assistant",

        text: result.answer,

        relatedTaskIds: result.relatedTaskIds || [],

        suggestedActions: result.suggestedActions || [],

        createdAt: new Date(),

        signature: requestSignature,
      };

      setMessages((previous) => [...previous, aiMessage]);
    } catch (err) {
      setError(getAIError(err));

      // Restore the question for manual retry.

      setQuestion(text);

      // Remove the failed request's message.

      setMessages((previous) =>
        previous.filter((message) => message.id !== userMessage.id)
      );
    } finally {
      busy.current = false;

      setLoading(false);
    }
  }

  // ==========================================
  // SELECT SUGGESTED QUESTION
  // ==========================================

  function selectQuestion(text) {
    if (busy.current) return;

    setQuestion(text);
    setError("");

    requestAnimationFrame(() => {
      const target = questionInputRef.current;

      if (!target || target.getClientRects().length === 0) {
        return;
      }

      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      target.focus({ preventScroll: true });

      target.scrollIntoView({
        behavior: reducedMotion ? "instant" : "smooth",
        block: "center",
      });
    });
  }

  // ==========================================
  // CLEAR CONVERSATION
  // ==========================================

  function clearConversation() {
    if (busy.current) return;

    if (
      messages.length &&
      !window.confirm("Clear the current AI conversation?")
    )
      return;

    setMessages([]);
    setQuestion("");
    setError("");
  }

  // ==========================================
  // USER INTERFACE
  // ==========================================

  return (
    <section className="space-y-5">
      <div className="panel p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <AIHeader
            icon={MessageSquare}
            title="Ask Pulse AI"
            description="Get answers about your project, tasks, deadlines and team workload."
          />

          {messages.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={loading}
              onClick={clearConversation}
            >
              <Trash2 size={16} />
              Clear conversation
            </button>
          )}
        </div>

        {/* Green gradient introduction */}

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pulse-900 via-pulse-800 to-pulse-600 p-5 text-white sm:p-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-white/5"
          />

          <div className="relative">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles size={23} className="text-pulse-200" />

              <h3 className="text-xl font-bold">
                Your intelligent project assistant
              </h3>
            </div>

            <p className="max-w-2xl text-sm leading-relaxed text-pulse-100">
              Ask questions about your project progress, pending tasks, team
              workload and recent activities. Get insights based on your project
              data.
            </p>

            <div className="mt-4 flex items-center gap-2 text-xs text-pulse-200">
              <ShieldCheck size={16} />
              Project-scoped, read-only AI assistance
            </div>
          </div>
        </div>

        {/* Suggested questions */}

        <div className="mt-5">
          <h3 className="mb-3 text-sm font-semibold text-ink-700">
            Suggested questions
          </h3>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {QUESTIONS.map((text) => (
              <button
                key={text}
                type="button"
                disabled={loading}
                onClick={() => selectQuestion(text)}
                className="flex items-center justify-between gap-2 rounded-xl border border-ink-200 bg-white p-3 text-left text-xs font-medium text-ink-700 transition-colors hover:border-pulse-400 hover:bg-pulse-50 disabled:opacity-50"
              >
                <span>{text}</span>

                <ArrowUpRight size={15} className="shrink-0 text-pulse-600" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Conversation panel */}

      <div className="panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-ink-100 px-5 py-4">
          <MessageSquare size={19} className="text-pulse-600" />

          <h3 className="font-bold">Project Conversation</h3>
        </div>

        {/* Messages */}

        <div
          role="log"
          aria-label="Pulse AI conversation"
          aria-live="polite"
          className="min-h-[240px] space-y-6 bg-ink-50/50 p-4 sm:p-6"
        >
          {/* Empty conversation */}

          {!messages.length && !loading && (
            <div className="flex flex-col items-center px-4 py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-pulse-100 text-pulse-700">
                <Sparkles size={30} />
              </div>

              <h3 className="text-lg font-bold">
                How can I help your project?
              </h3>

              <p className="mt-2 max-w-sm text-sm text-ink-500">
                Choose a suggested question or type your own question below.
              </p>
            </div>
          )}

          {/* Conversation history */}

          {messages.map((message) => {
            const isUser = message.role === "user";

            const isStale = !isUser && message.signature !== signature;

            // User message

            if (isUser) {
              return (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[90%] rounded-2xl rounded-tr-sm bg-pulse-700 px-4 py-3 text-white sm:max-w-[80%]">
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {message.text}
                    </p>

                    <p className="mt-2 text-right text-[10px] text-pulse-200">
                      {message.createdAt.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            }

            // AI message

            // AI message

            return (
              <div
                key={message.id}
                ref={
                  message.id === messages[messages.length - 1]?.id
                    ? latestAnswerRef
                    : null
                }
                className="flex scroll-mt-24 items-start gap-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pulse-100 text-pulse-700">
                  <Sparkles size={19} />
                </div>

                <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-ink-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-pulse-800">
                      Pulse AI
                    </h4>

                    <span className="text-[10px] text-ink-400">
                      {message.createdAt.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* Outdated answer warning */}

                  {isStale && (
                    <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                      <AlertTriangle size={16} className="shrink-0" />

                      <span>
                        Project data has changed since this answer. Ask again
                        for updated insights.
                      </span>
                    </div>
                  )}

                  {/* AI answer */}

                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-700">
                    {message.text}
                  </p>

                  {/* Related tasks */}

                  {message.relatedTaskIds.length > 0 && (
                    <div className="mt-5 border-t border-ink-100 pt-4">
                      <div className="mb-3 flex items-center gap-2">
                        <ClipboardList size={17} className="text-pulse-600" />

                        <h4 className="text-sm font-semibold">Related Tasks</h4>
                      </div>

                      <div className="space-y-2">
                        {message.relatedTaskIds.map((id) => {
                          const task = taskMap.get(id);

                          if (!task) {
                            return (
                              <p
                                key={id}
                                className="rounded-lg bg-ink-50 p-3 text-xs text-ink-500"
                              >
                                A related task is no longer available.
                              </p>
                            );
                          }

                          return (
                            <button
                              key={id}
                              type="button"
                              disabled={!onOpenTask}
                              onClick={() => onOpenTask?.(id)}
                              className="flex w-full items-center justify-between gap-3 rounded-xl border border-ink-200 p-3 text-left transition-colors hover:border-pulse-300 hover:bg-pulse-50"
                            >
                              <div className="min-w-0">
                                <p className="break-words text-sm font-medium">
                                  {task.title}
                                </p>

                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <span className="text-xs text-ink-500">
                                    {STATUS_LABELS[task.status] || task.status}
                                  </span>

                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                                      PRIORITY_STYLES[task.priority] ||
                                      "bg-ink-100 text-ink-600"
                                    }`}
                                  >
                                    {task.priority}
                                  </span>
                                </div>
                              </div>

                              <ArrowUpRight
                                size={17}
                                className="shrink-0 text-pulse-600"
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Suggested actions */}

                  {message.suggestedActions.length > 0 && (
                    <div className="mt-5 border-t border-ink-100 pt-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Lightbulb size={17} className="text-pulse-600" />

                        <h4 className="text-sm font-semibold">
                          Suggested Next Actions
                        </h4>
                      </div>

                      <ul className="space-y-2">
                        {message.suggestedActions.map((action, index) => (
                          <li
                            key={index}
                            className="flex items-start gap-2 rounded-lg bg-pulse-50 p-3 text-xs leading-relaxed text-pulse-900"
                          >
                            <span className="font-bold">{index + 1}.</span>

                            <span className="min-w-0 break-words">
                              {action}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* AI loading indicator */}

          {loading && (
            <div
              ref={loadingRef}
              role="status"
              className="flex scroll-mt-24 items-start gap-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pulse-100 text-pulse-700">
                <Sparkles size={19} />
              </div>

              <div className="rounded-2xl border border-pulse-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <Spinner />

                  <p className="text-sm font-medium text-pulse-800">
                    Analyzing your project...
                  </p>
                </div>

                <p className="mt-2 text-xs text-ink-500">
                  Preparing an answer using your project data.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Question composer */}

        <div className="space-y-3 border-t border-ink-100 bg-white p-4 sm:p-5">
          {error && (
            <div ref={errorRef} className="scroll-mt-24">
              <AIError message={error} />
            </div>
          )}
          <form onSubmit={ask} className="space-y-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={questionInputRef}
                aria-label="Ask a project question"
                className="input min-h-[80px] flex-1 resize-y"
                value={question}
                maxLength={1000}
                disabled={loading}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask anything about your project..."
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();

                    if (!loading && question.trim().length >= 3) {
                      event.currentTarget.form?.requestSubmit();
                    }
                  }
                }}
              />

              <button
                type="submit"
                aria-label="Send question"
                className="btn btn-primary !p-3"
                disabled={loading || question.trim().length < 3}
              >
                {loading ? (
                  <Spinner className="!text-white" />
                ) : (
                  <Send size={19} />
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
              <span>Enter to send · Shift + Enter for a new line</span>

              <span>{question.length} / 1,000</span>
            </div>
          </form>

          <p className="text-center text-xs text-ink-400">
            Each question is answered independently using project data.
          </p>
        </div>
      </div>

      <AIReviewNotice />
    </section>
  );
}
