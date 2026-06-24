import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Image, Heart, MessageCircle, Plus, Settings, LogOut, Mail } from 'lucide-react';
import Avatar from '../components/ui/Avatar';
import Sidebar from '../components/Sidebar';
import BottomTabBar from '../components/BottomTabBar';
import { familyAPI, feedAPI } from '../lib/api';

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [family, setFamily] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('memoir_user');
    if (stored) setUser(JSON.parse(stored));
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const families = await familyAPI.getMyFamilies();
      if (Array.isArray(families) && families.length > 0) {
        const fid = families[0].id;
        setFamily(families[0]);
        const feedData = await feedAPI.getFeed(fid, null, 6);
        const uid = localStorage.getItem('memoir_user_id');
        setPosts(feedData.posts?.filter(p => String(p.user_id) === String(uid)) || []);
      }
    } catch {} finally { setLoading(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem('memoir_token');
    localStorage.removeItem('memoir_user');
    localStorage.removeItem('memoir_user_id');
    navigate('/login');
  };

  const memberCount = family?.members?.length || 0;

  return (
    <div className="min-h-screen bg-[var(--page)] flex flex-col md:flex-row">
      <Sidebar family={family} familyId={family?.id} activePage="profile" />

      <div className="flex-1 min-w-0" style={{ paddingBottom: 80 }}>
        {/* Header */}
        <div className="sticky top-0 z-40 bg-[var(--vellum)] border-b border-[var(--border)] h-[56px]">
          <div className="max-w-2xl mx-auto px-4 h-full flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center rounded-[6px] text-[var(--ink-light)] hover:bg-[rgba(168,85,66,0.05)] transition-colors">
                <ArrowLeft size={18} />
              </button>
              <h1 className="text-[17px] font-medium text-[var(--ink)]">{user?.name || 'Profile'}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/settings" className="w-9 h-9 flex items-center justify-center rounded-[6px] text-[var(--ink-light)] hover:bg-[rgba(168,85,66,0.05)] transition-colors"><Settings size={18} /></Link>
              <button onClick={handleLogout} className="w-9 h-9 flex items-center justify-center rounded-[6px] text-[var(--ink-light)] hover:bg-[rgba(168,85,66,0.05)] transition-colors"><LogOut size={18} /></button>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto pb-24">
          {/* Hero */}
          <div className="h-[200px] relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, var(--seal) 0%, var(--postmark) 100%)' }}>
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, rgba(28,26,23,0.55) 100%)' }} />
            <div className="absolute bottom-0 left-0 right-0 px-6 pb-4 flex items-end gap-[14px]">
              <Avatar name={user?.name} size={72} className="border-[3px] border-[var(--vellum)] shadow-[0_4px_14px_rgba(28,26,23,0.25)]" style={{ marginBottom: -28 }} />
              <div className="mb-1">
                <h1 className="font-display text-[22px] italic text-[var(--page)]" style={{ textShadow: '0 1px 4px rgba(28,26,23,0.4)' }}>{user?.name}</h1>
                {family && <p className="font-mono text-[11px] text-[var(--page)]/70 tracking-[0.04em]">{family.name}</p>}
              </div>
            </div>
          </div>

          {/* Profile body */}
          <div className="px-6 pt-9">
            {/* Stats row */}
            <div className="bg-[var(--vellum)] border border-[var(--border)] rounded-[10px] overflow-hidden mb-5">
              <div className="flex">
                {[
                  { label: 'Posts', value: posts.length, color: 'var(--seal)' },
                  { label: 'Family', value: memberCount, color: 'var(--postmark)' },
                  { label: 'Connections', value: '—', color: 'var(--gilt)' },
                ].map((stat, i) => (
                  <div key={stat.label} className={`flex-1 py-[14px] text-center ${i < 2 ? 'border-r border-[var(--border)]' : ''}`}>
                    <p className="font-display text-[24px]" style={{ color: stat.color }}>{stat.value}</p>
                    <p className="text-[9px] font-mono text-[var(--ink-muted)] uppercase tracking-[0.08em]">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Email row */}
            {user?.email && (
              <div className="bg-[var(--vellum)] border border-[var(--border)] rounded-[8px] px-[14px] py-[10px] flex items-center gap-3 mb-5">
                <Mail size={14} className="text-[var(--ink-muted)]" />
                <span className="text-[12px] font-mono text-[var(--ink-light)]">{user.email}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 mb-6">
              <button onClick={() => navigate('/post/new')} className="flex-1 h-9 rounded-full bg-[var(--seal)] text-[var(--page)] text-[13px] font-medium hover:bg-[var(--seal-hover)] transition-colors">Share a Memory</button>
              <button onClick={() => navigate('/')} className="flex-1 h-9 rounded-full bg-transparent text-[var(--seal)] border-[1.5px] border-[var(--seal)] text-[13px] font-medium hover:bg-[rgba(168,85,66,0.08)] transition-colors">View Feed</button>
            </div>

            {/* Thread divider with label */}
            <div className="flex items-center gap-4 mb-5">
              <div className="flex-1 h-px" style={{ background: 'repeating-linear-gradient(to right, var(--border) 0px, var(--border) 6px, transparent 6px, transparent 10px)' }} />
              <span className="font-mono text-[10px] text-[var(--ink-muted)] uppercase tracking-[0.08em]">YOUR POSTS</span>
              <div className="flex-1 h-px" style={{ background: 'repeating-linear-gradient(to right, var(--border) 0px, var(--border) 6px, transparent 6px, transparent 10px)' }} />
            </div>

            {/* Posts grid */}
            {posts.length === 0 ? (
              <div className="text-center py-10 border-[1.5px] border-dashed border-[var(--border)] rounded-[12px] animate-fade-in" style={{ padding: '40px 24px' }}>
                <Image size={36} className="mx-auto mb-4 text-[var(--ink-muted)] opacity-40" />
                <div className="thread-divider max-w-[80px] mx-auto mb-6" />
                <h3 className="font-display text-[16px] italic text-[var(--ink)] mb-2">No posts yet</h3>
                <p className="text-[13px] text-[var(--ink-light)] max-w-[260px] mx-auto mb-4 leading-relaxed">Share your first family memory with the people you love.</p>
                <button onClick={() => navigate('/post/new')} className="px-6 py-3 rounded-full bg-[var(--seal)] text-[var(--page)] text-[14px] font-medium hover:bg-[var(--seal-hover)] shadow-[0_2px_8px_rgba(168,85,66,0.2)] inline-flex items-center gap-2">
                  <Plus size={18} />Create Your First Post
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {posts.map((post, i) => (
                  <motion.div key={post.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                    className="relative aspect-square bg-[var(--vellum)] overflow-hidden group cursor-pointer rounded-[8px] border border-[var(--border)]"
                    onClick={() => navigate('/')}>
                    {post.photos?.[0] && <img src={post.photos[0].photo_url} alt="" className="w-full h-full object-cover" />}
                    <div className="absolute inset-0 bg-[rgba(28,26,23,0.5)] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6 text-[var(--page)]">
                      <div className="flex items-center gap-1.5"><Heart size={16} fill="var(--page)" /><span className="text-sm font-medium">{post.likes_count}</span></div>
                      <div className="flex items-center gap-1.5"><MessageCircle size={16} fill="var(--page)" /><span className="text-sm font-medium">{post.comments_count}</span></div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        <BottomTabBar activeTab="profile" familyId={family?.id} />
      </div>
    </div>
  );
}
