import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LoaderCircle, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function OAuthCallback() {
  const { googleLogin } = useAuth();
  const navigate = useNavigate();

  const started = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Prevent duplicate exchange requests
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    // Remove the temporary code from the browser URL
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname
    );

    if (!code) {
      setError('Invalid login session. Please sign in again.');
      return;
    }

    async function completeLogin() {
      try {
        await googleLogin(code);
        navigate('/', { replace: true });
      } catch (err) {
        setError(
          err.message || 'Google sign-in failed. Please try again.'
        );
      }
    }

    completeLogin();
  }, [googleLogin, navigate]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 px-5">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">

        {error ? (
          <>
            <AlertCircle className="mx-auto mb-5 h-12 w-12 text-red-400" />

            <h1 className="text-2xl font-bold text-white">
              Sign-in unsuccessful
            </h1>

            <p className="mt-3 text-sm text-slate-400">
              {error}
            </p>

            <Link
              to="/login"
              className="mt-6 inline-flex rounded-lg bg-teal-500 px-6 py-3 font-semibold text-slate-950 hover:bg-teal-400"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <ShieldCheck className="mx-auto mb-5 h-12 w-12 text-teal-400" />

            <h1 className="text-2xl font-bold text-white">
              Signing you in
            </h1>

            <p className="mt-3 text-sm text-slate-400">
              Please wait while we securely connect your account.
            </p>

            <LoaderCircle className="mx-auto mt-6 h-8 w-8 animate-spin text-teal-400" />

            <p className="mt-6 text-xs text-slate-500">
              Project Pulse · Secure Authentication
            </p>
          </>
        )}

      </div>
    </main>
  );
}