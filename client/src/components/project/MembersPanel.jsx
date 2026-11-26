
import { useRef, useState } from 'react';

import {
  UserMinus,
  UserPlus,
  Users,
  ShieldCheck,
  UserRound,
  Mail,
  Wifi,
  AlertCircle,
  Info,
} from 'lucide-react';

import clsx from 'clsx';
import { api } from '../../lib/api.js';
import { Avatar, Badge, Spinner } from '../ui';
import { useToast } from '../../context/ToastContext.jsx';


// ==========================================
// TEAM STATISTICS CARD
// ==========================================

function TeamStat({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0 rounded-xl border border-pulse-200/80 bg-white/70 p-3 shadow-sm backdrop-blur-sm sm:p-4">

      <div className="flex items-center justify-between gap-2">

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pulse-100 text-pulse-700">

          <Icon size={18} strokeWidth={1.8} />

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
// MEMBERS PANEL
// ==========================================

export default function MembersPanel({
  projectId,
  members,
  online,
  isOwner,
  onAdded,
  onRemoved,
}) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const addingRef = useRef(false);
  const removingRef = useRef(false);

  const toast = useToast();

  const onlineIds = new Set(
    online.map((u) => u.id)
  );

  const onlineCount = members.filter(
    (m) => onlineIds.has(m.id)
  ).length;

  const ownerCount = members.filter(
    (m) => m.role === 'owner'
  ).length;


  // ==========================================
  // ADD TEAM MEMBER
  // ==========================================

  async function add(e) {
    e.preventDefault();

    if (addingRef.current || !isOwner) return;

    const normalizedEmail =
      email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('Enter a teammate’s email address.');
      return;
    }

    addingRef.current = true;
    setBusy(true);
    setError('');

    try {
      const { member } = await api.post(
        `/projects/${projectId}/members`,
        { email: normalizedEmail }
      );

      onAdded(member);
      setEmail('');

      toast.success(
        `${member.name} joined the project`
      );

    } catch (err) {
      const detail = err.details?.email;

      setError(
        Array.isArray(detail) && detail[0]
          ? `${err.message}. ${detail[0]}`
          : err.message || 'Could not add the member.'
      );

    } finally {
      addingRef.current = false;
      setBusy(false);
    }
  }


  // ==========================================
  // REMOVE TEAM MEMBER
  // ==========================================

  async function remove(member) {
    if (
      removingRef.current ||
      !isOwner ||
      member.role === 'owner'
    ) return;

    if (
      !window.confirm(
        `Remove ${member.name}? Their tasks will become unassigned.`
      )
    ) return;

    removingRef.current = true;
    setRemovingId(member.id);

    try {
      await api.del(
        `/projects/${projectId}/members/${member.id}`
      );

      onRemoved(member.id);

      toast.success(
        `${member.name} was removed from the project`
      );

    } catch (err) {
      toast.error(
        err.message || 'Could not remove the member.'
      );

    } finally {
      removingRef.current = false;
      setRemovingId(null);
    }
  }


  return (
    <div className="mx-auto min-w-0 max-w-4xl space-y-5">


      {/* ==========================================
          TEAM HEADER
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

        <div className="relative">

          <div className="flex items-center gap-3">

            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-pulse-700 shadow-sm">

              <Users size={25} strokeWidth={1.8} />

            </div>

            <div className="min-w-0">

              <h2 className="text-xl font-bold text-pulse-900 sm:text-2xl">
                Project team
              </h2>

              <p className="mt-1 text-xs leading-relaxed text-pulse-800 sm:text-sm">
                Manage teammates and collaborate together.
              </p>

            </div>

          </div>


          {/* Team statistics */}

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">

            <TeamStat
              icon={Users}
              label="Team members"
              value={members.length}
            />

            <TeamStat
              icon={Wifi}
              label="Online now"
              value={onlineCount}
            />

            <TeamStat
              icon={ShieldCheck}
              label="Project owners"
              value={ownerCount}
            />

          </div>

        </div>

      </section>


      {/* ==========================================
          ADD TEAMMATE — OWNER ONLY
          ========================================== */}

      {isOwner && (

        <form
          onSubmit={add}
          className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm"
        >

          <div className="mb-4 flex items-center gap-3">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pulse-100 text-pulse-700">

              <UserPlus size={20} />

            </div>

            <div>

              <label
                htmlFor="member-email"
                className="block text-sm font-bold text-ink-900"
              >
                Add a teammate
              </label>

              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                Enter the email address of a registered user.
              </p>

            </div>

          </div>


          <div className="flex flex-col gap-3 sm:flex-row">

            <div className="relative min-w-0 flex-1">

              <Mail
                size={17}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-pulse-700"
              />

              <input
                id="member-email"
                type="email"
                required
                maxLength={255}
                autoComplete="email"
                disabled={busy}
                aria-invalid={Boolean(error)}
                aria-describedby={
                  error ? 'member-email-error' : undefined
                }
                className={clsx(
                  'input !rounded-xl !bg-ink-50 !py-3 !pl-10 focus:!bg-white',
                  error && 'input-error'
                )}
                placeholder="teammate@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
              />

            </div>


            <button
              type="submit"
              className="btn btn-primary shrink-0 justify-center !rounded-xl bg-gradient-to-r from-pulse-800 to-pulse-600 !px-5 shadow-sm"
              disabled={busy || !email.trim()}
            >

              {busy ? (
                <Spinner className="!text-white" />
              ) : (
                <UserPlus size={17} />
              )}

              {busy ? 'Adding...' : 'Add member'}

            </button>

          </div>


          {error && (

            <div
              id="member-email-error"
              role="alert"
              className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
            >

              <AlertCircle
                size={17}
                className="mt-0.5 shrink-0"
              />

              <p className="break-words">
                {error}
              </p>

            </div>

          )}


          <div className="mt-4 flex items-start gap-2 rounded-lg bg-pulse-50 p-3">

            <Info
              size={15}
              className="mt-0.5 shrink-0 text-pulse-700"
            />

            <p className="text-xs leading-relaxed text-pulse-800">
              Added members can access this project,
              manage tasks and collaborate with the team.
            </p>

          </div>

        </form>

      )}


      {/* ==========================================
          TEAM MEMBERS LIST
          ========================================== */}

      <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pulse-100 bg-gradient-to-r from-pulse-50 to-white p-4 sm:p-5">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pulse-100 text-pulse-700">

              <Users size={20} />

            </div>

            <div>

              <h3 className="text-sm font-bold text-ink-900">
                Team members
              </h3>

              <p className="mt-1 text-xs text-ink-500">
                People with access to this project.
              </p>

            </div>

          </div>

          <span className="rounded-lg border border-pulse-200 bg-white px-3 py-1.5 text-xs font-semibold text-pulse-800">

            {members.length}{' '}
            {members.length === 1 ? 'member' : 'members'}

          </span>

        </div>


        {/* Empty state */}

        {members.length === 0 ? (

          <div className="px-5 py-12 text-center">

            <Users
              size={30}
              className="mx-auto mb-3 text-pulse-500"
            />

            <p className="text-sm font-semibold text-ink-900">
              No team members to display
            </p>

          </div>

        ) : (

          <ul className="divide-y divide-ink-100">

            {members.map((m) => {
              const isOnline = onlineIds.has(m.id);
              const memberIsOwner = m.role === 'owner';
              const isRemoving = removingId === m.id;

              return (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-pulse-50/40 sm:flex-nowrap sm:p-5"
                >

                  {/* Avatar and presence indicator */}

                  <span className="relative shrink-0">

                    <Avatar
                      name={m.name}
                      size="lg"
                    />

                    <span
                      aria-hidden="true"
                      className={clsx(
                        'absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white',

                        isOnline
                          ? 'bg-pulse-500'
                          : 'bg-slate-400'
                      )}
                    />

                  </span>


                  {/* Member information */}

                  <div className="min-w-0 flex-1">

                    <p
                      className="truncate text-sm font-bold text-ink-900 sm:text-base"
                      title={m.name}
                    >
                      {m.name}
                    </p>

                    <p
                      className="mt-0.5 truncate text-xs text-ink-500 sm:text-sm"
                      title={m.email}
                    >
                      {m.email}
                    </p>

                    <div className="mt-1.5 flex items-center gap-1.5">

                      <span
                        aria-hidden="true"
                        className={clsx(
                          'h-1.5 w-1.5 rounded-full',

                          isOnline
                            ? 'bg-pulse-500'
                            : 'bg-slate-400'
                        )}
                      />

                      <span
                        className={clsx(
                          'text-xs font-medium',

                          isOnline
                            ? 'text-pulse-700'
                            : 'text-ink-500'
                        )}
                      >

                        {isOnline ? 'Online' : 'Offline'}

                      </span>

                    </div>

                  </div>


                  {/* Role and permissions */}

                  <div className="ml-auto flex shrink-0 items-center gap-2">

                    <Badge
                      className={clsx(
                        memberIsOwner
                          ? 'bg-pulse-100 text-pulse-800 ring-pulse-200'
                          : 'bg-ink-50 text-ink-600 ring-ink-200'
                      )}
                    >

                      <span className="inline-flex items-center gap-1">

                        {memberIsOwner ? (
                          <ShieldCheck size={13} />
                        ) : (
                          <UserRound size={13} />
                        )}

                        {memberIsOwner ? 'Owner' : 'Member'}

                      </span>

                    </Badge>


                    {/* Remove member — owner only */}

                    {isOwner && !memberIsOwner && (

                      <button
                        type="button"
                        className="btn btn-ghost !rounded-lg !p-2.5 !text-rose-600 hover:!bg-rose-50"
                        onClick={() => remove(m)}
                        disabled={removingId !== null}
                        aria-label={`Remove ${m.name}`}
                        title={`Remove ${m.name}`}
                      >

                        {isRemoving ? (
                          <Spinner />
                        ) : (
                          <UserMinus size={17} />
                        )}

                      </button>

                    )}

                  </div>

                </li>
              );
            })}

          </ul>

        )}

      </section>


      {/* ==========================================
          PERMISSION INFORMATION
          ========================================== */}

      <div className="flex items-start gap-3 rounded-xl border border-pulse-200 bg-pulse-50/60 p-4">

        <ShieldCheck
          size={20}
          className="mt-0.5 shrink-0 text-pulse-700"
        />

        <div>

          <p className="text-sm font-semibold text-pulse-900">
            Project access and permissions
          </p>

          <p className="mt-1 text-xs leading-relaxed text-pulse-800">

            {isOwner
              ? 'As the project owner, you can add and remove team members and manage project settings.'
              : 'You can collaborate on project tasks. Team membership is managed by the project owner.'}

          </p>

        </div>

      </div>

    </div>
  );
}
