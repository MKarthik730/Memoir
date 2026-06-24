import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, MapPin, Calendar, Users, Image, Plus,
  UserPlus, BookOpen, X, Route
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import BottomTabBar from '../components/BottomTabBar';
import MemoryCard from '../components/MemoryCard';
import Avatar from '../components/ui/Avatar';
import { familyAPI, tripsAPI, peopleAPI, memoriesAPI } from '../lib/api';

export default function TripDetailPage() {
  const { trip_id } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [family, setFamily] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [showAddMemory, setShowAddMemory] = useState(false);
  const [people, setPeople] = useState([]);
  const [memories, setMemories] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState('');
  const [selectedMemory, setSelectedMemory] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => { fetchTrip(); }, [trip_id]);

  const fetchTrip = async () => {
    setLoading(true);
    try {
      const data = await tripsAPI.get(trip_id);
      setTrip(data);
      try {
        const familyData = await familyAPI.get(data.family_id);
        setFamily(familyData);
        const peopleData = await peopleAPI.list(data.family_id);
        setPeople(peopleData);
        const allMemories = await Promise.all(
          data.people?.map(p => memoriesAPI.list(p.id).catch(() => [])) || []
        );
        setMemories(allMemories.flat());
      } catch {}
    } catch {} finally { setLoading(false); }
  };

  const handleAddPerson = async () => {
    if (!selectedPerson) return;
    setAdding(true);
    try {
      await tripsAPI.addPerson(trip_id, selectedPerson);
      setShowAddPerson(false);
      setSelectedPerson('');
      fetchTrip();
    } catch {} finally { setAdding(false); }
  };

  const handleAddMemory = async () => {
    if (!selectedMemory) return;
    setAdding(true);
    try {
      await tripsAPI.addMemory(trip_id, selectedMemory);
      setShowAddMemory(false);
      setSelectedMemory('');
      fetchTrip();
    } catch {} finally { setAdding(false); }
  };

  const formatDate = (d) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString('en-US', {
      weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
    });
  };

  const availablePeople = people.filter(
    p => !trip?.people?.some(tp => tp.id === p.id)
  );
  const availableMemories = memories.filter(
    m => !trip?.memories?.some(tm => tm.id === m.id)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--page)] flex items-center justify-center">
        <div className="text-center">
          <div className="thread-line w-32 mx-auto mb-4" />
          <p className="text-[var(--ink-muted)] text-sm font-mono tracking-wider">Unfolding the journey...</p>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-[var(--page)] flex items-center justify-center p-4">
        <div className="text-center animate-fade-in-up">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full border-[1.5px] border-dashed border-[var(--border)] flex items-center justify-center">
            <Route size={26} className="text-[var(--ink-muted)] opacity-40" />
          </div>
          <h1 className="font-display text-xl mb-2">Trip not found</h1>
          <p className="text-[var(--ink-light)] text-sm mb-6">This journey doesn't seem to exist.</p>
          <button onClick={() => navigate('/trips')} className="px-5 py-2 rounded-full bg-[var(--seal)] text-[var(--page)] text-[13px] font-medium hover:bg-[var(--seal-hover)] transition-colors">Back to Trips</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--page)] flex flex-col md:flex-row">
      <Sidebar family={family} familyId={trip.family_id} activePage="trips" />

      <div className="flex-1 min-w-0" style={{ paddingBottom: 80 }}>
        {/* Header */}
        <div className="sticky top-0 z-40 bg-[var(--vellum)] border-b border-[var(--border)] h-[56px]">
          <div className="max-w-4xl mx-auto px-4 h-full flex items-center gap-3">
            <button onClick={() => navigate('/trips')} className="w-9 h-9 flex items-center justify-center rounded-[6px] text-[var(--ink-light)] hover:bg-[rgba(168,85,66,0.05)] transition-colors">
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-[17px] font-medium text-[var(--ink)] truncate">{trip.name}</h1>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
          {/* Hero card */}
          <div className="bg-[var(--vellum)] border border-[var(--border)] rounded-[14px] p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <h1 className="font-display text-[28px] text-[var(--ink)]">{trip.name}</h1>
            </div>

            <div className="flex flex-wrap gap-4 mb-4">
              {trip.location && (
                <div className="flex items-center gap-2 text-[14px] text-[var(--ink-light)]">
                  <MapPin size={16} className="text-[var(--ink-muted)]" />
                  <span>{trip.location}</span>
                </div>
              )}
              {trip.start_date && (
                <div className="flex items-center gap-2 text-[14px] text-[var(--ink-light)]">
                  <Calendar size={16} className="text-[var(--ink-muted)]" />
                  <span>
                    {formatDate(trip.start_date)}
                    {trip.end_date && ` — ${formatDate(trip.end_date)}`}
                  </span>
                </div>
              )}
            </div>

            {trip.notes && (
              <div className="p-4 bg-[var(--page)] rounded-[8px] border border-[var(--border)]">
                <p className="text-[14px] text-[var(--ink)] leading-relaxed whitespace-pre-wrap">{trip.notes}</p>
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 bg-[var(--vellum)] border border-[var(--border)] rounded-[10px] p-4 text-center">
              <p className="font-mono text-xl text-[var(--seal)] font-medium">{trip.people?.length || 0}</p>
              <p className="text-[10px] font-mono text-[var(--ink-muted)] uppercase tracking-[0.05em]">People</p>
            </div>
            <div className="flex-1 bg-[var(--vellum)] border border-[var(--border)] rounded-[10px] p-4 text-center">
              <p className="font-mono text-xl text-[var(--postmark)] font-medium">{trip.memories?.length || 0}</p>
              <p className="text-[10px] font-mono text-[var(--ink-muted)] uppercase tracking-[0.05em]">Memories</p>
            </div>
            <div className="flex-1 bg-[var(--vellum)] border border-[var(--border)] rounded-[10px] p-4 text-center">
              <p className="font-mono text-xl text-[var(--gilt)] font-medium">
                {trip.start_date && trip.end_date
                  ? Math.max(1, Math.ceil((new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24)) + 1)
                  : '—'}
              </p>
              <p className="text-[10px] font-mono text-[var(--ink-muted)] uppercase tracking-[0.05em]">Days</p>
            </div>
          </div>

          {/* People section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-[var(--ink-light)]" />
                <h2 className="font-display text-lg">People</h2>
              </div>
              <button
                onClick={() => setShowAddPerson(true)}
                className="px-3 py-1.5 rounded-full bg-transparent text-[var(--seal)] border border-[var(--seal)] text-[11px] font-medium hover:bg-[rgba(168,85,66,0.08)] transition-colors flex items-center gap-1"
              >
                <UserPlus size={13} />Add
              </button>
            </div>
            {trip.people?.length === 0 ? (
              <div className="text-center py-8 bg-[var(--vellum)] border border-[var(--border)] rounded-[10px]">
                <Users size={24} className="mx-auto mb-2 text-[var(--ink-muted)] opacity-30" />
                <p className="text-sm text-[var(--ink-muted)]">No people added yet</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {trip.people?.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/people/${p.id}`)}
                    className="flex items-center gap-2 px-3 py-2 bg-[var(--vellum)] border border-[var(--border)] rounded-[8px] cursor-pointer hover:bg-[rgba(168,85,66,0.04)] transition-colors"
                  >
                    <Avatar name={p.name} size={28} />
                    <span className="text-[13px] text-[var(--ink)] font-medium">{p.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Memories section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Image size={18} className="text-[var(--ink-light)]" />
                <h2 className="font-display text-lg">Memories</h2>
              </div>
              <button
                onClick={() => setShowAddMemory(true)}
                className="px-3 py-1.5 rounded-full bg-transparent text-[var(--seal)] border border-[var(--seal)] text-[11px] font-medium hover:bg-[rgba(168,85,66,0.08)] transition-colors flex items-center gap-1"
              >
                <Plus size={13} />Add
              </button>
            </div>
            {trip.memories?.length === 0 ? (
              <div className="text-center py-8 bg-[var(--vellum)] border border-[var(--border)] rounded-[10px]">
                <BookOpen size={24} className="mx-auto mb-2 text-[var(--ink-muted)] opacity-30" />
                <p className="text-sm text-[var(--ink-muted)]">No memories linked yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {trip.memories?.map((m, i) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => navigate(`/people/${m.person_id || ''}`)}
                    className="px-4 py-3 bg-[var(--vellum)] border border-[var(--border)] rounded-[8px] cursor-pointer hover:bg-[rgba(168,85,66,0.04)] transition-colors"
                  >
                    <p className="text-[14px] text-[var(--ink)] font-medium">{m.title}</p>
                    {m.story_text && (
                      <p className="text-[12px] text-[var(--ink-light)] mt-1 line-clamp-1">{m.story_text}</p>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        <BottomTabBar activeTab="trips" familyId={trip.family_id} />
      </div>

      {/* Add Person Modal */}
      {showAddPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(28,26,23,0.25)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowAddPerson(false)}>
          <div className="w-full max-w-[400px] bg-[var(--vellum)] rounded-[14px] shadow-[var(--shadow-lg)] animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
              <h2 className="font-display text-lg">Add Person</h2>
              <button onClick={() => setShowAddPerson(false)} className="w-8 h-8 flex items-center justify-center rounded-[6px] text-[var(--ink-muted)] hover:bg-[var(--page)] transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6">
              <select value={selectedPerson} onChange={e => setSelectedPerson(e.target.value)}
                className="w-full px-3 py-3 bg-[var(--vellum)] border border-[var(--border)] rounded-[6px] text-[14px] outline-none focus:border-[var(--seal)] transition-colors mb-5">
                <option value="">Select a person...</option>
                {availablePeople.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div className="flex gap-3">
                <button onClick={() => setShowAddPerson(false)} className="flex-1 px-4 py-2 rounded-full bg-transparent text-[var(--seal)] border border-[var(--seal)] text-[13px] font-medium hover:bg-[rgba(168,85,66,0.08)] transition-colors">Cancel</button>
                <button onClick={handleAddPerson} disabled={adding || !selectedPerson} className="flex-1 px-4 py-2 rounded-full bg-[var(--seal)] text-[var(--page)] text-[13px] font-medium hover:bg-[var(--seal-hover)] disabled:opacity-45 transition-colors">{adding ? 'Adding...' : 'Add'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Memory Modal */}
      {showAddMemory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(28,26,23,0.25)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowAddMemory(false)}>
          <div className="w-full max-w-[400px] bg-[var(--vellum)] rounded-[14px] shadow-[var(--shadow-lg)] animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
              <h2 className="font-display text-lg">Link Memory</h2>
              <button onClick={() => setShowAddMemory(false)} className="w-8 h-8 flex items-center justify-center rounded-[6px] text-[var(--ink-muted)] hover:bg-[var(--page)] transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6">
              <select value={selectedMemory} onChange={e => setSelectedMemory(e.target.value)}
                className="w-full px-3 py-3 bg-[var(--vellum)] border border-[var(--border)] rounded-[6px] text-[14px] outline-none focus:border-[var(--seal)] transition-colors mb-5">
                <option value="">Select a memory...</option>
                {availableMemories.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
              <div className="flex gap-3">
                <button onClick={() => setShowAddMemory(false)} className="flex-1 px-4 py-2 rounded-full bg-transparent text-[var(--seal)] border border-[var(--seal)] text-[13px] font-medium hover:bg-[rgba(168,85,66,0.08)] transition-colors">Cancel</button>
                <button onClick={handleAddMemory} disabled={adding || !selectedMemory} className="flex-1 px-4 py-2 rounded-full bg-[var(--seal)] text-[var(--page)] text-[13px] font-medium hover:bg-[var(--seal-hover)] disabled:opacity-45 transition-colors">{adding ? 'Linking...' : 'Link'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
