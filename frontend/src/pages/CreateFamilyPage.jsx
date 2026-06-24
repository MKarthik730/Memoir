import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { familyAPI } from '../lib/api';
import { Users } from 'lucide-react';

export default function CreateFamilyPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const family = await familyAPI.create({ name });
      navigate(`/family/${family.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create family');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--page)] flex items-center justify-center p-4">
      <div className="w-full max-w-[400px] animate-fade-in-up">
        <div className="bg-[var(--vellum)] border border-[var(--border)] rounded-[14px] shadow-[0_8px_32px_rgba(28,26,23,0.1)] p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-[var(--seal)] flex items-center justify-center">
            <Users size={22} className="text-[var(--seal)]" />
          </div>
          <h1 className="font-display italic text-[28px] text-[var(--ink)] mb-2">Start Your Family's Story</h1>
          <p className="font-mono text-[12px] text-[var(--ink-muted)] mb-6">Name your family archive</p>

          {error && (
            <div className="mb-5 px-4 py-3 bg-[var(--danger-bg)] border border-[var(--danger)]/20 rounded-[6px] text-[var(--danger)] text-[13px] font-mono text-xs text-left">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="text-left">
            <div className="mb-5">
              <label className="block text-[12px] font-medium text-[var(--ink-light)] mb-[6px]">Family Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. The Motupalli Family"
                required
                className="w-full px-3 py-3 bg-[var(--vellum)] border border-[var(--border)] rounded-[6px] text-[14px] outline-none focus:border-[var(--seal)] transition-colors"
              />
            </div>

            <button type="submit" disabled={loading || !name.trim()} className="w-full h-[48px] rounded-full bg-[var(--seal)] text-[var(--page)] text-[14px] font-medium hover:bg-[var(--seal-hover)] disabled:opacity-45 transition-all active:scale-[0.98]">
              {loading ? 'Creating...' : 'Create Archive'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
