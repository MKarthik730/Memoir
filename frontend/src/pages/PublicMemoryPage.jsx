import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { memoriesAPI } from '../lib/api';
import { formatDate } from '../lib/api';
import { MessageCircle, BookOpen } from 'lucide-react';

export default function PublicMemoryPage() {
  const { memory_id } = useParams();
  const [memory, setMemory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lightboxImg, setLightboxImg] = useState(null);

  useEffect(() => { fetchMemory(); }, [memory_id]);

  const fetchMemory = async () => {
    setLoading(true);
    try {
      const data = await memoriesAPI.getPublic(memory_id);
      setMemory(data);
    } catch (err) {
      setError('This memory could not be found.');
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppShare = () => {
    const text = `📖 ${memory?.title || 'Memory'}\n\n${memory?.story_text || ''}\n\n- ${memory?.person_name || 'Family'}`;
    const url = window.location.href;
    window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n\n' + url)}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--page)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-thread-pull w-32 h-px mx-auto mb-4" />
          <p className="text-[var(--ink-muted)] text-sm font-mono text-xs tracking-wider">Opening this letter...</p>
        </div>
      </div>
    );
  }

  if (error || !memory) {
    return (
      <div className="min-h-screen bg-[var(--page)] flex items-center justify-center p-4">
        <div className="text-center max-w-md animate-fade-in-up">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full border-2 border-dashed border-[var(--border)] flex items-center justify-center">
            <span className="font-display text-2xl text-[var(--ink-muted)]">M</span>
          </div>
          <h1 className="font-display text-2xl mb-4">This letter is lost.</h1>
          <p className="text-[var(--ink-light)] mb-8">{error || 'The memory you are looking for does not exist.'}</p>
          <Link to="/" className="btn btn-primary">Go Home</Link>
        </div>
      </div>
    );
  }

  const photos = memory.photos || [];

  return (
    <div className="min-h-screen bg-[var(--page)]">
      <div className="max-w-2xl mx-auto px-4 py-12 animate-fade-in-up">
        {/* Breadcrumb */}
        <div className="text-center mb-8">
          <div className="postmark inline-flex mx-auto mb-4">
            <span>Shared letter</span>
          </div>
          {memory.family_name && (
            <p className="font-mono text-[12px] text-[var(--ink-muted)] tracking-[0.02em]">
              From the archive of <span className="text-[var(--seal)]">{memory.family_name}</span>
            </p>
          )}
        </div>

        {/* Memory Content */}
        <div className="bg-[var(--vellum)] rounded-[var(--radius-md)] p-8 md:p-10 border border-[var(--border)] shadow-[var(--shadow-sm)] relative">
          {/* Thread line */}
          <div className="absolute left-0 top-0 bottom-0 w-[3px] opacity-40"
            style={{
              background: 'repeating-linear-gradient(to bottom, var(--border) 0px, var(--border) 4px, transparent 4px, transparent 8px)',
            }}
          />

          {/* Title + Postmark Date */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <h1 className="font-display text-[32px] text-[var(--ink)] leading-tight">
              {memory.title}
            </h1>
            {memory.memory_date && (
              <div className="postmark flex-shrink-0 mt-2">
                <span>{formatDate(memory.memory_date)}</span>
              </div>
            )}
          </div>

          {/* Story */}
          {memory.story_text && (
            <div className="mb-8">
              <p className="text-[var(--ink)] leading-relaxed whitespace-pre-line font-body" style={{ fontSize: '15px', lineHeight: '1.8' }}>
                {memory.story_text}
              </p>
            </div>
          )}

          {/* Photos */}
          {photos.length > 0 && (
            <div className="mb-8 space-y-4">
              {photos.map((photo) => (
                <img
                  key={photo.id}
                  src={photo.photo_url}
                  alt={photo.caption || ''}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] cursor-pointer hover:opacity-95 transition-opacity"
                  onClick={() => setLightboxImg(photo.photo_url)}
                />
              ))}
            </div>
          )}

          {/* Voice Note */}
          {memory.voice_note_url && (
            <div className="mb-8 p-4 bg-[var(--page)] rounded-[var(--radius-sm)] border border-[var(--border)]">
              <audio controls src={memory.voice_note_url} className="w-full h-11" />
            </div>
          )}

          {/* Thread divider */}
          <div className="thread-divider my-6" />

          {/* Contributor */}
          {memory.contributor && (
            <div className="text-center text-sm text-[var(--ink-light)] font-body">
              Shared by {memory.contributor.name}
            </div>
          )}

          {/* Share */}
          <div className="text-center mt-6">
            <button onClick={handleWhatsAppShare}
              className="btn inline-flex items-center gap-2 px-6 py-3 text-white rounded-[var(--radius-sm)] font-medium text-sm transition-all active:scale-[0.98]"
              style={{ background: '#2E7D6E' }}>
              <MessageCircle size={18} />
              Share on WhatsApp
            </button>
          </div>
        </div>

        {/* CTA */}
        {memory.family_name && (
          <div className="text-center mt-8 p-6 bg-[var(--vellum)] rounded-[var(--radius-md)] border border-[var(--border)]">
            <h3 className="font-display text-lg mb-2">Join {memory.family_name}</h3>
            <p className="text-[var(--ink-light)] text-sm mb-4">Preserve your family's letters and memories</p>
            <Link to="/login" className="btn-seal">Get Started</Link>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(28,26,23,0.85)' }} onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="Memory" className="max-w-full max-h-[90vh] rounded-[var(--radius-sm)] object-contain" />
        </div>
      )}
    </div>
  );
}
