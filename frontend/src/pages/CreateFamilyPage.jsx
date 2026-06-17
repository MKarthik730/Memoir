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
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-[400px] animate-fade-in-up">
        <div className="text-center mb-10">
          <div className="w-12 h-12 mx-auto mb-4 bg-[var(--accent)] rounded-[var(--radius-sm)] flex items-center justify-center">
            <Users size={22} className="text-white" />
          </div>
          <h1 className="font-display text-[28px]">Create Your Family</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">Start your family's story on Memoir</p>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-8 shadow-[var(--shadow-sm)]">
          {error && (
            <div className="mb-5 px-4 py-3 bg-[var(--danger-bg)] border border-[var(--danger)]/20 rounded-[var(--radius-sm)] text-[var(--danger)] text-[13px]">
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

            <button type="submit" disabled={loading || !name.trim()} className="btn btn-primary btn-lg w-full">
              {loading ? 'Creating...' : 'Create Family'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
