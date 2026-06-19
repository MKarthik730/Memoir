import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, MessageCircle, Send, MapPin,
  ChevronLeft, ChevronRight, Camera, Cake,
} from 'lucide-react';
import Avatar from '../components/ui/Avatar';
import Sidebar from '../components/Sidebar';
import BottomTabBar from '../components/BottomTabBar';
import { familyAPI, feedAPI, storiesAPI, notificationsAPI, birthdaysAPI } from '../lib/api';

// ─── Story Bubble ─────────────────────────────────────────────────────────────
function StoryBubble({ user, onOpen }) {
  const firstStory = user.stories?.[0];
  const hasUnseen = firstStory && !firstStory.has_viewed;
  return (
    <button onClick={() => onOpen(user)} className="flex flex-col items-center gap-1 flex-shrink-0 w-[72px]">
      <div className={`rounded-full p-[3px] ${hasUnseen ? 'bg-[var(--seal)]' : 'bg-[var(--border)]'}`}>
        <div className="rounded-full bg-[var(--page)] p-[2px]">
          <Avatar name={user.user_name} url={user.avatar_url} size={56} />
        </div>
      </div>
      <span className="text-[10px] font-mono text-[var(--ink-light)] truncate w-full text-center">
        {user.user_name?.split(' ')[0]}
      </span>
    </button>
  );
}

// ─── Story Viewer ─────────────────────────────────────────────────────────────
function StoryViewer({ users, initialIndex, onClose }) {
  const [currentUserIdx, setCurrentUserIdx] = useState(initialIndex);
  const [currentStoryIdx, setCurrentStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef(null);

  const currentUser = users[currentUserIdx];
  const stories = currentUser?.stories || [];
  const currentStory = stories[currentStoryIdx];

  useEffect(() => {
    if (!currentStory) return;
    setProgress(0);
    const startTime = Date.now();
    const duration = 5000;
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(elapsed / duration, 1);
      setProgress(pct);
      if (pct >= 1) goNext();
    }, 50);
    return () => clearInterval(timerRef.current);
  }, [currentUserIdx, currentStoryIdx]);

  useEffect(() => {
    if (currentStory?.id) storiesAPI.markViewed(currentStory.id).catch(() => {});
  }, [currentStory?.id]);

  const goNext = () => {
    clearInterval(timerRef.current);
    if (currentStoryIdx < stories.length - 1) setCurrentStoryIdx(i => i + 1);
    else if (currentUserIdx < users.length - 1) { setCurrentUserIdx(i => i + 1); setCurrentStoryIdx(0); }
    else onClose();
  };

  const goPrev = () => {
    clearInterval(timerRef.current);
    if (currentStoryIdx > 0) setCurrentStoryIdx(i => i - 1);
    else if (currentUserIdx > 0) { setCurrentUserIdx(i => i - 1); setCurrentStoryIdx(0); }
  };

  if (!currentStory) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-[#1C1A17] flex items-center justify-center"
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      onDragEnd={(_, info) => { if (info.offset.y > 100) onClose(); }}
    >
      <div className="absolute top-4 left-4 right-4 flex gap-1 z-10">
        {stories.map((_, i) => (
          <div key={i} className="flex-1 h-[3px] bg-white/30 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all duration-100 ease-linear"
              style={{ width: i < currentStoryIdx ? '100%' : i === currentStoryIdx ? `${progress * 100}%` : '0%' }} />
          </div>
        ))}
      </div>

      <div className="absolute top-8 left-4 right-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <Avatar name={currentUser.user_name} url={currentUser.avatar_url} size={36} />
          <div>
            <p className="text-white text-sm font-medium">{currentUser.user_name}</p>
            <p className="text-white/60 text-[10px] font-mono">
              {currentStory.created_at ? new Date(currentStory.created_at).toLocaleDateString() : 'just now'}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-white/80 hover:text-white p-1"><ChevronLeft size={20} /></button>
      </div>

      <div className="absolute inset-0 flex z-5" onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        if (e.clientX - rect.left < rect.width * 0.3) goPrev();
        else goNext();
      }}>
        <div className="flex-1" /><div className="flex-1" />
      </div>

      <div className="max-h-[85vh] max-w-full">
        <img src={currentStory.media_url} alt="" className="max-h-[85vh] max-w-full object-contain"
          onError={(e) => { e.target.style.display = 'none'; }} />
      </div>

      {currentStory.view_count > 0 && (
        <div className="absolute bottom-8 left-4 text-white/70 font-mono text-[11px]">
          {currentStory.view_count} view{currentStory.view_count !== 1 ? 's' : ''}
        </div>
      )}
    </motion.div>
  );
}

