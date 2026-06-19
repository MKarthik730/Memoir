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
        <div className="text-center mb-10">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full border-2 border-[var(--seal)] flex items-center justify-center">
            <Users size={22} className="text-[var(--seal)]" />
          </div>
          <div className="thread-divider max-w-[120px] mx-auto mb-4" />
          <h1 className="font-display text-[28px]">Start Your Family's Story</h1>
          <p className="text-[var(--ink-light)] text-sm mt-1 font-mono text-[13px]">Name your family archive</p>
        </div>

        <div className="bg-[var(--vellum)] border border-[var(--border)] rounded-[var(--radius-md)] p-8 shadow-[var(--shadow-sm)]">
          {error && (
            <div className="mb-5 px-4 py-3 bg-[var(--danger-bg)] border border-[var(--danger)]/20 rounded-[var(--radius-sm)] text-[var(--danger)] text-[13px] font-mono text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: 28 }}>
              <label>Family Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. The Motupalli Family"
                required
              />
            </div>

            <button type="submit" disabled={loading || !name.trim()} className="btn-seal w-full">
              {loading ? 'Creating...' : 'Create Archive'}
            </button>
          </form>
        </div>

        <div className="mt-8 flex justify-center">
          <div className="thread-line w-24" />
        </div>
      </div>
    </div>
  );
}
