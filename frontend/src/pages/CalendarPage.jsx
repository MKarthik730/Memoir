import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, CalendarDays, Feather, Cake, BookOpen, Route, X } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import BottomTabBar from '../components/BottomTabBar';
import { familyAPI, calendarAPI } from '../lib/api';

const TYPE_META = {
  entry: { icon: Feather, color: 'var(--seal)' },
  memory: { icon: BookOpen, color: 'var(--postmark)' },
  birthday: { icon: Cake, color: 'var(--gilt)' },
  trip: { icon: Route, color: 'var(--seal)' },
};

export default function CalendarPage() {
  const navigate = useNavigate();
  const [familyId, setFamilyId] = useState(null);
  const [family, setFamily] = useState(null);
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [days, setDays] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);

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
    setLoading(true);
    calendarAPI.getMonth(familyId, cursor.getFullYear(), cursor.getMonth() + 1)
      .then(data => setDays(data.days || {}))
      .catch(() => setDays({}))
      .finally(() => setLoading(false));
  }, [familyId, cursor]);

  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = new Date().toISOString().slice(0, 10);

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const dayKey = (d) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const goPrev = () => setCursor(new Date(year, month - 1, 1));
  const goNext = () => setCursor(new Date(year, month + 1, 1));
  const goToday = () => setCursor(new Date(new Date().setDate(1)));

  const openItem = (item) => {
    setSelectedDay(null);
    if (item.type === 'memory' || item.type === 'birthday') navigate(`/people/${item.person_id}`);
    else if (item.type === 'entry') navigate('/');
    else if (item.type === 'trip') navigate(`/trips/${item.id}`);
  };

  return (
    <div className="min-h-screen bg-[var(--page)] flex flex-col md:flex-row">
      <Sidebar family={family} familyId={familyId} activePage="calendar" />

      <div className="flex-1 min-w-0" style={{ paddingBottom: 80 }}>
        <div className="sticky top-0 z-40 bg-[var(--vellum)] border-b border-[var(--border)] h-[56px]">
          <div className="max-w-4xl mx-auto px-4 h-full flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CalendarDays size={20} className="text-[var(--seal)]" />
              <h1 className="font-display text-[20px] text-[var(--ink)]">Calendar</h1>
            </div>
            <button onClick={goToday} className="px-3 py-1.5 rounded-full border border-[var(--border)] text-[12px] font-mono text-[var(--ink-light)] hover:border-[var(--seal)] hover:text-[var(--seal)] transition-colors">
              Today
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
          <div className="flex items-center justify-between mb-5">
            <button onClick={goPrev} className="w-9 h-9 flex items-center justify-center rounded-[6px] border border-[var(--border)] bg-[var(--vellum)] text-[var(--ink-light)] hover:text-[var(--ink)] transition-colors">
              <ChevronLeft size={18} />
            </button>
            <h2 className="font-display text-lg text-[var(--ink)]">{monthLabel}</h2>
            <button onClick={goNext} className="w-9 h-9 flex items-center justify-center rounded-[6px] border border-[var(--border)] bg-[var(--vellum)] text-[var(--ink-light)] hover:text-[var(--ink)] transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="text-center font-mono text-[10px] text-[var(--ink-muted)] uppercase tracking-[0.05em] py-1">{d}</div>
            ))}
          </div>

          <div className={`grid grid-cols-7 gap-1.5 ${loading ? 'opacity-40' : ''} transition-opacity`}>
            {cells.map((d, i) => {
              if (d === null) return <div key={i} />;
              const key = dayKey(d);
              const items = days[key] || [];
              const isToday = key === todayKey;
              return (
                <button
                  key={i}
                  onClick={() => items.length > 0 && setSelectedDay({ key, items, day: d })}
                  className={`aspect-square rounded-[8px] border p-1.5 flex flex-col items-start transition-colors ${
                    isToday ? 'border-[var(--seal)] bg-[var(--seal-lighter)]' : 'border-[var(--border)] bg-[var(--vellum)]'
                  } ${items.length > 0 ? 'hover:border-[var(--seal)] cursor-pointer' : 'cursor-default'}`}
                >
                  <span className={`font-mono text-[11px] ${isToday ? 'text-[var(--seal)] font-medium' : 'text-[var(--ink-light)]'}`}>{d}</span>
                  <div className="flex flex-wrap gap-[3px] mt-auto">
                    {items.slice(0, 4).map((item, idx) => {
                      const meta = TYPE_META[item.type] || TYPE_META.entry;
                      return <span key={idx} className="w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ background: meta.color }} />;
                    })}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4 mt-6 flex-wrap">
            {Object.entries(TYPE_META).map(([type, meta]) => (
              <div key={type} className="flex items-center gap-1.5">
                <span className="w-[8px] h-[8px] rounded-full" style={{ background: meta.color }} />
                <span className="font-mono text-[11px] text-[var(--ink-muted)] capitalize">{type === 'entry' ? 'diary entry' : type}</span>
              </div>
            ))}
          </div>
        </div>

        <BottomTabBar activeTab="calendar" familyId={familyId} />
      </div>

      <AnimatePresence>
        {selectedDay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(36,31,26,0.25)', backdropFilter: 'blur(4px)' }}
            onClick={() => setSelectedDay(null)}>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              className="w-full max-w-[380px] bg-[var(--vellum)] rounded-[14px] shadow-[var(--shadow-lg)] border border-[var(--border)]"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                <h3 className="font-display text-base text-[var(--ink)]">
                  {new Date(selectedDay.key).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>
                <button onClick={() => setSelectedDay(null)} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[var(--ink-muted)] hover:bg-[var(--page)] transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="p-3 space-y-1 max-h-[320px] overflow-y-auto">
                {selectedDay.items.map((item, i) => {
                  const meta = TYPE_META[item.type] || TYPE_META.entry;
                  const Icon = meta.icon;
                  return (
                    <button key={i} onClick={() => openItem(item)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] hover:bg-[var(--page)] transition-colors text-left">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--page)' }}>
                        <Icon size={15} style={{ color: meta.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-[var(--ink)] truncate">{item.title}</p>
                        {item.by && <p className="text-[11px] font-mono text-[var(--ink-muted)]">by {item.by}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
