import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Archive, Grid3X3, Search, GitBranch, MessageCircle, Settings, X, PenLine, Users, Map, CalendarDays } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BottomTabBar({ activeTab, familyId }) {
  const [showMore, setShowMore] = useState(false);
  const navigate = useNavigate();

  const tabs = [
    { id: 'diary', label: 'My Diary', icon: PenLine, path: '/my-diary' },
    { id: 'vault', label: 'Vault', icon: Archive, path: '/vault' },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays, path: '/calendar' },
    { id: 'more', label: 'More', icon: Grid3X3, isMore: true },
  ];

  const moreItems = [
    { id: 'journal', label: 'People', icon: Users, path: familyId ? `/family/${familyId}` : '/family' },
    { id: 'trips', label: 'Trips', icon: Map, path: '/trips' },
    { id: 'tree', label: 'Tree', icon: GitBranch, path: familyId ? `/family/${familyId}/graph` : '/' },
    { id: 'search', label: 'Search', icon: Search, path: familyId ? `/family/${familyId}/search` : '/' },
    { id: 'assistant', label: 'Assistant', icon: MessageCircle, path: familyId ? `/family/${familyId}/assistant` : '/' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  ];

  const handleMoreClick = (item) => {
    setShowMore(false);
    navigate(item.path);
  };

  return (
    <>
      <div className="bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--vellum)] border-t border-[var(--border)] safe-area-bottom">
        <div className="flex items-center justify-around py-1">
          {tabs.map((tab) => {
            if (tab.isMore) {
              return (
                <button
                  key={tab.id}
                  onClick={() => setShowMore(true)}
                  className={`flex flex-col items-center gap-[2px] px-4 py-1.5 transition-colors no-underline relative ${
                    showMore ? 'text-[var(--seal)]' : 'text-[var(--ink-muted)]'
                  }`}
                >
                  <Grid3X3 />
                  <span className="text-[9px] font-mono tracking-[0.03em]">More</span>
                  {showMore && <div className="w-5 h-[3px] bg-[var(--seal)] rounded-full" />}
                </button>
              );
            }
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <Link
                key={tab.id}
                to={tab.path}
                className={`bottom-nav-link flex flex-col items-center gap-[2px] px-4 py-1.5 transition-colors no-underline relative ${
                  isActive ? 'is-active text-[var(--seal)]' : 'text-[var(--ink-muted)]'
                }`}
              >
                <Icon />
                <span className="text-[9px] font-mono tracking-[0.03em]">{tab.label}</span>
                {isActive && (
                  <div className="w-5 h-[3px] bg-[var(--seal)] rounded-full" />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* More Bottom Sheet */}
      <AnimatePresence>
        {showMore && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              className="fixed inset-0 z-[60] bg-black/30"
              onClick={() => setShowMore(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="fixed bottom-0 left-0 right-0 z-[70] bg-[var(--vellum)] rounded-t-[var(--radius-lg)] border border-[var(--border)] shadow-[var(--shadow-lg)]"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                <h3 className="font-display text-base text-[var(--ink)]">More</h3>
                <button onClick={() => setShowMore(false)} className="btn-icon">
                  <X size={18} />
                </button>
              </div>
              <div className="px-4 py-3 space-y-1">
                {moreItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleMoreClick(item)}
                      className={`flex items-center gap-4 w-full px-4 py-3.5 rounded-[var(--radius-sm)] text-sm transition-all ${
                        isActive
                          ? 'bg-[var(--seal-light)] text-[var(--seal)] font-medium'
                          : 'text-[var(--ink-light)] hover:bg-[var(--seal-lighter)] hover:text-[var(--ink)]'
                      }`}
                    >
                      <Icon className="opacity-70" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
