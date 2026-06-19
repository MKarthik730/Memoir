import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, Heart, Archive, User, Plus, Grid3X3, Search, Share2, MessageCircle, Settings, X, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BottomTabBar({ activeTab, unreadCount = 0, familyId }) {
  const [showMore, setShowMore] = useState(false);
  const navigate = useNavigate();

  const tabs = [
    { id: 'feed', label: 'Feed', icon: Home, path: '/' },
    { id: 'vault', label: 'Vault', icon: Archive, path: '/vault' },
    { id: 'post', label: '', icon: null, path: '/post/new', isPost: true },
    { id: 'notifications', label: 'Alerts', icon: Heart, path: '/notifications' },
    { id: 'more', label: 'More', icon: Grid3X3, isMore: true },
  ];

  const moreItems = [
    { id: 'journal', label: 'Journal', icon: BookOpen, path: familyId ? `/family/${familyId}` : '/' },
    { id: 'tree', label: 'Tree', icon: Share2, path: familyId ? `/family/${familyId}/graph` : '/' },
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
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--vellum)] border-t border-[var(--border)] safe-area-bottom">
        <div className="flex items-center justify-around py-1">
          {tabs.map((tab) => {
            if (tab.isPost) {
              return (
                <Link
                  key={tab.id}
                  to={tab.path}
                  className="w-12 h-12 -mt-3 rounded-full bg-[var(--seal)] text-[var(--page)] hover:bg-[var(--seal-hover)] flex items-center justify-center transition-all active:scale-95 shadow-[var(--shadow-md)]"
                >
                  <Plus size={22} />
                </Link>
              );
            }
            if (tab.isMore) {
              return (
                <button
                  key={tab.id}
                  onClick={() => setShowMore(true)}
                  className={`flex flex-col items-center gap-[2px] px-4 py-1.5 transition-colors no-underline relative ${
                    showMore ? 'text-[var(--seal)]' : 'text-[var(--ink-muted)]'
                  }`}
                >
                  <Grid3X3 size={20} />
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
                className={`flex flex-col items-center gap-[2px] px-4 py-1.5 transition-colors no-underline relative ${
                  isActive ? 'text-[var(--seal)]' : 'text-[var(--ink-muted)]'
                }`}
              >
                <Icon size={20} />
                <span className="text-[9px] font-mono tracking-[0.03em]">{tab.label}</span>
                {tab.id === 'notifications' && unreadCount > 0 && (
                  <span className="absolute top-0 right-2 w-4 h-4 rounded-full bg-[var(--seal)] text-[var(--page)] text-[8px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
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
              className="fixed inset-0 z-[60] bg-black/30"
              onClick={() => setShowMore(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
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
                      <Icon size={20} className="opacity-70" />
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
