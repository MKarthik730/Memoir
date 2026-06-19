import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Image, Heart, MessageCircle, Plus, Settings, LogOut } from 'lucide-react';
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
      <div className="sticky top-0 z-40 bg-[var(--page)]/95 backdrop-blur-sm border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="btn-icon"><ArrowLeft size={18} /></button>
            <h1 className="font-display text-lg">{user?.name || 'Profile'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/settings" className="btn-icon"><Settings size={18} /></Link>
            <button onClick={handleLogout} className="btn-icon"><LogOut size={18} /></button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto pb-24">
        <div className="h-[200px] relative" style={{ background: 'linear-gradient(135deg, var(--seal) 0%, var(--postmark) 100%)' }}>
          <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end gap-5">
            <Avatar name={user?.name} size={80} className="border-[4px] border-[var(--vellum)]" />
            <div className="mb-1">
              <h1 className="font-display text-2xl text-[var(--page)]">{user?.name}</h1>
              {family && <p className="text-[var(--page)]/80 text-[13px] font-mono tracking-[0.02em]">{family.name}</p>}
            </div>
          </div>
        </div>

        <div className="flex border-b border-[var(--border)] bg-[var(--vellum)]">
          {[
            { label: 'Posts', value: posts.length },
            { label: 'Family', value: memberCount },
            { label: 'Connections', value: '—' },
          ].map((stat) => (
            <div key={stat.label} className="flex-1 py-4 text-center">
              <p className="font-mono text-lg text-[var(--ink)] font-medium">{stat.value}</p>
              <p className="text-[10px] font-mono text-[var(--ink-muted)] uppercase tracking-[0.05em]">{stat.label}</p>
            </div>
          ))}
        </div>

        {user?.email && (
          <div className="px-6 py-5 border-b border-[var(--border)]">
            <p className="text-[14px] text-[var(--ink-light)] font-body">{user.email}</p>
          </div>
        )}

        <div className="px-6 py-5 border-b border-[var(--border)] flex gap-3">
          <button onClick={() => navigate('/post/new')} className="btn-seal btn-sm">Share a Memory</button>
          <button onClick={() => navigate('/')} className="btn btn-secondary btn-sm">View Feed</button>
        </div>

        <div className="px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-base">Your Posts</h2>
            <span className="text-[11px] font-mono text-[var(--ink-muted)]">{posts.length} total</span>
          </div>

          {posts.length === 0 ? (
            <div className="text-center py-16 animate-fade-in">
              <Image size={36} className="mx-auto mb-4 text-[var(--ink-muted)] opacity-30" />
              <div className="thread-divider max-w-[80px] mx-auto mb-6" />
              <h3 className="font-display text-lg mb-2">No posts yet</h3>
              <p className="text-[var(--ink-light)] text-sm max-w-xs mx-auto mb-6">Share your first family memory with the people you love.</p>
              <button onClick={() => navigate('/post/new')} className="btn-seal"><Plus size={18} /> Create Your First Post</button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {posts.map((post, i) => (
                <motion.div key={post.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                  className="relative aspect-square bg-[var(--vellum)] overflow-hidden group cursor-pointer" onClick={() => navigate('/')}>
                  {post.photos?.[0] && <img src={post.photos[0].photo_url} alt="" className="w-full h-full object-cover" />}
                  <div className="absolute inset-0 bg-[var(--ink)]/0 group-hover:bg-[var(--ink)]/30 transition-colors flex items-center justify-center gap-6 opacity-0 group-hover:opacity-100 text-[var(--page)]">
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
