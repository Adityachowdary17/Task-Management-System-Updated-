import React, { useEffect, useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { ArrowLeft, KeyRound, ShieldAlert } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { api, setAuthToken } from '../services/apiClient';
import { UserProfile } from '../types';

interface AuthScreenProps {
  initialMode: 'login' | 'signup';
  onBackToLanding: () => void;
  onAuthenticated: (user: UserProfile, token: string) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  initialMode,
  onBackToLanding,
  onAuthenticated,
}) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'claim'>(initialMode);
  const [needsAdminClaim, setNeedsAdminClaim] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'employee' | 'manager'>('manager');
  const [department, setDepartment] = useState('Engineering');
  const [jobTitle, setJobTitle] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  useEffect(() => {
    api
      .getBootstrapStatus()
      .then((res) => {
        setNeedsAdminClaim(res.needsAdminClaim);
      })
      .catch(() => {
        // ignore
      });
  }, []);

  const handleGoogleSignIn = async () => {
    setError('');
    setInfoMessage('');
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const idToken = await cred.user.getIdToken();
      setAuthToken(idToken);
      const { user } = await api.getMe();
      onAuthenticated(user, idToken);
    } catch (err) {
      setAuthToken(null);
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    setLoading(true);

    try {
      if (mode === 'claim') {
        const res = await api.claimAdmin({ name, email, password, department });
        setAuthToken(res.token);
        onAuthenticated(res.user, res.token);
      } else if (mode === 'signup') {
        const res = await api.signup({ name, email, password, role, department, jobTitle });
        setAuthToken(res.token);
        onAuthenticated(res.user, res.token);
      } else if (mode === 'login') {
        const res = await api.login({ email, password });
        setAuthToken(res.token);
        onAuthenticated(res.user, res.token);
      } else if (mode === 'forgot') {
        const res = await api.forgotPassword(email);
        setInfoMessage(res.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B132B] px-4 py-10 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-md">
        <button
          type="button"
          onClick={onBackToLanding}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Cadence Home
        </button>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-2xl">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0F172A] font-display text-sm font-bold text-white">
              C
            </span>
            <span className="font-display text-lg font-bold text-[#0F172A]">Cadence</span>
          </div>

          {needsAdminClaim && mode !== 'claim' && (
            <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-xs text-blue-950">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <div>
                  <div className="font-semibold">First-run Workspace Admin Setup</div>
                  <p className="mt-0.5 text-blue-900">
                    No administrator password has been claimed yet. Claim the initial Admin role
                    below or sign in with Google.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('claim');
                      setError('');
                    }}
                    className="mt-2 font-semibold text-blue-700 underline cursor-pointer"
                  >
                    Claim Admin Account →
                  </button>
                </div>
              </div>
            </div>
          )}

          <h1 className="mt-5 font-display text-2xl font-bold text-[#0F172A]">
            {mode === 'login' && 'Sign in to your workspace'}
            {mode === 'signup' && 'Create your team account'}
            {mode === 'forgot' && 'Reset your password'}
            {mode === 'claim' && 'Claim Workspace Administrator'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {mode === 'login' && 'Access your manager or employee task dashboard.'}
            {mode === 'signup' && 'Join your team workspace as a Manager or Employee.'}
            {mode === 'forgot' && 'Enter your account email to request a reset.'}
            {mode === 'claim' && 'Set your administrator credentials to unlock full workspace controls.'}
          </p>

          {mode !== 'forgot' && (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleSignIn}
                className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
                <div className="h-px flex-1 bg-slate-200" />
                <span>or use email & password</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {(mode === 'signup' || mode === 'claim') && (
              <div>
                <label className="block text-xs font-semibold text-slate-700">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Morgan"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700">Work Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setError('');
                      }}
                      className="text-xs font-medium text-blue-600 hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  required
                  minLength={mode === 'login' ? 1 : 8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'login' ? 'Enter password' : 'Minimum 8 characters'}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600"
                />
              </div>
            )}

            {mode === 'signup' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value === 'manager' ? 'manager' : 'employee')}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600"
                  >
                    <option value="manager">Manager</option>
                    <option value="employee">Employee</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Department</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Engineering"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600"
                  />
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700">Job Title</label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder={role === 'manager' ? 'Engineering Manager' : 'Product Engineer'}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600"
                />
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {error}
              </div>
            )}

            {infoMessage && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                {infoMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
            >
              {mode === 'claim' && <KeyRound className="h-4 w-4" />}
              {loading
                ? 'Please wait...'
                : mode === 'login'
                  ? 'Sign In'
                  : mode === 'signup'
                    ? 'Create Account'
                    : mode === 'claim'
                      ? 'Claim Admin & Continue'
                      : 'Send Reset Request'}
            </button>
          </form>

          <div className="mt-5 border-t border-slate-100 pt-4 text-center text-xs text-slate-600">
            {mode === 'login' ? (
              <>
                New to Cadence?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError('');
                  }}
                  className="font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className="font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
