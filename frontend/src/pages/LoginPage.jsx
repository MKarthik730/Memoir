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
      <div className="w-full max-w-[400px]">
        {/* Card */}
        <div className="bg-[var(--vellum)] border border-[var(--border)] rounded-[14px] shadow-[0_8px_32px_rgba(28,26,23,0.1)] p-8 animate-fade-in-up text-center">
          {/* Logo */}
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-[var(--seal)] flex items-center justify-center">
            <span className="font-display italic text-xl text-[var(--seal)]">M</span>
          </div>
          <h1 className="font-display italic text-[28px] text-[var(--ink)] mb-1">Memoir</h1>
          <p className="font-mono text-[12px] text-[var(--ink-muted)] mb-6">Your family's story, forever.</p>

          {/* Tab row */}
          <div className="flex items-center justify-center gap-0 mb-5">
            <button
              onClick={() => { setIsRegister(false); setError(''); }}
              className={`font-mono text-[11px] uppercase tracking-[0.08em] px-4 py-2 transition-colors ${
                !isRegister
                  ? 'text-[var(--seal)] font-medium border-b-2 border-[var(--seal)]'
                  : 'text-[var(--ink-muted)] border-b-2 border-transparent hover:text-[var(--ink)]'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsRegister(true); setError(''); }}
              className={`font-mono text-[11px] uppercase tracking-[0.08em] px-4 py-2 transition-colors ${
                isRegister
                  ? 'text-[var(--seal)] font-medium border-b-2 border-[var(--seal)]'
                  : 'text-[var(--ink-muted)] border-b-2 border-transparent hover:text-[var(--ink)]'
              }`}
            >
              Sign Up
            </button>
          </div>

          <div className="thread-line mb-6" />

          {/* Error */}
          {error && (
            <div className="mb-5 px-4 py-3 bg-[var(--danger-bg)] border border-[var(--danger)]/20 rounded-[6px] text-[var(--danger)] text-[13px] font-mono text-xs text-left">
              {error}
            </div>
          )}

          {!isRegister ? (
            <form onSubmit={handleLogin} className="text-left">
              <div className="mb-4">
                <label className="block text-[12px] font-medium text-[var(--ink-light)] mb-[6px]">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  required
                  className="w-full px-3 py-3 bg-[var(--vellum)] border border-[var(--border)] rounded-[6px] text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-muted)] outline-none transition-all focus:border-[var(--seal)] focus:shadow-[0_0_0_3px_rgba(168,85,66,0.08)]"
                />
              </div>
              <div className="mb-5">
                <label className="block text-[12px] font-medium text-[var(--ink-light)] mb-[6px]">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Enter your password"
                  required
                  className="w-full px-3 py-3 bg-[var(--vellum)] border border-[var(--border)] rounded-[6px] text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-muted)] outline-none transition-all focus:border-[var(--seal)] focus:shadow-[0_0_0_3px_rgba(168,85,66,0.08)]"
                />
              </div>
              <button type="submit" disabled={loading} className="w-full h-[48px] rounded-[999px] bg-[var(--seal)] text-[var(--page)] text-[14px] font-medium hover:bg-[var(--seal-hover)] disabled:opacity-45 transition-all active:scale-[0.98]">
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="text-left">
              <div className="mb-4">
                <label className="block text-[12px] font-medium text-[var(--ink-light)] mb-[6px]">Your Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Your full name"
                  required
                  className="w-full px-3 py-3 bg-[var(--vellum)] border border-[var(--border)] rounded-[6px] text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-muted)] outline-none transition-all focus:border-[var(--seal)] focus:shadow-[0_0_0_3px_rgba(168,85,66,0.08)]"
                />
              </div>
              <div className="mb-4">
                <label className="block text-[12px] font-medium text-[var(--ink-light)] mb-[6px]">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  required
                  className="w-full px-3 py-3 bg-[var(--vellum)] border border-[var(--border)] rounded-[6px] text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-muted)] outline-none transition-all focus:border-[var(--seal)] focus:shadow-[0_0_0_3px_rgba(168,85,66,0.08)]"
                />
              </div>
              <div className="mb-4">
                <label className="block text-[12px] font-medium text-[var(--ink-light)] mb-[6px]">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                  className="w-full px-3 py-3 bg-[var(--vellum)] border border-[var(--border)] rounded-[6px] text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-muted)] outline-none transition-all focus:border-[var(--seal)] focus:shadow-[0_0_0_3px_rgba(168,85,66,0.08)]"
                />
              </div>
              <div className="mb-5">
                <label className="block text-[12px] font-medium text-[var(--ink-light)] mb-[6px]">Confirm Password</label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  placeholder="Re-enter password"
                  required
                  className="w-full px-3 py-3 bg-[var(--vellum)] border border-[var(--border)] rounded-[6px] text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-muted)] outline-none transition-all focus:border-[var(--seal)] focus:shadow-[0_0_0_3px_rgba(168,85,66,0.08)]"
                />
              </div>
              <button type="submit" disabled={loading} className="w-full h-[48px] rounded-[999px] bg-[var(--seal)] text-[var(--page)] text-[14px] font-medium hover:bg-[var(--seal-hover)] disabled:opacity-45 transition-all active:scale-[0.98]">
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}

          {/* Bottom link */}
          <div className="mt-6 pt-5 border-t border-[var(--border)]">
            <p className="text-[13px] text-[var(--ink-light)]">
              Joining a family that's already on Memoir?{' '}
              <Link to="/join/demo" className="text-[var(--seal)] hover:underline font-medium">
                Use your invite link
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
