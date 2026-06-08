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

  // For login, we need email+password. For signup, we need name+email+password+confirm
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
    <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0" style={{background: 'radial-gradient(circle at center, #FAF7F2, #E8DDD0)'}} />
      {/* Paper texture overlay */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")'}} />
      
      {/* Center card */}
      <div className="relative w-full max-w-[440px] mx-4">
        <div className="bg-[#FAF7F2] rounded-xl shadow-[0_8px_40px_rgba(44,24,16,0.12)] p-10 border border-[rgba(184,151,90,0.2)]">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-[#4A1C0A] rounded-xl flex items-center justify-center shadow-lg">
              <span className="font-display italic text-[32px] text-[#FAF7F2]">M</span>
            </div>
            <h1 className="font-display text-[36px] text-[#4A1C0A] leading-tight">Memoir</h1>
            <p className="font-body italic text-[#8B7355] mt-1">Your family's story, forever.</p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[rgba(184,151,90,0.2)] mb-8">
            <button
              onClick={() => { setIsRegister(false); setError(''); }}
              className={`flex-1 pb-3 text-sm font-ui tracking-wider uppercase transition-colors ${
                !isRegister ? 'text-[#B8975A] border-b-2 border-[#B8975A]' : 'text-[#8B7355]'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsRegister(true); setError(''); }}
              className={`flex-1 pb-3 text-sm font-ui tracking-wider uppercase transition-colors ${
                isRegister ? 'text-[#B8975A] border-b-2 border-[#B8975A]' : 'text-[#8B7355]'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Login Form */}
          {!isRegister ? (
            <form onSubmit={handleLogin}>
              <div className="mb-4">
                <label className="block mb-1.5 text-xs font-ui tracking-wider uppercase text-[#8B7355]">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B7355]" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="Enter your email"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-[#F5F0E8] border border-[rgba(184,151,90,0.3)] focus:border-[#B8975A] focus:shadow-[0_0_0_3px_rgba(184,151,90,0.15)] text-[#2C1810] font-ui text-sm outline-none transition-all"
                  />
                </div>
              </div>

              <div className="mb-8">
                <label className="block mb-1.5 text-xs font-ui tracking-wider uppercase text-[#8B7355]">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B7355]" />
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Enter your password"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-[#F5F0E8] border border-[rgba(184,151,90,0.3)] focus:border-[#B8975A] focus:shadow-[0_0_0_3px_rgba(184,151,90,0.15)] text-[#2C1810] font-ui text-sm outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#C4857A] hover:brightness-110 text-white rounded-lg font-ui text-sm tracking-wider uppercase transition-all active:scale-[0.97] disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? 'Signing in...' : <><span>Sign In</span><ArrowRight size={16} /></>}
              </button>
            </form>
          ) : (
            /* Signup Form */
            <form onSubmit={handleSignup}>
              <div className="mb-4">
                <label className="block mb-1.5 text-xs font-ui tracking-wider uppercase text-[#8B7355]">Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B7355]" />
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Your full name"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-[#F5F0E8] border border-[rgba(184,151,90,0.3)] focus:border-[#B8975A] focus:shadow-[0_0_0_3px_rgba(184,151,90,0.15)] text-[#2C1810] font-ui text-sm outline-none transition-all"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block mb-1.5 text-xs font-ui tracking-wider uppercase text-[#8B7355]">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B7355]" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="Enter your email"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-[#F5F0E8] border border-[rgba(184,151,90,0.3)] focus:border-[#B8975A] focus:shadow-[0_0_0_3px_rgba(184,151,90,0.15)] text-[#2C1810] font-ui text-sm outline-none transition-all"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block mb-1.5 text-xs font-ui tracking-wider uppercase text-[#8B7355]">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B7355]" />
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Min. 8 characters"
                    required
                    minLength={8}
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-[#F5F0E8] border border-[rgba(184,151,90,0.3)] focus:border-[#B8975A] focus:shadow-[0_0_0_3px_rgba(184,151,90,0.15)] text-[#2C1810] font-ui text-sm outline-none transition-all"
                  />
                </div>
              </div>

              <div className="mb-8">
                <label className="block mb-1.5 text-xs font-ui tracking-wider uppercase text-[#8B7355]">Confirm Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B7355]" />
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    placeholder="Re-enter password"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-[#F5F0E8] border border-[rgba(184,151,90,0.3)] focus:border-[#B8975A] focus:shadow-[0_0_0_3px_rgba(184,151,90,0.15)] text-[#2C1810] font-ui text-sm outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#C4857A] hover:brightness-110 text-white rounded-lg font-ui text-sm tracking-wider uppercase transition-all active:scale-[0.97] disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? 'Creating account...' : <><span>Create Account</span><ArrowRight size={16} /></>}
              </button>
            </form>
          )}

          {/* Join family link */}
          <p className="mt-6 text-center text-sm text-[#8B7355]">
            Join a family instead?{' '}
            <Link to="/join/demo" className="text-[#B8975A] hover:underline">Use your invite link</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
