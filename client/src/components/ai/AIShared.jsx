import {
  AlertCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { Spinner } from '../ui';

export function AIHeader({
  icon: Icon = Sparkles,
  title,
  description,
}) {
  return (
    <div className="mb-5 flex items-start gap-3">

      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pulse-100 text-pulse-700">
        <Icon size={22} />
      </div>

      <div>
        <h2 className="text-xl font-bold text-ink-900">
          {title}
        </h2>

        <p className="mt-1 text-sm text-ink-500">
          {description}
        </p>
      </div>

    </div>
  );
}

export function AILoading({
  message = 'Pulse AI is analyzing your request...',
}) {
  return (
    <div
      role="status"
      className="flex flex-col items-center rounded-xl border border-pulse-200 bg-pulse-50 px-5 py-10 text-center"
    >

      <Spinner className="mb-3 h-8 w-8" />

      <p className="font-semibold text-pulse-800">
        {message}
      </p>

      <p className="mt-2 text-sm text-ink-500">
        This may take up to 45 seconds.
        Please avoid submitting another request.
      </p>

    </div>
  );
}

export function AIError({ message }) {

  if (!message) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
    >

      <AlertCircle
        size={19}
        className="mt-0.5 shrink-0"
      />

      <p>{message}</p>

    </div>
  );
}

export function AIReviewNotice() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-pulse-200 bg-pulse-50 p-4">

      <ShieldCheck
        size={20}
        className="mt-0.5 shrink-0 text-pulse-700"
      />

      <div>
        <p className="text-sm font-semibold text-pulse-800">
          You are always in control
        </p>

        <p className="mt-1 text-xs leading-relaxed text-pulse-900">
          AI-generated suggestions may contain errors.
          Review all recommendations before applying
          changes to your project.
        </p>
      </div>

    </div>
  );
}

export function AIEmpty({
  title = 'Ready when you are',
  description,
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-pulse-200 bg-pulse-50/40 px-6 py-12 text-center">

      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-pulse-100 text-pulse-600">
        <Sparkles size={26} />
      </div>

      <h3 className="font-semibold text-ink-900">
        {title}
      </h3>

      <p className="mt-2 max-w-sm text-sm text-ink-500">
        {description}
      </p>

    </div>
  );
}