// ─── Birthday Banner ──────────────────────────────────────────────────────────
function BirthdayBanner({ birthdays }) {
  const navigate = useNavigate();
  if (!birthdays?.length) return null;
  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
      {birthdays.map((b) => (
        <div key={b.person_id}
          className="flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] border border-[var(--gilt)]/30"
          style={{ background: 'rgba(196, 152, 79, 0.08)', minWidth: 200 }}>
          <Cake size={20} className="text-[var(--gilt)] flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm text-[var(--ink)] font-medium truncate">{b.person_name}</p>
            <p className="text-[11px] font-mono text-[var(--ink-light)]">
              {b.days_until === 0 ? 'Today!' : `${b.days_until} day${b.days_until > 1 ? 's' : ''} away`}
            </p>
          </div>
          <button onClick={() => navigate(`/post/new?person=${b.person_id}`)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full bg-[var(--seal)] text-white text-[11px] font-medium hover:bg-[var(--seal-hover)] transition-colors">
            Wish
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────
function PostCard({ post, index }) {
  const [liked, setLiked] = useState(post.user_has_liked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState(post.recent_comments || []);
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const photos = post.photos || [];

  const handleLike = async () => {
    const prev = liked;
    setLiked(!liked);
    setLikesCount(c => prev ? c - 1 : c + 1);
    try {
      const data = await feedAPI.toggleLike(post.id);
      setLiked(data.liked);
      setLikesCount(data.likes_count);
    } catch { setLiked(prev); setLikesCount(c => prev ? c + 1 : c - 1); }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    const text = commentText;
    setCommentText('');
    try {
      const data = await feedAPI.addComment(post.id, text);
      setComments(prev => [...prev, data]);
    } catch {}
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      className="bg-[var(--vellum)] border border-[var(--border)] rounded-[var(--radius-md)] shadow-[var(--shadow-sm)] overflow-hidden"
    >
      <div className="flex items-center gap-3 px-5 py-4">
        <Avatar name={post.user?.name} url={post.user?.avatar_url} size={40} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--ink)] cursor-pointer"
            onClick={() => navigate(`/people/${post.user_id}`)}>{post.user?.name}</p>
          <div className="flex items-center gap-2">
            {post.location && (
              <span className="flex items-center gap-1 text-[11px] text-[var(--ink-muted)]"><MapPin size={10} />{post.location}</span>
            )}
            <span className="text-[11px] font-mono text-[var(--ink-muted)]">
              {post.created_at ? new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
            </span>
          </div>
        </div>
      </div>

      {photos.length > 0 && (
        <div className="relative">
          <img src={photos[currentPhoto]?.photo_url} alt="" className="w-full max-h-[480px] object-cover bg-[var(--page)]" />
          {photos.length > 1 && (
            <>
              {currentPhoto > 0 && (
                <button onClick={() => setCurrentPhoto(i => i - 1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center shadow-md">
                  <ChevronLeft size={18} className="text-[var(--ink)]" />
                </button>
              )}
              {currentPhoto < photos.length - 1 && (
                <button onClick={() => setCurrentPhoto(i => i + 1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center shadow-md">
                  <ChevronRight size={18} className="text-[var(--ink)]" />
                </button>
              )}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {photos.map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === currentPhoto ? 'bg-white' : 'bg-white/50'}`} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex items-center gap-4 px-5 py-3">
        <button onClick={handleLike} className="transition-transform active:scale-125">
          <Heart size={22} className={liked ? 'fill-[var(--seal)] text-[var(--seal)]' : 'text-[var(--ink-light)]'} />
        </button>
        <button onClick={() => setShowComments(!showComments)} className="text-[var(--ink-light)] hover:text-[var(--ink)] transition-colors">
          <MessageCircle size={22} />
        </button>
        <div className="flex-1" />
        <span className="text-[12px] font-mono text-[var(--ink-muted)]">{likesCount} like{likesCount !== 1 ? 's' : ''}</span>
      </div>

      {post.caption && (
        <div className="px-5 pb-2">
          <p className="text-[14px] text-[var(--ink)] leading-relaxed">
            <span className="font-medium">{post.user?.name}</span>{' '}
            {expanded || post.caption.length < 150 ? post.caption : post.caption.slice(0, 150) + '... '}
            {post.caption.length >= 150 && (
              <button onClick={() => setExpanded(!expanded)} className="text-[var(--seal)] text-[13px]">
                {expanded ? 'less' : 'more'}
              </button>
            )}
          </p>
        </div>
      )}

      {showComments && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="border-t border-[var(--border)]">
          <div className="px-5 py-3 space-y-3 max-h-[240px] overflow-y-auto">
            {post.comments_count > 2 && (
              <button className="text-[13px] text-[var(--postmark)] hover:underline">View all {post.comments_count} comments</button>
            )}
            {comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2">
                <Avatar name={c.user_name} size={24} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px]">
                    <span className="font-medium text-[var(--ink)]">{c.user_name}</span>{' '}
                    <span className="text-[var(--ink-light)]">{c.text}</span>
                  </p>
                  <p className="text-[10px] font-mono text-[var(--ink-muted)] mt-[2px]">
                    {c.created_at ? new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={handleSubmitComment} className="flex items-center gap-2 px-5 py-3 border-t border-[var(--border)]">
            <Avatar name={localStorage.getItem('memoir_user') ? JSON.parse(localStorage.getItem('memoir_user') || '{}').name : ''} size={28} />
            <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..." className="flex-1 bg-transparent border-none outline-none text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-muted)]" />
            <button type="submit" disabled={!commentText.trim()}
              className="text-[var(--seal)] disabled:text-[var(--ink-muted)] transition-colors"><Send size={16} /></button>
          </form>
        </motion.div>
      )}
    </motion.div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-[var(--vellum)] border border-[var(--border)] rounded-[var(--radius-md)] p-5 space-y-4 animate-pulse">
          <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-[var(--border)]" /><div className="space-y-2 flex-1"><div className="h-3 w-24 bg-[var(--border)] rounded" /><div className="h-2 w-16 bg-[var(--border-light)] rounded" /></div></div>
          <div className="h-[320px] bg-[var(--border)] rounded-[var(--radius-sm)]" />
          <div className="flex gap-4"><div className="h-5 w-5 bg-[var(--border)] rounded" /><div className="h-5 w-5 bg-[var(--border)] rounded" /></div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Feed Page ───────────────────────────────────────────────────────────
export default function FeedPage() {
  const navigate = useNavigate();
  const [familyId, setFamilyId] = useState(null);
  const [family, setFamily] = useState(null);
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [birthdays, setBirthdays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [storyViewerIndex, setStoryViewerIndex] = useState(0);
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
      storiesAPI.getActive(familyId),
      birthdaysAPI.getUpcoming(familyId),
      notificationsAPI.unreadCount(),
    ]).then(([feedData, storiesData, birthdaysData, notifData]) => {
      setPosts(feedData.posts || []);
      setNextCursor(feedData.next_cursor);
      setHasMore(feedData.has_more);
      setStories(storiesData || []);
      setBirthdays(birthdaysData || []);
      setUnreadNotifs(notifData.count || 0);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [familyId]);

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
        <div className="sticky top-0 z-40 bg-[var(--page)]/95 backdrop-blur-sm border-b border-[var(--border)]">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-[var(--seal)] flex items-center justify-center">
                <span className="font-display text-sm text-[var(--seal)]">M</span>
              </div>
              <h1 className="font-display text-lg text-[var(--ink)]">Memoir</h1>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/notifications')} className="relative">
                <Heart size={20} className="text-[var(--ink-light)] hover:text-[var(--ink)] transition-colors" />
                {unreadNotifs > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--seal)] text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadNotifs > 9 ? '9+' : unreadNotifs}
                  </span>
                )}
              </button>
              <button onClick={() => navigate('/post/new')} className="btn btn-primary btn-sm">
                <Camera size={15} /><span className="hidden sm:inline">Post</span>
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-6">
          {stories.length > 0 && (
            <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
              {stories.map((user, i) => (
                <StoryBubble key={user.user_id} user={user} onOpen={() => { setStoryViewerIndex(i); setStoryViewerOpen(true); }} />
              ))}
            </div>
          )}

          {birthdays.length > 0 && <BirthdayBanner birthdays={birthdays} />}

          {loading ? <FeedSkeleton /> : (
            posts.length === 0 ? (
              <div className="text-center py-20 animate-fade-in">
                <div className="w-16 h-16 mx-auto mb-5 rounded-full border-2 border-dashed border-[var(--border)] flex items-center justify-center">
                  <Camera size={28} className="text-[var(--ink-muted)] opacity-40" />
                </div>
                <div className="thread-divider max-w-[100px] mx-auto mb-6" />
                <h2 className="font-display text-xl mb-2">No posts yet</h2>
                <p className="text-[var(--ink-light)] text-sm max-w-sm mx-auto mb-6">Share your first family memory — a photo, a story, a moment.</p>
                <button onClick={() => navigate('/post/new')} className="btn-seal"><Camera size={18} /> Share a Memory</button>
              </div>
            ) : (
              <div className="space-y-6">
                {posts.map((post, i) => <PostCard key={post.id} post={post} index={i} />)}
                {hasMore && <div ref={loaderRef} className="flex justify-center py-4"><div className="animate-thread-pull w-32 h-px" /></div>}
              </div>
            )
          )}
        </div>
      </div>

      <AnimatePresence>
        {storyViewerOpen && (
          <StoryViewer users={stories} initialIndex={storyViewerIndex} onClose={() => setStoryViewerOpen(false)} />
        )}
      </AnimatePresence>

      <BottomTabBar activeTab="feed" unreadCount={unreadNotifs} familyId={familyId} />
    </div>
  );
}
