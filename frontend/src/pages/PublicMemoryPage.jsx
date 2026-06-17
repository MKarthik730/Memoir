import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { memoriesAPI } from '../lib/api';
import { formatDate } from '../lib/api';
import { MessageCircle } from 'lucide-react';

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
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="var(--border)" strokeWidth="3" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (error || !memory) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
        <div className="text-center max-w-md animate-fade-in-up">
          <div className="w-16 h-16 mx-auto mb-6 bg-[var(--accent)] rounded-[var(--radius-sm)] flex items-center justify-center">
            <span className="font-display italic text-[28px] text-white">M</span>
          </div>
          <h1 className="font-display text-3xl mb-4">This memory is lost.</h1>
          <p className="text-[var(--text-secondary)] mb-8">{error || 'The memory you are looking for does not exist.'}</p>
          <Link to="/" className="btn btn-primary">Go Home</Link>
        </div>
      </div>
    );
  }

  const photos = memory.photos || [];

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="max-w-2xl mx-auto px-4 py-12 animate-fade-in-up">
        {/* Breadcrumb */}
        <div className="text-sm text-[var(--text-muted)] mb-8 font-serif italic text-center">
          {memory.family_name && <>{memory.family_name} &mdash; </>}
          {memory.person_name && <>{memory.person_name}</>}
        </div>

        {/* Memory Content */}
        <div className="bg-[var(--surface)] rounded-[var(--radius-lg)] p-8 md:p-10 border border-[var(--border)] shadow-[var(--shadow-sm)]">
          {/* Title */}
          <h1 className="font-display text-[32px] text-[var(--text)] mb-3 text-center leading-tight">
            {memory.title}
          </h1>

          {/* Date */}
          {memory.memory_date && (
            <p className="text-[var(--text-muted)] text-sm font-serif italic text-center mb-8">
              {formatDate(memory.memory_date)}
            </p>
          )}

          {/* Story */}
          {memory.story_text && (
            <div className="mb-8">
              <p className="text-[var(--text)] leading-relaxed whitespace-pre-line font-serif" style={{ fontSize: '15px', lineHeight: '1.8' }}>
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
            <div className="mb-8 p-4 bg-[var(--bg)] rounded-[var(--radius-sm)]">
              <audio controls src={memory.voice_note_url} className="w-full h-11" />
            </div>
          )}

          {/* Contributor */}
          {memory.contributor && (
            <div className="text-center text-sm text-[var(--text-muted)] font-serif italic border-t border-[var(--border)] pt-6">
              Shared by {memory.contributor.name}
            </div>
          )}

          {/* Share */}
          <div className="text-center mt-6">
            <button onClick={handleWhatsAppShare}
              className="btn inline-flex items-center gap-2 px-6 py-3 text-white rounded-[var(--radius-sm)] font-medium text-sm transition-all active:scale-[0.98]"
              style={{ background: '#25D366' }}>
              <MessageCircle size={18} />
              Share on WhatsApp
            </button>
          </div>
        </div>

        {/* CTA */}
        {memory.family_name && (
          <div className="text-center mt-8 p-6 bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--border)]">
            <h3 className="font-display text-lg mb-2">Join {memory.family_name} on Memoir</h3>
            <p className="text-[var(--text-secondary)] text-sm mb-4">Preserve and share your family's precious memories</p>
            <Link to="/login" className="btn btn-primary">Get Started</Link>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)' }} onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="Memory" className="max-w-full max-h-[90vh] rounded-[var(--radius-sm)] object-contain" />
        </div>
      )}
    </div>
  );
}
