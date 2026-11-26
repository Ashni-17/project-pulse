
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  ShieldCheck,
  LockKeyhole,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock,
  Loader2,
} from 'lucide-react';
import { api } from '../lib/api.js';

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}

function PasswordInput({ label, value, onChange, error }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">
        {label}
      </label>

      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${label.toLowerCase()}`}
          autoComplete="new-password"
          className={`w-full rounded-xl border bg-white px-4 py-3 pr-12
            outline-none transition focus:border-teal-500
            focus:ring-2 focus:ring-teal-100
            ${error ? 'border-red-400' : 'border-slate-300'}`}
          required
        />

        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-4 top-1/2 -translate-y-1/2
            text-slate-400 hover:text-slate-700"
        >
          {visible ? <EyeOff size={19} /> : <Eye size={19} />}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

function PasswordStrength({ password }) {
  const checks = [
    password.length >= 8,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];

  const strength = checks.filter(Boolean).length;

  const labels = [
    'Very weak',
    'Weak',
    'Fair',
    'Good',
    'Strong',
  ];

  const colors = [
    'bg-slate-200',
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-emerald-500',
  ];

  if (!password) return null;

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`h-1.5 flex-1 rounded-full ${
              level <= strength
                ? colors[strength]
                : 'bg-slate-200'
            }`}
          />
        ))}
      </div>

      <p className="text-xs text-slate-500">
        Password strength: {labels[strength]}
      </p>
    </div>
  );
}

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const [expiryAt, setExpiryAt] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  const expiresIn = Math.max(
    0,
    Math.ceil((expiryAt - now) / 1000)
  );

  const resendIn = Math.max(
    0,
    Math.ceil((resendAt - now) / 1000)
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  function clearMessages() {
    setError('');
    setSuccess('');
    setFieldErrors({});
  }

  function handleError(err) {
    setError(err.message || 'Something went wrong. Please try again.');
    setFieldErrors(err.details || {});
  }

  async function sendOTP(e) {
    e?.preventDefault();

    if (busy) return;
    if (step === 2 && resendIn > 0) return;

    clearMessages();

    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setBusy(true);

    try {
      const data = await api.post('/auth/forgot-password', {
        email: normalizedEmail,
      });

      const currentTime = Date.now();

      setEmail(normalizedEmail);
      setNow(currentTime);
      setExpiryAt(
        currentTime + (data.expiresIn || 300) * 1000
      );
      setResendAt(
        currentTime + (data.resendAfter || 60) * 1000
      );

      setOtp('');
      setResetToken('');
      setStep(2);

      setSuccess(
        'If an eligible account exists, a verification code has been sent to your email.'
      );
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  async function verifyOTP(e) {
    e.preventDefault();

    if (busy) return;

    clearMessages();

    if (!/^\d{6}$/.test(otp)) {
      setError('Please enter a valid six-digit code.');
      return;
    }

    if (expiresIn === 0) {
      setError('Your code has expired. Request a new code.');
      return;
    }

    setBusy(true);

    try {
      const data = await api.post('/auth/verify-reset-otp', {
        email,
        otp,
      });

      const currentTime = Date.now();

      setResetToken(data.resetToken);
      setNow(currentTime);
      setExpiryAt(
        currentTime + (data.expiresIn || 600) * 1000
      );

      setOtp('');
      setStep(3);
      setSuccess('Verification successful. Create your new password.');
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(e) {
    e.preventDefault();

    if (busy) return;

    clearMessages();

    if (expiresIn === 0) {
      setError('Your reset session has expired. Start again.');
      return;
    }

    if (
      password.length < 8 ||
      !/[A-Za-z]/.test(password) ||
      !/\d/.test(password)
    ) {
      setError(
        'Use at least 8 characters, including a letter and a number.'
      );
      return;
    }

    if (new TextEncoder().encode(password).length > 72) {
      setError('Password must not exceed 72 bytes.');
      return;
    }

    if (password !== confirmPassword) {
      setFieldErrors({
        confirmPassword: ['Passwords do not match.'],
      });
      return;
    }

    setBusy(true);

    try {
      await api.post('/auth/reset-password', {
        resetToken,
        password,
        confirmPassword,
      });

      setResetToken('');
      setPassword('');
      setConfirmPassword('');

      navigate('/login', {
        replace: true,
        state: {
          email,
          success:
            'Password reset successfully! Sign in with your new password.',
        },
      });
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  function startAgain() {
    setStep(1);
    setOtp('');
    setResetToken('');
    setPassword('');
    setConfirmPassword('');
    setExpiryAt(0);
    setResendAt(0);
    clearMessages();
  }

  const titles = {
    1: 'Forgot your password?',
    2: 'Verify your email',
    3: 'Create a new password',
  };

  const descriptions = {
    1: 'Enter your registered email address to recover your account.',
    2: 'Enter the six-digit verification code sent to your email.',
    3: 'Choose a strong password to keep your account protected.',
  };

  const buttonClass =
    'flex w-full items-center justify-center gap-2 rounded-xl ' +
    'bg-teal-600 px-4 py-3 font-semibold text-white transition ' +
    'hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">

      {/* Left branding section */}
      <aside className="relative hidden flex-col justify-between
        overflow-hidden bg-slate-950 p-12 text-white lg:flex">

        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-teal-500 p-2.5">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-6 w-6"
            >
              <path d="M2 12h5l3-8 4 16 3-8h5" />
            </svg>
          </div>

          <span className="text-xl font-bold">
            Project Pulse
          </span>
        </div>

        <div className="relative max-w-xl">

          <svg
            viewBox="0 0 500 150"
            fill="none"
            className="mb-10 w-full text-teal-400"
          >
            <path
              d="M0 75 H100 L130 45 L160 105 L205 10 L245 140 L280 75 H500"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <h1 className="text-5xl font-bold leading-tight">
            Get back to your
            <span className="text-teal-400"> workflow.</span>
          </h1>

          <p className="mt-6 text-lg leading-relaxed text-slate-400">
            Recover your account and continue planning,
            collaborating, and delivering great projects
            with your team.
          </p>
        </div>

        <p className="text-sm text-slate-500">
          Project Pulse | Plan. Collaborate. Deliver.
        </p>
      </aside>

      {/* Right recovery section */}
      <main className="flex min-h-screen items-center justify-center
        bg-slate-50 px-5 py-10 sm:px-10">

        <div className="w-full max-w-md space-y-6">

          <div className="mb-6 text-xl font-bold text-teal-700 lg:hidden">
            Project Pulse
          </div>

          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm
              font-medium text-slate-500 hover:text-teal-600"
          >
            <ArrowLeft size={17} />
            Back to sign in
          </Link>

          {/* Progress indicator */}
          <div className="flex gap-2">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  item <= step ? 'bg-teal-500' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>

          <p className="text-xs font-medium text-slate-500">
            STEP {step} OF 3
          </p>

          <div className="flex h-16 w-16 items-center justify-center
            rounded-2xl bg-teal-100 text-teal-600">
            {step === 1 && <Mail size={30} />}
            {step === 2 && <ShieldCheck size={30} />}
            {step === 3 && <LockKeyhole size={30} />}
          </div>

          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              {titles[step]}
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              {descriptions[step]}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200
                bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {success && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl
                border border-emerald-200 bg-emerald-50
                p-3 text-sm text-emerald-700"
            >
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              {success}
            </div>
          )}

          {/* Step 1: Email */}
          {step === 1 && (
            <form onSubmit={sendOTP} className="space-y-5">

              <div className="space-y-2">
                <label
                  htmlFor="recovery-email"
                  className="block text-sm font-medium text-slate-700"
                >
                  Email address
                </label>

                <input
                  id="recovery-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="w-full rounded-xl border border-slate-300
                    bg-white px-4 py-3 outline-none
                    focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />

                {fieldErrors.email?.[0] && (
                  <p className="text-xs text-red-600">
                    {fieldErrors.email[0]}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={busy}
                className={buttonClass}
              >
                {busy && <Loader2 size={18} className="animate-spin" />}
                {busy ? 'Sending code...' : 'Send verification code'}
              </button>
            </form>
          )}

          {/* Step 2: OTP */}
          {step === 2 && (
            <form onSubmit={verifyOTP} className="space-y-5">

              <div className="rounded-xl border border-slate-200
                bg-white p-3 text-sm text-slate-600">
                Verification email:
                <p className="mt-1 break-all font-semibold text-slate-900">
                  {email}
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="recovery-otp"
                  className="block text-sm font-medium text-slate-700"
                >
                  Verification code
                </label>

                <input
                  id="recovery-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="000000"
                  className="w-full rounded-xl border border-slate-300
                    bg-white px-4 py-4 text-center text-3xl
                    font-bold tracking-[0.4em] outline-none
                    focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div className="flex items-center justify-center gap-2
                text-sm text-slate-500">
                <Clock size={16} />

                {expiresIn > 0 ? (
                  <span>Code expires in {formatTime(expiresIn)}</span>
                ) : (
                  <span className="text-red-600">Code expired</span>
                )}
              </div>

              <button
                type="submit"
                disabled={busy || otp.length !== 6 || expiresIn === 0}
                className={buttonClass}
              >
                {busy && <Loader2 size={18} className="animate-spin" />}
                {busy ? 'Please wait...' : 'Verify code'}
              </button>

              <div className="text-center text-sm text-slate-500">
                Didn't receive the code?{' '}

                <button
                  type="button"
                  onClick={sendOTP}
                  disabled={busy || resendIn > 0}
                  className="font-semibold text-teal-600
                    hover:text-teal-700 disabled:text-slate-400"
                >
                  {resendIn > 0
                    ? `Resend in ${resendIn}s`
                    : 'Resend code'}
                </button>
              </div>

              <button
                type="button"
                onClick={startAgain}
                disabled={busy}
                className="w-full text-center text-sm
                  font-medium text-slate-500 hover:text-teal-600"
              >
                Change email address
              </button>
            </form>
          )}

          {/* Step 3: New password */}
          {step === 3 && (
            <form onSubmit={resetPassword} className="space-y-5">

              <PasswordInput
                label="New password"
                value={password}
                onChange={setPassword}
                error={fieldErrors.password?.[0]}
              />

              <PasswordStrength password={password} />

              <p className="text-xs leading-relaxed text-slate-500">
                Use at least 8 characters, including a letter and a number.
              </p>

              <PasswordInput
                label="Confirm password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                error={fieldErrors.confirmPassword?.[0]}
              />

              {confirmPassword && password === confirmPassword && (
                <p className="flex items-center gap-1.5
                  text-xs text-emerald-600">
                  <CheckCircle2 size={15} />
                  Passwords match
                </p>
              )}

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock size={15} />
                Reset session expires in {formatTime(expiresIn)}
              </div>

              <button
                type="submit"
                disabled={busy || expiresIn === 0}
                className={buttonClass}
              >
                {busy && <Loader2 size={18} className="animate-spin" />}
                {busy ? 'Resetting password...' : 'Reset password'}
              </button>

              <button
                type="button"
                onClick={startAgain}
                disabled={busy}
                className="w-full text-center text-sm
                  font-medium text-slate-500 hover:text-teal-600"
              >
                Start again
              </button>
            </form>
          )}

          <div className="flex items-center justify-center gap-2
            border-t border-slate-200 pt-5 text-xs text-slate-400">
            <ShieldCheck size={16} />
            Secure account recovery
          </div>

        </div>
      </main>
    </div>
  );
}
