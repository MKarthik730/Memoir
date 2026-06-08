import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { familyAPI } from '../lib/api';
import { Users, ArrowRight } from 'lucide-react';

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
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
      <div className="w-full max-w-[440px] bg-[#FAF7F2] rounded-xl shadow-[0_8px_40px_rgba(44,24,16,0.12)] p-10 border border-[rgba(184,151,90,0.2)]">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-[#4A1C0A] rounded-xl flex items-center justify-center">
            <Users size={28} className="text-[#FAF7F2]" />
          </div>
          <h1 className="font-display text-[28px] text-[#4A1C0A]">Create Your Family</h1>
          <p className="font-body italic text-[#8B7355] mt-2">Start your family's story on Memoir</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-8">
            <label className="block mb-1.5 text-xs font-ui tracking-wider uppercase text-[#8B7355]">Family Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. The Motupalli Family"
              required
              className="w-full px-4 py-3 rounded-lg bg-[#F5F0E8] border border-[rgba(184,151,90,0.3)] focus:border-[#B8975A] focus:shadow-[0_0_0_3px_rgba(184,151,90,0.15)] text-[#2C1810] font-ui text-sm outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-3 bg-[#C4857A] hover:brightness-110 text-white rounded-lg font-ui text-sm tracking-wider uppercase transition-all active:scale-[0.97] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? 'Creating...' : <><span>Create Family</span><ArrowRight size={16} /></>}
          </button>
        </form>
      </div>
    </div>
  );
}
