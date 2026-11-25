import { useState } from 'react';
import { UserMinus, UserPlus } from 'lucide-react';
import { api } from '../../lib/api.js';
import { Avatar, Badge, Spinner } from '../ui';
import { useToast } from '../../context/ToastContext.jsx';

export default function MembersPanel({ projectId, members, online, isOwner, onAdded, onRemoved }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const onlineIds = new Set(online.map((u) => u.id));

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { member } = await api.post(`/projects/${projectId}/members`, { email });
      onAdded(member);
      setEmail('');
      toast.success(`${member.name} joined the project`);
    } catch (err) { setError(err.details?.email?.[0] ? `${err.message}. ${err.details.email[0]}` : err.message); } finally { setBusy(false); }
  }

  async function remove(member) {
    if (!window.confirm(`Remove ${member.name}? Their tasks will become unassigned.`)) return;
    try {
      await api.del(`/projects/${projectId}/members/${member.id}`);
      onRemoved(member.id);
    } catch (err) { toast.error(err.message); }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {isOwner && (
        <form onSubmit={add} className="panel p-4">
          <label htmlFor="member-email" className="mb-1.5 block text-sm font-semibold">Add a teammate</label>
          <div className="flex gap-2">
            <input id="member-email" type="email" required className="input" placeholder="Email of a registered user" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn btn-primary shrink-0" disabled={busy}>{busy ? <Spinner className="!text-white" /> : <UserPlus size={16} />}Add</button>
          </div>
          {error && <p className="mt-2 text-sm font-medium text-rose-600">{error}</p>}
        </form>
      )}
      <ul className="panel divide-y divide-ink-100">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 p-3.5">
            <span className="relative"><Avatar name={m.name} size="lg" />
              {onlineIds.has(m.id) && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-pulse-500" title="Online now" />}
            </span>
            <div className="min-w-0 flex-1"><p className="truncate font-semibold">{m.name}</p><p className="truncate text-sm text-ink-500">{m.email}</p></div>
            <Badge className={m.role === 'owner' ? 'bg-ink-900 text-white ring-ink-900' : 'bg-ink-50 text-ink-600 ring-ink-200'}>{m.role === 'owner' ? 'Owner' : 'Member'}</Badge>
            {isOwner && m.role !== 'owner' && <button className="btn btn-ghost !p-2 hover:!text-rose-600" onClick={() => remove(m)} aria-label={`Remove ${m.name}`}><UserMinus size={16} /></button>}
          </li>
        ))}
      </ul>
    </div>
  );
}
