
import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  MailCheck,
  ShieldCheck,
  CheckCircle2,
  ArrowLeft,
  Clock,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext.jsx';
import { Field, Logo, Spinner } from '../components/ui';
import clsx from 'clsx';

// ==========================================
// ANIMATED HEARTBEAT
// ==========================================

function PulseLine() {
  const pulsePath =
    'M0 42 H85 L97 32 L109 42 H132 L145 54 L160 8 L177 74 L193 25 L207 42 H245 L258 30 L273 42 H400';

  return (
    <>
      <style>{`
        @keyframes auth-heartbeat-travel {
          from {
            stroke-dashoffset: 24;
          }
          to {
            stroke-dashoffset: -76;
          }
        }

        .auth-pulse-heartbeat {
          animation: auth-heartbeat-travel 3s linear infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .auth-pulse-heartbeat {
            animation: none;
            stroke-dasharray: none;
          }
        }
      `}</style>

      <svg
        viewBox="0 0 400 80"
        className="w-full max-w-md overflow-visible"
        fill="none"
        aria-hidden="true"
      >
        {/* Background heartbeat line */}

        <path
          d={pulsePath}
          stroke="#30d0ab"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.15"
        />

        {/* Animated heartbeat line */}

        <path
          d={pulsePath}
          pathLength="100"
          stroke="#69e6c6"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="24 76"
          className="auth-pulse-heartbeat"
          style={{
            filter: 'drop-shadow(0 0 5px #30d0ab)',
          }}
        />
      </svg>
    </>
  );
}

// ==========================================
// INITIAL FORM
// ==========================================

const emptyForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
};

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(
    remaining
  ).padStart(2, '0')}`;
}

// ==========================================
// PASSWORD FIELD
// ==========================================

function PasswordField({
  label,
  value,
  onChange,
  error,
  autoComplete,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <Field label={label} error={error}>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          className={clsx(
            'input !pr-12',
            error && 'input-error'
          )}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder="Enter password"
        />

        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={
            visible ? 'Hide password' : 'Show password'
          }
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-pulse-700"
        >
          {visible ? (
            <EyeOff size={18} />
          ) : (
            <Eye size={18} />
          )}
        </button>
      </div>
    </Field>
  );
}

// ==========================================
// PASSWORD STRENGTH
// ==========================================

function PasswordStrength({ password }) {
  if (!password) return null;

  const checks = [
    password.length >= 8,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];

  const score = checks.filter(Boolean).length;

  const labels = [
    'Very weak',
    'Weak',
    'Fair',
    'Good',
    'Strong',
  ];

  const colors = [
    'bg-rose-500',
    'bg-rose-500',
    'bg-amber-500',
    'bg-teal-500',
    'bg-emerald-500',
  ];

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={clsx(
              'h-1.5 flex-1 rounded-full transition-colors',
              level <= score
                ? colors[score]
                : 'bg-slate-200'
            )}
          />
        ))}
      </div>

      <p className="text-xs text-ink-500">
        Password strength: {labels[score]}
      </p>

      <p className="text-xs text-ink-500">
        Use at least 8 characters, including a letter and a number.
      </p>
    </div>
  );
}

// ==========================================
// AUTHENTICATION PAGE
// ==========================================

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register';

  const {
    login,
    register,
    verifyOTP,
    resendOTP,
    sessionMessage,
    clearSessionMessage,
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const [registration, setRegistration] = useState(null);
  const [otp, setOtp] = useState('');

  const [expiryAt, setExpiryAt] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  const isOTP = isRegister && Boolean(registration);

  const expiry = Math.max(
    0,
    Math.ceil((expiryAt - now) / 1000)
  );

  const cooldown = Math.max(
    0,
    Math.ceil((resendAt - now) / 1000)
  );

  // ==========================================
  // RESET FORM
  // ==========================================

  useEffect(() => {
    setForm({
      ...emptyForm,
      email: location.state?.email || '',
    });

    setErrors({});
    setMessage('');
    setSuccess(location.state?.success || '');
    setRegistration(null);
    setOtp('');
    setExpiryAt(0);
    setResendAt(0);
  }, [mode, location.key]);

  // ==========================================
  // OTP COUNTDOWN
  // ==========================================

  useEffect(() => {
    if (!isOTP) return;

    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [isOTP]);

  const set = (key) => (event) => {
    setForm((previous) => ({
      ...previous,
      [key]: event.target.value,
    }));

    setErrors((previous) => ({
      ...previous,
      [key]: undefined,
    }));
  };

  function startTimers(data) {
    const current = Date.now();

    setNow(current);

    setExpiryAt(
      current + (data.expiresIn ?? 300) * 1000
    );

    setResendAt(
      current + (data.resendAfter ?? 60) * 1000
    );
  }

  // ==========================================
  // LOGIN, REGISTER AND OTP VERIFICATION
  // ==========================================

  async function submit(event) {
    event.preventDefault();

    if (busy) return;

    setErrors({});
    setMessage('');
    setSuccess('');

    if (
      isRegister &&
      !isOTP &&
      form.password !== form.confirmPassword
    ) {
      setErrors({
        confirmPassword: ['Passwords do not match'],
      });

      return;
    }

    if (isOTP && !/^\d{6}$/.test(otp)) {
      setMessage(
        'Enter a valid six-digit verification code.'
      );

      return;
    }

    if (isOTP && expiry === 0) {
      setMessage(
        'Your code has expired. Request a new code.'
      );

      return;
    }

    setBusy(true);

    try {
      if (isOTP) {
        await verifyOTP(
          registration.registrationId,
          otp
        );

        navigate('/login', {
          replace: true,
          state: {
            email: registration.email,
            success:
              'Email verified successfully! You can now sign in.',
          },
        });
      } else if (isRegister) {
        const data = await register(form);

        setRegistration(data);
        setOtp('');
        startTimers(data);

        // Remove passwords after OTP is sent.

        setForm((previous) => ({
          ...previous,
          password: '',
          confirmPassword: '',
        }));

        setSuccess(
          'Verification code sent to your email.'
        );
      } else {
        await login({
          email: form.email,
          password: form.password,
        });

        navigate('/', { replace: true });
      }
    } catch (err) {
      setErrors(err.details || {});

      setMessage(
        err.message || 'Something went wrong.'
      );
    } finally {
      setBusy(false);
    }
  }

  // ==========================================
  // RESEND OTP
  // ==========================================

  async function handleResend() {
    if (!registration || cooldown > 0 || busy) return;

    setBusy(true);
    setMessage('');
    setSuccess('');
    setErrors({});

    try {
      const data = await resendOTP(
        registration.registrationId
      );

      setOtp('');
      startTimers(data);

      setSuccess(
        'A new verification code has been sent.'
      );
    } catch (err) {
      setMessage(
        err.message || 'Unable to resend verification code.'
      );
    } finally {
      setBusy(false);
    }
  }

  function backToRegister() {
    setRegistration(null);
    setOtp('');
    setErrors({});
    setMessage('');
    setSuccess('');
    setExpiryAt(0);
    setResendAt(0);
  }

  // ==========================================
  // PREMIUM AUTHENTICATION LAYOUT
  // ==========================================

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-pulse-900 via-pulse-800 to-pulse-600 p-3 sm:p-6 lg:p-8">

      {/* Floating authentication container */}

      <div className="grid w-full max-w-[1440px] rounded-[28px] bg-ink-50 p-2 shadow-2xl sm:p-3 lg:min-h-[calc(100vh-64px)] lg:grid-cols-[1.05fr_1fr]">

        {/* ==========================================
            BRANDING SECTION
            ========================================== */}

        <aside className="relative hidden flex-col justify-between overflow-hidden rounded-[22px] bg-gradient-to-br from-ink-950 via-pulse-900 to-pulse-800 p-10 text-white lg:flex xl:p-12">

          {/* Existing logo */}

          <div className="flex items-center gap-3">
            <Logo size={38} />

            <span className="font-display text-2xl font-bold">
              Pulse
            </span>
          </div>

          {/* Existing branding content */}

          <div>
            <PulseLine />

            <h1 className="mt-8 max-w-lg font-display text-5xl font-bold leading-tight">
              Great teamwork starts with a pulse.
            </h1>

            <p className="mt-5 max-w-md text-base leading-relaxed text-ink-300">
              Plan projects, collaborate in real time, and keep
              your entire team moving towards the same goal.
            </p>
          </div>

          <div className="text-sm text-ink-500">
            Project Pulse | Plan. Collaborate. Deliver.
          </div>
        </aside>

        {/* ==========================================
            AUTHENTICATION SECTION
            ========================================== */}

        <main className="flex min-w-0 items-center justify-center rounded-[22px] px-5 py-10 sm:px-10 lg:px-12">

          {/* Existing form design preserved */}

          <form
            onSubmit={submit}
            className="w-full max-w-md space-y-5"
            noValidate
          >

            {/* Mobile logo */}

            <div className="mb-6 flex items-center gap-2.5 lg:hidden">
              <Logo />

              <span className="font-display text-xl font-bold">
                Pulse
              </span>
            </div>

            {/* Back to registration */}

            {isOTP && (
              <button
                type="button"
                onClick={backToRegister}
                disabled={busy}
                className="flex items-center gap-2 text-sm text-ink-500 hover:text-pulse-700"
              >
                <ArrowLeft size={16} />

                Back to registration
              </button>
            )}

            {/* OTP verification icon */}

            {isOTP && (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                <MailCheck size={32} />
              </div>
            )}

            {/* Existing form heading */}

            <div className="space-y-2">
              <h2 className="font-display text-3xl font-bold">
                {isOTP
                  ? 'Verify your email'
                  : isRegister
                    ? 'Create your account'
                    : 'Welcome back'}
              </h2>

              <p className="text-sm leading-relaxed text-ink-500">
                {isOTP
                  ? 'Enter the six-digit verification code sent to your email address.'
                  : isRegister
                    ? 'Start organizing work with your team.'
                    : 'Sign in to pick up where you left off.'}
              </p>
            </div>

            {/* Session security message */}

            {!isRegister && sessionMessage && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800"
              >
                <ShieldCheck
                  size={20}
                  className="mt-0.5 shrink-0"
                />

                <div className="flex-1">
                  <p className="text-sm font-semibold">
                    Session ended
                  </p>

                  <p className="mt-1 text-sm">
                    {sessionMessage}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={clearSessionMessage}
                  className="text-xs font-semibold hover:underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Error message */}

            {message && (
              <p
                role="alert"
                className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
              >
                {message}
              </p>
            )}

            {/* Success message */}

            {success && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
              >
                <CheckCircle2
                  size={18}
                  className="mt-0.5 shrink-0"
                />

                <span>{success}</span>
              </div>
            )}

            {/* ==========================================
                OTP VERIFICATION FORM
                ========================================== */}

            {isOTP ? (
              <>
                <div className="break-all rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium">
                  {registration.email}
                </div>

                <Field
                  label="Verification code"
                  error={errors.otp?.[0]}
                >
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    autoFocus
                    placeholder="000000"
                    value={otp}
                    onChange={(event) =>
                      setOtp(
                        event.target.value
                          .replace(/\D/g, '')
                          .slice(0, 6)
                      )
                    }
                    className={clsx(
                      'input text-center !text-2xl font-bold tracking-[0.4em]',
                      errors.otp && 'input-error'
                    )}
                  />
                </Field>

                {/* OTP expiry timer */}

                <div className="flex items-center justify-center gap-2 text-sm">
                  <Clock size={16} />

                  {expiry > 0 ? (
                    <span className="text-ink-500">
                      Code expires in{' '}
                      <strong>{formatTime(expiry)}</strong>
                    </span>
                  ) : (
                    <span className="font-medium text-rose-600">
                      Verification code expired
                    </span>
                  )}
                </div>

                {/* Verify email button */}

                <button
                  type="submit"
                  className="btn btn-primary w-full !py-3"
                  disabled={
                    busy ||
                    otp.length !== 6 ||
                    expiry === 0
                  }
                >
                  {busy && (
                    <Spinner className="!text-white" />
                  )}

                  Verify email
                </button>

                {/* Resend OTP */}

                <div className="text-center text-sm text-ink-500">
                  Didn't receive the code?{' '}

                  <button
                    type="button"
                    disabled={cooldown > 0 || busy}
                    onClick={handleResend}
                    className="font-semibold text-pulse-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {cooldown > 0
                      ? `Resend in ${cooldown}s`
                      : 'Resend OTP'}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* ==========================================
                    LOGIN AND REGISTER FORM
                    ========================================== */}

                {isRegister && (
                  <Field
                    label="Full name"
                    error={errors.name?.[0]}
                  >
                    <input
                      className={clsx(
                        'input',
                        errors.name && 'input-error'
                      )}
                      value={form.name}
                      onChange={set('name')}
                      autoComplete="name"
                      placeholder="Enter your full name"
                      autoFocus
                    />
                  </Field>
                )}

                {/* Email address */}

                <Field
                  label="Email address"
                  error={errors.email?.[0]}
                >
                  <input
                    type="email"
                    className={clsx(
                      'input',
                      errors.email && 'input-error'
                    )}
                    value={form.email}
                    onChange={set('email')}
                    autoComplete="email"
                    placeholder="you@example.com"
                    autoFocus={!isRegister}
                  />
                </Field>

                {/* Password */}

                <PasswordField
                  label="Password"
                  value={form.password}
                  onChange={set('password')}
                  error={errors.password?.[0]}
                  autoComplete={
                    isRegister
                      ? 'new-password'
                      : 'current-password'
                  }
                />

                {/* Forgot password */}

                {!isRegister && (
                  <div className="flex justify-end">
                    <Link
                      to="/forgot-password"
                      className="text-sm font-semibold text-teal-600 hover:text-teal-700 hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                )}

                {/* Registration password validation */}

                {isRegister && (
                  <>
                    <PasswordStrength
                      password={form.password}
                    />

                    <PasswordField
                      label="Confirm password"
                      value={form.confirmPassword}
                      onChange={set('confirmPassword')}
                      error={errors.confirmPassword?.[0]}
                      autoComplete="new-password"
                    />

                    {form.confirmPassword &&
                      form.password ===
                        form.confirmPassword && (
                        <p className="flex items-center gap-1.5 text-xs text-emerald-600">
                          <CheckCircle2 size={14} />

                          Passwords match
                        </p>
                      )}
                  </>
                )}

                {/* Sign in / Create account */}

                <button
                  type="submit"
                  className="btn btn-primary w-full !py-3"
                  disabled={busy}
                >
                  {busy && (
                    <Spinner className="!text-white" />
                  )}

                  {isRegister
                    ? 'Create account'
                    : 'Sign in'}
                </button>

                {/* ==========================================
                    GOOGLE AUTHENTICATION
                    ========================================== */}

                {!isOTP && (
                  <>
                    <div className="flex items-center gap-4 my-5">
                      <div className="flex-1 border-t border-slate-200" />

                      <span className="text-xs text-slate-400">
                        OR CONTINUE WITH
                      </span>

                      <div className="flex-1 border-t border-slate-200" />
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        window.location.href =
                          `${import.meta.env.VITE_SERVER_URL || 'http://localhost:4000'}/api/auth/google`;
                      }}
                      className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:bg-teal-50 hover:border-teal-500 hover:shadow-md disabled:opacity-50"
                    >
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 48 48"
                        aria-hidden="true"
                      >
                        <path
                          fill="#4285F4"
                          d="M43.61 24.46c0-1.36-.12-2.67-.34-3.94H24v7.45h11.02a9.42 9.42 0 0 1-4.08 6.18v5.14h6.62c3.87-3.56 6.05-8.8 6.05-14.83z"
                        />

                        <path
                          fill="#34A853"
                          d="M24 44c5.51 0 10.13-1.83 13.5-4.96l-6.62-5.14c-1.83 1.23-4.17 1.97-6.88 1.97-5.32 0-9.83-3.59-11.45-8.42H5.72v5.3A20 20 0 0 0 24 44z"
                        />

                        <path
                          fill="#FBBC05"
                          d="M12.55 27.45a12.04 12.04 0 0 1 0-6.9v-5.3H5.72a20 20 0 0 0 0 17.5l6.83-5.3z"
                        />

                        <path
                          fill="#EA4335"
                          d="M24 12.13c3 0 5.69 1.03 7.81 3.06l5.86-5.86C34.12 6.02 29.51 4 24 4A20 20 0 0 0 5.72 15.25l6.83 5.3C14.17 15.72 18.68 12.13 24 12.13z"
                        />
                      </svg>

                      Continue with Google
                    </button>
                  </>
                )}

                {/* Switch between login and register */}

                <p className="text-center text-sm text-ink-500">
                  {isRegister
                    ? 'Already have an account?'
                    : 'New to Pulse?'}{' '}

                  <Link
                    className="font-semibold text-pulse-700 hover:underline"
                    to={isRegister ? '/login' : '/register'}
                  >
                    {isRegister
                      ? 'Sign in'
                      : 'Create an account'}
                  </Link>
                </p>
              </>
            )}

            {/* Security footer */}

            <div className="flex items-center justify-center gap-2 border-t border-slate-200 pt-5 text-xs text-ink-500">
              <ShieldCheck
                size={16}
                className="text-teal-600"
              />

              {isRegister
                ? 'Email verification helps protect your account'
                : 'Sign in to your Project Pulse workspace'}
            </div>

          </form>
        </main>
      </div>
    </div>
  );
}
