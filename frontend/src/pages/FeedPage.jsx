import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, MapPin, ChevronLeft, ChevronRight, Feather, Cake, Sparkles, Heart, CloudFog, Users } from 'lucide-react';
import Avatar from '../components/ui/Avatar';
import Sidebar from '../components/Sidebar';
import BottomTabBar from '../components/BottomTabBar';
import { familyAPI, feedAPI, notificationsAPI, birthdaysAPI, lifeAPI } from '../lib/api';

// ─── On This Day ──────────────────────────────────────────────────────────────
function OnThisDayBanner({ items }) {
  const navigate = useNavigate();
  if (!items?.length) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <Sparkles size={14} className="text-[var(--postmark)]" />
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--postmark)]">On this day</span>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
        {items.map((item) => (
          <button key={`${item.type}-${item.id}`}
            onClick={() => navigate(item.type === 'memory' ? `/people/${item.person_id}` : '/')}
            className="flex-shrink-0 text-left px-4 py-3 rounded-[10px] border border-[var(--postmark)]/25 hover:border-[var(--postmark)] transition-colors"
            style={{ background: 'var(--postmark-light)', minWidth: 220, maxWidth: 240 }}>
            <p className="font-mono text-[10px] text-[var(--postmark)] mb-1">{item.years_ago} year{item.years_ago > 1 ? 's' : ''} ago</p>
            <p className="text-[13px] text-[var(--ink)] font-medium truncate">{item.title}</p>
            <p className="text-[11px] text-[var(--ink-muted)] truncate">{item.person_name}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Worth Revisiting (SM-2 resurfacing) ──────────────────────────────────────
function ResurfaceSection({ memories, onReview }) {
  if (!memories?.length) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <Heart size={13} className="text-[var(--seal)]" />
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--seal)]">Worth revisiting</span>
      </div>
      <div className="space-y-2">
        {memories.map((m) => (
          <div key={m.id} className="px-4 py-3 rounded-[10px] border border-[var(--border)] bg-[var(--vellum)]">
            <p className="text-[13px] font-medium text-[var(--ink)] truncate">{m.title}</p>
            <p className="text-[12px] text-[var(--ink-light)] line-clamp-2 mt-0.5">{m.story_text}</p>
            <p className="text-[10px] font-mono text-[var(--ink-muted)] mt-1">{m.person_name}</p>
            <div className="flex gap-2 mt-2">
              <button onClick={() => onReview(m.id, 5)}
                className="flex-1 py-1.5 rounded-full bg-[var(--seal)] text-[var(--page)] text-[11px] font-medium hover:bg-[var(--seal-hover)] transition-colors flex items-center justify-center gap-1">
                <Heart size={12} />Still meaningful
              </button>
              <button onClick={() => onReview(m.id, 1)}
                className="flex-1 py-1.5 rounded-full border border-[var(--border)] text-[var(--ink-light)] text-[11px] font-medium hover:border-[var(--ink-muted)] transition-colors flex items-center justify-center gap-1">
                <CloudFog size={12} />Let it fade
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Neglected connections nudge ───────────────────────────────────────────────
function NeglectedNudge({ people }) {
  const navigate = useNavigate();
  if (!people?.length) return null;
  const top = people[0];
  return (
    <button onClick={() => navigate(`/people/${top.person_id}`)}
      className="w-full flex items-center gap-2 px-4 py-2.5 rounded-[10px] border border-[var(--border)] bg-[var(--vellum)] text-left hover:border-[var(--seal)] transition-colors">
      <Users size={14} className="text-[var(--ink-muted)] flex-shrink-0" />
      <p className="text-[12px] text-[var(--ink-light)] truncate">
        No entries for <span className="text-[var(--ink)] font-medium">{top.person_name}</span> in a while — write one?
      </p>
    </button>
  );
}

// ─── Birthday Note ────────────────────────────────────────────────────────────
function BirthdayBanner({ birthdays }) {
  const navigate = useNavigate();
  if (!birthdays?.length) return null;
  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
      {birthdays.map((b) => (
        <div key={b.person_id}
          className="flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-[10px] border border-[var(--gilt)]/30"
          style={{ background: 'var(--gilt-pale)', minWidth: 220 }}>
          <Cake size={20} className="text-[var(--gilt)] flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-[var(--ink)] font-medium truncate">{b.person_name}</p>
            <p className="text-[11px] font-mono text-[var(--ink-light)]">
              {b.days_until === 0 ? 'Today!' : `${b.days_until} day${b.days_until > 1 ? 's' : ''} away`}
            </p>
          </div>
          <button onClick={() => navigate(`/post/new?person=${b.person_id}`)}
            className="flex-shrink-0 text-[11px] font-mono text-[var(--gilt)] hover:underline">
            Send wishes &rarr;
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Diary Entry Card ─────────────────────────────────────────────────────────
function DiaryEntryCard({ post, index }) {
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [lightboxImg, setLightboxImg] = useState(null);
  const photos = post.photos || [];
  const isTruncated = (post.caption?.length || 0) > 320;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      className="card-pinned bg-[var(--vellum)] border border-[var(--border)] rounded-[12px] overflow-hidden shadow-[var(--shadow-sm)] mb-4"
      style={{ borderLeft: '3px dashed var(--seal)' }}
    >
      <div className="p-5" style={{ paddingLeft: 22 }}>
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <Avatar name={post.user?.name} url={post.user?.avatar_url} size={36} />
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-medium text-[var(--ink)]">{post.user?.name}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[11px] text-[var(--postmark)] border border-[var(--postmark)] rounded-[2px] px-2 py-[1px] bg-[var(--postmark-light)]">
                {post.created_at ? new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
              </span>
              {post.location && (
                <span className="flex items-center gap-1 text-[11px] font-mono text-[var(--ink-muted)]"><MapPin size={10} />{post.location}</span>
              )}
            </div>
          </div>
        </div>

        {/* Entry text */}
        {post.caption && (
          <div className="mb-3">
            <p className={`text-[14px] text-[var(--ink-light)] leading-[1.75] whitespace-pre-line ${!expanded && isTruncated ? 'line-clamp-4' : ''}`}>
              {post.caption}
            </p>
            {isTruncated && (
              <button onClick={() => setExpanded(!expanded)} className="mt-1 text-[12px] text-[var(--seal)] hover:underline">
                {expanded ? 'Show less' : 'Continue reading'}
              </button>
            )}
          </div>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <div className="mt-2">
            <button onClick={() => setLightboxImg(photos[currentPhoto]?.photo_url)} className="block w-full">
              <img src={photos[currentPhoto]?.photo_url} alt="" className="w-full max-h-[420px] object-cover rounded-[8px] border border-[var(--border)]" />
            </button>
            {photos.length > 1 && (
              <div className="flex items-center gap-2 mt-2">
                <button onClick={() => setCurrentPhoto(i => (i - 1 + photos.length) % photos.length)}
                  className="w-7 h-7 rounded-full border border-[var(--border)] bg-[var(--page)] flex items-center justify-center text-[var(--ink-light)] hover:text-[var(--ink)] transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <div className="flex-1 flex gap-1.5 overflow-x-auto no-scrollbar">
                  {photos.map((p, i) => (
                    <button key={p.id} onClick={() => setCurrentPhoto(i)}
                      className={`flex-shrink-0 w-10 h-10 rounded-[4px] overflow-hidden border transition-colors ${i === currentPhoto ? 'border-[var(--seal)]' : 'border-[var(--border)] opacity-70'}`}>
                      <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
                <button onClick={() => setCurrentPhoto(i => (i + 1) % photos.length)}
                  className="w-7 h-7 rounded-full border border-[var(--border)] bg-[var(--page)] flex items-center justify-center text-[var(--ink-light)] hover:text-[var(--ink)] transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {lightboxImg && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(36,31,26,0.85)' }}
          onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="" className="max-w-full max-h-[90vh] rounded-[6px] object-contain" />
        </div>
      )}
    </motion.div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-[var(--vellum)] border border-[var(--border)] rounded-[12px] p-5 space-y-4 animate-pulse">
          <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-[var(--border)]" /><div className="space-y-2 flex-1"><div className="h-3 w-24 bg-[var(--border)] rounded" /><div className="h-2 w-16 bg-[var(--border-light)] rounded" /></div></div>
          <div className="h-4 w-full bg-[var(--border-light)] rounded" />
          <div className="h-4 w-5/6 bg-[var(--border-light)] rounded" />
          <div className="h-[220px] bg-[var(--border)] rounded-[8px]" />
        </div>
      ))}
    </div>
  );
}

// ─── Main Diary Page ──────────────────────────────────────────────────────────
export default function FeedPage() {
  const navigate = useNavigate();
  const [familyId, setFamilyId] = useState(null);
  const [family, setFamily] = useState(null);
  const [posts, setPosts] = useState([]);
  const [birthdays, setBirthdays] = useState([]);
  const [onThisDay, setOnThisDay] = useState([]);
  const [resurfacing, setResurfacing] = useState([]);
  const [neglected, setNeglected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const loaderRef = useRef(null);

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
    Promise.all([
      feedAPI.getFeed(familyId),
      birthdaysAPI.getUpcoming(familyId),
      notificationsAPI.unreadCount(),
      lifeAPI.onThisDay(familyId).catch(() => ({ results: [] })),
      lifeAPI.resurface().catch(() => ({ memories: [] })),
      lifeAPI.neglected(familyId).catch(() => ({ neglected: [] })),
    ]).then(([feedData, birthdaysData, notifData, onThisDayData, resurfaceData, neglectedData]) => {
      setPosts(feedData.posts || []);
      setNextCursor(feedData.next_cursor);
      setHasMore(feedData.has_more);
      setBirthdays(birthdaysData || []);
      setUnreadNotifs(notifData.count || 0);
      setOnThisDay(onThisDayData.results || []);
      setResurfacing((resurfaceData.memories || []).slice(0, 2));
      setNeglected(neglectedData.neglected || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [familyId]);

  const handleReview = async (memoryId, quality) => {
    setResurfacing(prev => prev.filter(m => m.id !== memoryId));
    try { await lifeAPI.reviewMemory(memoryId, quality); } catch {}
  };

  useEffect(() => {
    if (!hasMore || !nextCursor) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    }, { threshold: 0.5 });
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, nextCursor, loaderRef.current]);

  const loadMore = async () => {
    if (!familyId || !nextCursor) return;
    try {
      const data = await feedAPI.getFeed(familyId, nextCursor);
      setPosts(prev => [...prev, ...(data.posts || [])]);
      setNextCursor(data.next_cursor);
      setHasMore(data.has_more);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[var(--page)] flex flex-col md:flex-row">
      <Sidebar family={family} familyId={familyId} activePage="feed" />

      <div className="flex-1 min-w-0" style={{ paddingBottom: 80 }}>
        {/* Header */}
        <div className="sticky top-0 z-40 bg-[var(--vellum)] border-b border-[var(--border)] h-[56px]">
          <div className="max-w-[600px] mx-auto px-4 h-full flex items-center justify-between">
            <h1 className="font-display italic text-[22px] text-[var(--ink)]">Memoir</h1>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/notifications')} className="relative">
                <Bell size={20} className="text-[var(--ink-light)] hover:text-[var(--ink)] transition-colors" />
                {unreadNotifs > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--seal)] text-[var(--page)] text-[9px] font-bold flex items-center justify-center">
                    {unreadNotifs > 9 ? '9+' : unreadNotifs}
                  </span>
                )}
              </button>
              <button onClick={() => navigate('/post/new')} className="px-4 py-1.5 rounded-full bg-[var(--seal)] text-[var(--page)] text-[12px] font-medium hover:bg-[var(--seal-hover)] transition-colors flex items-center gap-1.5">
                <Feather size={14} />Write
              </button>
            </div>
          </div>
        </div>

        {/* Diary content */}
        <div className="max-w-[600px] mx-auto px-4 py-6 pb-24 space-y-4">
          {/* Daily digest: on-this-day, resurfacing, birthdays, neglected nudge */}
          {!loading && onThisDay.length > 0 && <OnThisDayBanner items={onThisDay} />}
          {!loading && resurfacing.length > 0 && <ResurfaceSection memories={resurfacing} onReview={handleReview} />}
          {birthdays.length > 0 && <BirthdayBanner birthdays={birthdays} />}
          {!loading && neglected.length > 0 && <NeglectedNudge people={neglected} />}

          {/* Entries or empty */}
          {loading ? <FeedSkeleton /> : (
            posts.length === 0 ? (
              <div className="text-center py-20 animate-fade-in">
                <div className="w-16 h-16 mx-auto mb-5 rounded-full border-[1.5px] border-dashed border-[var(--border)] flex items-center justify-center">
                  <Feather size={26} className="text-[var(--ink-muted)] opacity-40" />
                </div>
                <div className="thread-divider max-w-[100px] mx-auto mb-6" />
                <h2 className="font-display text-xl mb-2">No entries yet</h2>
                <p className="text-[var(--ink-light)] text-sm max-w-sm mx-auto mb-6">Write your first family memory — a story, a photo, a moment worth keeping.</p>
                <button onClick={() => navigate('/post/new')} className="px-6 py-3 rounded-full bg-[var(--seal)] text-[var(--page)] text-[14px] font-medium hover:bg-[var(--seal-hover)] transition-all active:scale-[0.98] shadow-[0_2px_8px_rgba(63,93,70,0.25)]">
                  <Feather size={18} className="inline mr-2" />Write Your First Entry
                </button>
              </div>
            ) : (
              <>
                {posts.map((post, i) => <DiaryEntryCard key={post.id} post={post} index={i} />)}
                {hasMore && <div ref={loaderRef} className="flex justify-center py-4"><div className="thread-line w-32" /></div>}
              </>
            )
          )}
        </div>
      </div>

      <BottomTabBar activeTab="feed" unreadCount={unreadNotifs} familyId={familyId} />
    </div>
  );
}
