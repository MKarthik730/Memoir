import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Route, MapPin, Calendar, FileText } from 'lucide-react';
import { familyAPI, tripsAPI } from '../lib/api';

export default function CreateTripPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    location: '',
    start_date: '',
    end_date: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const families = await familyAPI.getMyFamilies();
      if (!Array.isArray(families) || families.length === 0) {
        setError('No family found. Create a family first.');
        setLoading(false);
        return;
      }
      const familyId = families[0].id;
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('family_id', familyId);
      if (form.location) fd.append('location', form.location);
      if (form.start_date) fd.append('start_date', form.start_date);
      if (form.end_date) fd.append('end_date', form.end_date);
      if (form.notes) fd.append('notes', form.notes);
      const trip = await tripsAPI.create(fd);
      navigate(`/trips/${trip.id}`);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to create trip');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[var(--page)]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[var(--vellum)] border-b border-[var(--border)] h-[56px]">
        <div className="max-w-2xl mx-auto px-4 h-full flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center rounded-[6px] text-[var(--ink-light)] hover:bg-[rgba(168,85,66,0.05)] transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-[17px] font-medium text-[var(--ink)]">Plan a New Trip</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in-up">
        {error && (
          <div className="mb-6 px-4 py-3 bg-[var(--danger-bg)] border border-[var(--danger)]/20 rounded-[6px] text-[var(--danger)] text-[13px] flex items-center gap-2 font-mono text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-[var(--vellum)] border border-[var(--border)] rounded-[14px] p-6 space-y-5">
          {/* Trip Name */}
          <div>
            <label className="block text-[12px] font-medium text-[var(--ink-light)] mb-[6px]">Trip Name <span className="text-[var(--danger)]">*</span></label>
            <div className="relative">
              <Route size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Summer Road Trip, Grand Reunion"
                required
                className="w-full pl-10 pr-4 py-3 bg-[var(--vellum)] border border-[var(--border)] rounded-[6px] text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-muted)] outline-none focus:border-[var(--seal)] transition-colors"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-[12px] font-medium text-[var(--ink-light)] mb-[6px]">Location</label>
            <div className="relative">
              <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Goa, Kerala, Grand Canyon"
                className="w-full pl-10 pr-4 py-3 bg-[var(--vellum)] border border-[var(--border)] rounded-[6px] text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-muted)] outline-none focus:border-[var(--seal)] transition-colors"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-[var(--ink-light)] mb-[6px]">Start Date</label>
              <div className="relative">
                <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-[var(--vellum)] border border-[var(--border)] rounded-[6px] text-[14px] text-[var(--ink)] outline-none focus:border-[var(--seal)] transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[var(--ink-light)] mb-[6px]">End Date</label>
              <div className="relative">
                <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-[var(--vellum)] border border-[var(--border)] rounded-[6px] text-[14px] text-[var(--ink)] outline-none focus:border-[var(--seal)] transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[12px] font-medium text-[var(--ink-light)] mb-[6px]">Notes</label>
            <div className="relative">
              <FileText size={16} className="absolute left-4 top-3 text-[var(--ink-muted)]" />
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Highlights, things to remember, inside jokes..."
                rows={4}
                className="w-full pl-10 pr-4 py-3 bg-[var(--vellum)] border border-[var(--border)] rounded-[6px] text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-muted)] outline-none focus:border-[var(--seal)] transition-colors resize-vertical"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !form.name.trim()}
              className="w-full h-[48px] rounded-full bg-[var(--seal)] text-[var(--page)] text-[14px] font-medium hover:bg-[var(--seal-hover)] disabled:opacity-45 transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(168,85,66,0.2)]"
            >
              {loading ? 'Creating...' : 'Create Trip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
