import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../lib/api';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authAPI.login({ email: form.email, password: form.password });
      localStorage.setItem('memoir_token', data.access_token);
      localStorage.setItem('memoir_user', JSON.stringify(data.user));
      try {
        const familiesRes = await fetch('/user/families', {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        const families = await familiesRes.json();
        if (Array.isArray(families) && families.length > 0) {
          navigate(`/family/${families[0].id}`);
        } else {
          navigate('/create-family');
        }
      } catch {
        navigate('/create-family');
      }
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
      navigate('/create-family');
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-[400px] animate-fade-in-up">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-12 h-12 mx-auto mb-4 bg-[var(--accent)] rounded-[var(--radius-sm)] flex items-center justify-center">
            <span className="font-display italic text-2xl text-white">M</span>
          </div>
          <h1 className="font-display text-[28px]">Memoir</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">Your family's story, forever.</p>
        </div>

        {/* Card */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-8 shadow-[var(--shadow-sm)]">
          {/* Tabs */}
          <div className="flex bg-[var(--bg)] rounded-[var(--radius-sm)] p-[3px] mb-6">
            <button
              onClick={() => { setIsRegister(false); setError(''); }}
              className={`flex-1 py-[10px] text-center text-[13px] font-medium rounded-[4px] transition-all ${
                !isRegister
                  ? 'bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-sm)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsRegister(true); setError(''); }}
              className={`flex-1 py-[10px] text-center text-[13px] font-medium rounded-[4px] transition-all ${
                isRegister
                  ? 'bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-sm)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 px-4 py-3 bg-[var(--danger-bg)] border border-[var(--danger)]/20 rounded-[var(--radius-sm)] text-[var(--danger)] text-[13px]">
              {error}
            </div>
          )}

          {!isRegister ? (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Email</label>
                <div className="form-input-icon">
                  <Mail size={16} />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 28 }}>
                <label>Password</label>
                <div className="form-input-icon">
                  <Lock size={16} />
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Enter your password"
                    required
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup}>
              <div className="form-group">
                <label>Name</label>
                <div className="form-input-icon">
                  <User size={16} />
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Your full name"
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Email</label>
                <div className="form-input-icon">
                  <Mail size={16} />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Password</label>
                <div className="form-input-icon">
                  <Lock size={16} />
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Min. 8 characters"
                    required
                    minLength={8}
                  />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 28 }}>
                <label>Confirm Password</label>
                <div className="form-input-icon">
                  <Lock size={16} />
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    placeholder="Re-enter password"
                    required
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}

          <p className="mt-5 text-center text-[13px] text-[var(--text-muted)]">
            Join a family instead?{' '}
            <Link to="/join/demo" className="text-[var(--accent)] hover:underline font-medium">
              Use your invite link
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
