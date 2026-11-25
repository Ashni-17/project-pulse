import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Field, Logo, Spinner } from '../components/ui';
import clsx from 'clsx';

function PulseLine() {
  return (
    <svg viewBox="0 0 400 80" className="w-full max-w-md" fill="none" aria-hidden="true">
      <path d="M0 42h120l16-30 28 62 24-48 14 16h198" stroke="#30d0ab" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="120" className="animate-beat" pathLength="120" />
    </svg>
  );
}

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErrors({}); setMessage('');
    try {
      await (isRegister ? register(form) : login({ email: form.email, password: form.password }));
      navigate('/', { replace: true });
    } catch (err) { setErrors(err.details); setMessage(err.message); } finally { setBusy(false); }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="hidden flex-col justify-between bg-ink-950 p-12 text-white lg:flex">
        <div className="flex items-center gap-3"><Logo size={34} /><span className="font-display text-2xl font-bold">Pulse</span></div>
        <div>
          <PulseLine />
          <h1 className="mt-8 max-w-md font-display text-4xl font-bold leading-tight">Know what your team is working on, the moment it changes.</h1>
          <p className="mt-4 max-w-md text-ink-300">Plan projects on a live Kanban board. When a teammate moves a card, you see it move.</p>
        </div>
        <p className="text-sm text-ink-500">Project Pulse</p>
      </aside>

      <main className="flex items-center justify-center px-5 py-10">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4" noValidate>
          <div className="mb-6 flex items-center gap-2.5 lg:hidden"><Logo /><span className="font-display text-xl font-bold">Pulse</span></div>
          <h2 className="font-display text-3xl font-bold">{isRegister ? 'Create your account' : 'Welcome back'}</h2>
          <p className="text-sm text-ink-500">{isRegister ? 'Start organizing work with your team.' : 'Sign in to pick up where you left off.'}</p>
          {message && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{message}</p>}
          {isRegister && <Field label="Full name" error={errors.name?.[0]}><input className={clsx('input', errors.name && 'input-error')} value={form.name} onChange={set('name')} autoComplete="name" autoFocus /></Field>}
          <Field label="Email" error={errors.email?.[0]}><input type="email" className={clsx('input', errors.email && 'input-error')} value={form.email} onChange={set('email')} autoComplete="email" autoFocus={!isRegister} /></Field>
          <Field label="Password" error={errors.password?.[0]} hint={isRegister ? 'At least 8 characters, with a letter and a number.' : undefined}>
            <input type="password" className={clsx('input', errors.password && 'input-error')} value={form.password} onChange={set('password')} autoComplete={isRegister ? 'new-password' : 'current-password'} />
          </Field>
          <button className="btn btn-primary w-full !py-2.5" disabled={busy}>{busy && <Spinner className="!text-white" />}{isRegister ? 'Create account' : 'Sign in'}</button>
          <p className="text-center text-sm text-ink-500">
            {isRegister ? 'Already have an account?' : 'New to Pulse?'}{' '}
            <Link className="font-semibold text-pulse-700 hover:underline" to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
