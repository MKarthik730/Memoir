import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, AtSign, Cake, Bell, ArrowLeft } from 'lucide-react';
import Avatar from '../components/ui/Avatar';
import Sidebar from '../components/Sidebar';
import BottomTabBar from '../components/BottomTabBar';
import { familyAPI, notificationsAPI } from '../lib/api';

const typeConfig = {
  like: { icon: Heart, color: 'text-[var(--seal)]', bg: 'bg-[var(--seal-light)]' },
  comment: { icon: MessageCircle, color: 'text-[var(--postmark)]', bg: 'bg-[var(--postmark-light)]' },
  tag: { icon: AtSign, color: 'text-[var(--gilt)]', bg: 'bg-[var(--gilt-pale)]' },
  birthday: { icon: Cake, color: 'text-[var(--gilt)]', bg: 'bg-[var(--gilt-pale)]' },
  story: { icon: Heart, color: 'text-[var(--postmark)]', bg: 'bg-[var(--postmark-light)]' },
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [familyId, setFamilyId] = useState(null);
  const [family, setFamily] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    familyAPI.getMyFamilies().then(families => {
      if (Array.isArray(families) && families.length > 0) {
        const fid = families[0].id;
        setFamilyId(fid);
        familyAPI.get(fid).then(setFamily).catch(() => {});
      }
    }).catch(() => {});
    fetchNotifs();
  }, []);

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      const data = await notificationsAPI.list();
      setNotifications(data || []);
    } catch {} finally { setLoading(false); }
  };

  const markAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {}
  };

  const getMessage = (n) => {
    const name = n.from_user?.name || 'Someone';
    switch (n.type) {
      case 'like': return `${name} liked your post`;
      case 'comment': return `${name} commented on your post`;
      case 'tag': return `${name} tagged you in a post`;
      case 'birthday': return `Send birthday wishes!`;
      case 'story': return `${name} posted a story`;
      default: return `${name} interacted with your post`;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--page)] flex flex-col md:flex-row">
      <Sidebar family={family} familyId={familyId} activePage="notifications" />

      <div className="flex-1 min-w-0" style={{ paddingBottom: 80 }}>
      <div className="sticky top-0 z-40 bg-[var(--page)]/95 backdrop-blur-sm border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="btn-icon"><ArrowLeft size={18} /></button>
            <h1 className="font-display text-lg">Notifications</h1>
          </div>
          <button onClick={markAllRead} className="text-[12px] text-[var(--postmark)] hover:underline font-mono">Mark all read</button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-4 p-4 bg-[var(--vellum)] border border-[var(--border)] rounded-[var(--radius-sm)] animate-pulse">
                <div className="w-10 h-10 rounded-full bg-[var(--border)]" />
                <div className="flex-1 space-y-2"><div className="h-3 w-3/4 bg-[var(--border)] rounded" /><div className="h-2 w-1/4 bg-[var(--border-light)] rounded" /></div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20 animate-fade-in">
            <Bell size={40} className="mx-auto mb-4 text-[var(--ink-muted)] opacity-30" />
            <div className="thread-divider max-w-[80px] mx-auto mb-6" />
            <h2 className="font-display text-xl mb-2">All quiet</h2>
            <p className="text-[var(--ink-light)] text-sm max-w-xs mx-auto">No notifications yet. When someone likes or comments on your posts, you'll see it here.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.map((n, i) => {
              const config = typeConfig[n.type] || typeConfig.like;
              const Icon = config.icon;
              return (
                <motion.div key={n.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className={`flex items-start gap-4 px-4 py-4 rounded-[var(--radius-sm)] cursor-pointer transition-colors ${
                    n.read ? 'bg-[var(--page)] hover:bg-[var(--vellum)]' : 'bg-[var(--vellum)] border-l-[3px] border-[var(--seal)]'
                  }`}
                  onClick={() => {
                    if (n.post_id) navigate('/');
                    if (!n.read) { notificationsAPI.markAllRead().catch(() => {}); setNotifications(prev => prev.map(x => ({ ...x, read: true }))); }
                  }}>
                  <div className={`w-10 h-10 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={18} className={config.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      {n.from_user && <Avatar name={n.from_user.name} url={n.from_user.avatar_url} size={24} />}
                      <p className="text-[13px] text-[var(--ink)]">
                        <span className="font-medium">{n.from_user?.name}</span>{' '}
                        <span className="text-[var(--ink-light)]">{getMessage(n)}</span>
                      </p>
                    </div>
                    <p className="text-[10px] font-mono text-[var(--ink-muted)] mt-1">
                      {n.created_at ? new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <BottomTabBar activeTab="notifications" familyId={familyId} />
      </div>
    </div>
  );
}
