import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Route, MapPin, Calendar, Users, Image, Plus } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import BottomTabBar from '../components/BottomTabBar';
import { familyAPI, tripsAPI } from '../lib/api';

export default function TripsPage() {
  const navigate = useNavigate();
  const [familyId, setFamilyId] = useState(null);
  const [family, setFamily] = useState(null);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    familyAPI.getMyFamilies().then(families => {
      if (Array.isArray(families) && families.length > 0) {
        const fid = families[0].id;
        setFamilyId(fid);
        familyAPI.get(fid).then(setFamily).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!familyId) return;
    fetchTrips();
  }, [familyId]);

  const fetchTrips = async () => {
    setLoading(true);
    try {
      const data = await tripsAPI.list(familyId);
      setTrips(data.trips || []);
    } catch {} finally { setLoading(false); }
  };

  const formatDateRange = (start, end) => {
    if (!start && !end) return null;
    const opts = { month: 'short', day: 'numeric', year: 'numeric' };
    if (start && end) {
      return `${new Date(start).toLocaleDateString('en-US', opts)} — ${new Date(end).toLocaleDateString('en-US', opts)}`;
    }
    if (start) return new Date(start).toLocaleDateString('en-US', opts);
    return new Date(end).toLocaleDateString('en-US', opts);
  };

  return (
    <div className="min-h-screen bg-[var(--page)] flex flex-col md:flex-row">
      <Sidebar family={family} familyId={familyId} activePage="trips" />

      <div className="flex-1 min-w-0" style={{ paddingBottom: 80 }}>
        {/* Header */}
        <div className="sticky top-0 z-40 bg-[var(--vellum)] border-b border-[var(--border)] h-[56px]">
          <div className="max-w-4xl mx-auto px-4 h-full flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Route size={22} className="text-[var(--seal)]" />
              <h1 className="font-display text-[20px] text-[var(--ink)]">Trips</h1>
            </div>
            <button
              onClick={() => navigate('/trips/new')}
              className="px-4 py-1.5 rounded-full bg-[var(--seal)] text-[var(--page)] text-[12px] font-medium hover:bg-[var(--seal-hover)] transition-colors flex items-center gap-1"
            >
              <Plus size={14} />
              New Trip
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-[var(--vellum)] border border-[var(--border)] rounded-[10px] p-5 animate-pulse">
                  <div className="skeleton h-6 w-3/4 mb-3" />
                  <div className="skeleton h-4 w-1/2 mb-2" />
                  <div className="skeleton h-4 w-1/3" />
                </div>
              ))}
            </div>
          ) : trips.length === 0 ? (
            <div className="text-center py-20 animate-fade-in">
              <div className="w-16 h-16 mx-auto mb-5 rounded-full border-[1.5px] border-dashed border-[var(--border)] flex items-center justify-center">
                <Route size={28} className="text-[var(--ink-muted)] opacity-40" />
              </div>
              <div className="thread-divider max-w-[100px] mx-auto mb-6" />
              <h2 className="font-display text-xl mb-2">No trips yet</h2>
              <p className="text-[var(--ink-light)] text-sm max-w-sm mx-auto mb-6 leading-relaxed">
                Start tracking your family's journeys — weekend getaways, reunions, or the big vacation.
              </p>
              <button
                onClick={() => navigate('/trips/new')}
                className="px-6 py-3 rounded-full bg-[var(--seal)] text-[var(--page)] text-[14px] font-medium hover:bg-[var(--seal-hover)] transition-all active:scale-[0.98] shadow-[0_2px_8px_rgba(168,85,66,0.2)]"
              >
                <Plus size={18} className="inline mr-2" />Plan Your First Trip
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {trips.map((trip, i) => (
                <motion.div
                  key={trip.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => navigate(`/trips/${trip.id}`)}
                  className="bg-[var(--vellum)] border border-[var(--border)] rounded-[10px] p-5 cursor-pointer hover:shadow-[var(--shadow-md)] transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-[17px] text-[var(--ink)] mb-1">{trip.name}</h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        {trip.location && (
                          <span className="flex items-center gap-1.5 text-[13px] text-[var(--ink-light)]">
                            <MapPin size={13} className="text-[var(--ink-muted)]" />
                            {trip.location}
                          </span>
                        )}
                        {trip.start_date && (
                          <span className="flex items-center gap-1.5 text-[13px] text-[var(--ink-light)]">
                            <Calendar size={13} className="text-[var(--ink-muted)]" />
                            {formatDateRange(trip.start_date, trip.end_date)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="flex items-center gap-1 text-[12px] text-[var(--ink-muted)] font-mono">
                        <Users size={13} />
                        <span>{trip.person_count || 0}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[12px] text-[var(--ink-muted)] font-mono">
                        <Image size={13} />
                        <span>{trip.memory_count || 0}</span>
                      </div>
                      {trip.start_date && (
                        <div className="hidden sm:block font-mono text-[11px] text-[var(--postmark)] border border-[var(--postmark)] rounded-[2px] px-2 py-[2px] bg-[rgba(74,107,138,0.04)]">
                          {new Date(trip.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                  </div>
                  {trip.notes && (
                    <p className="mt-3 text-[13px] text-[var(--ink-light)] line-clamp-2 leading-relaxed">{trip.notes}</p>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <BottomTabBar activeTab="trips" familyId={familyId} />
      </div>
    </div>
  );
}
