import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { authAPI } from '../lib/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '';
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });

  const doRedirect = () => {
    if (redirectTo) {
      navigate(redirectTo);
    } else {
      navigate('/');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authAPI.login({ email: form.email, password: form.password });
      localStorage.setItem('memoir_token', data.access_token);
      localStorage.setItem('memoir_user', JSON.stringify(data.user));
      doRedirect();
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const data = await authAPI.signup({ email: form.email, password: form.password, name: form.name });
      localStorage.setItem('memoir_token', data.access_token);
      localStorage.setItem('memoir_user', JSON.stringify(data.user));
      localStorage.setItem('memoir_user_id', data.user.id);
      doRedirect();
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--page)] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] animate-fade-in-up">
        {/* Letterhead */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full border-2 border-[var(--seal)] flex items-center justify-center">
            <span className="font-display text-2xl text-[var(--seal)]">M</span>
          </div>
          <div className="thread-divider mb-4 max-w-[160px] mx-auto">
            <span className="thread-divider-dot" />
          </div>
          <h1 className="font-display text-[32px] tracking-tight">Memoir</h1>
          <p className="text-[var(--ink-light)] text-sm mt-1 font-mono text-[13px] tracking-[0.02em]">
            Your family's story, forever.
          </p>
        </div>

        {/* Stationery Card */}
        <div className="bg-[var(--vellum)] border border-[var(--border)] rounded-[var(--radius-md)] p-8 md:p-10 shadow-[var(--shadow-sm)] relative">
          {/* Decorative corner thread */}
          <div className="absolute top-4 right-4 w-6 h-6 opacity-30">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="1.5">
              <path d="M2 2 L22 2 L22 22" strokeDasharray="3 3" />
            </svg>
          </div>

          {/* Toggle */}
          <div className="flex items-center gap-3 mb-8">
            <button
              onClick={() => { setIsRegister(false); setError(''); }}
              className={`font-mono text-xs tracking-[0.08em] uppercase transition-colors ${
                !isRegister
                  ? 'text-[var(--ink)] font-medium'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
            >
              Sign In
            </button>
            <span className="w-3 h-px bg-[var(--border)]" />
            <button
              onClick={() => { setIsRegister(true); setError(''); }}
              className={`font-mono text-xs tracking-[0.08em] uppercase transition-colors ${
                isRegister
                  ? 'text-[var(--ink)] font-medium'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 px-4 py-3 bg-[var(--danger-bg)] border border-[var(--danger)]/20 rounded-[var(--radius-sm)] text-[var(--danger)] text-[13px] font-mono text-xs">
              {error}
            </div>
          )}

          {!isRegister ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Enter your password"
                  required
                />
              </div>
              <div className="pt-2">
                <button type="submit" disabled={loading} className="btn-seal w-full">
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-5">
              <div className="form-group">
                <label>Your Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Your full name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                />
              </div>
              <div className="form-group">
                <label>Confirm Password</label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  placeholder="Re-enter password"
                  required
                />
              </div>
              <div className="pt-2">
                <button type="submit" disabled={loading} className="btn-seal w-full">
                  {loading ? 'Creating account...' : 'Create Account'}
                </button>
              </div>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-[var(--border)] text-center">
            <p className="text-[12px] text-[var(--ink-muted)] font-body">
              Joining a family that's already on Memoir?{' '}
              <Link to="/join/demo" className="text-[var(--seal)] hover:underline font-medium">
                Use your invite link
              </Link>
            </p>
          </div>
        </div>

        {/* Footer thread */}
        <div className="mt-8 flex justify-center">
          <div className="thread-line w-24" />
        </div>
      </div>
    </div>
  );
}
