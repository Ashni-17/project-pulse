import { useEffect } from 'react';
import clsx from 'clsx';
import { Loader2, X } from 'lucide-react';

export function Logo({ size = 28, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0a0e1c" />
      <path d="M4 17h7l3-8 4 15 3-7h7" fill="none" stroke="#30d0ab" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const AVATAR_TONES = ['bg-violet-100 text-violet-700', 'bg-sky-100 text-sky-700', 'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700', 'bg-pulse-100 text-pulse-800', 'bg-indigo-100 text-indigo-700'];

export function Avatar({ name = '?', size = 'md', className }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const tone = AVATAR_TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  const dim = { sm: 'h-6 w-6 text-[10px]', md: 'h-8 w-8 text-xs', lg: 'h-10 w-10 text-sm' }[size];
  return (
    <span title={name} className={clsx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-white', dim, tone, className)}>
      {initials}
    </span>
  );
}

export const Badge = ({ className, children }) => (
  <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', className)}>{children}</span>
);

export const Spinner = ({ className }) => <Loader2 className={clsx('animate-spin text-pulse-600', className)} size={20} aria-label="Loading" />;

export const PageLoader = () => <div className="flex h-64 items-center justify-center"><Spinner className="h-7 w-7" /></div>;

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-ink-300 px-6 py-12 text-center">
      {Icon && <span className="mb-3 rounded-full bg-ink-100 p-3 text-ink-500"><Icon size={22} /></span>}
      <h3 className="text-base font-semibold text-ink-900">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-ink-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ProgressBar({ value, className, barClassName = 'bg-pulse-500' }) {
  return (
    <div className={clsx('h-2 overflow-hidden rounded-full bg-ink-100', className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={clsx('h-full rounded-full transition-all duration-500', barClassName)} style={{ width: `${value}%` }} />
    </div>
  );
}

export function Field({ label, error, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-rose-600">{error}</span>}
    </label>
  );
}

export function Modal({ title, onClose, children, size = 'md' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const width = { md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-4xl' }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={clsx('flex max-h-[92vh] w-full animate-pop flex-col rounded-t-2xl bg-white shadow-lift sm:rounded-2xl', width)}>
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="btn btn-ghost !p-1.5" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
