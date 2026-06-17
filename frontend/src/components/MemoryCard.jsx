import { useState } from 'react';
import { formatDate, getInitials } from '../lib/api';
import { MessageCircle, ChevronDown, ChevronUp, Image as ImageIcon } from 'lucide-react';

export default function MemoryCard({ memory, personName, compact = false }) {
  const [expanded, setExpanded] = useState(false);
  const [lightboxImg, setLightboxImg] = useState(null);
  const isTruncated = (memory.story_text?.length || 0) > 150;

  const handleWhatsAppShare = () => {
    const text = `📖 ${memory.title}\n\n${memory.story_text || ''}\n\n- ${personName || memory.person_name || 'Family'}`;
    const url = `${window.location.origin}/memories/${memory.id}/public`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n\n' + url)}`, '_blank');
  };

  const photos = memory.photos || [];

  return (
    <>
      <div className="card overflow-hidden">
        <div className="p-5">
          {/* Title + Date */}
          <div className="mb-3">
            <h3 className="font-display text-lg text-[var(--text)]">{memory.title}</h3>
            {memory.memory_date && (
              <p className="text-[13px] text-[var(--text-muted)] mt-0.5 font-serif italic">
                {formatDate(memory.memory_date)}
              </p>
            )}
          </div>

          {/* Story */}
          {memory.story_text && (
            <div className="mb-3">
              <p className={`text-[var(--text-secondary)] leading-relaxed text-[14px] ${!expanded && isTruncated ? 'line-clamp-3' : ''}`}>
                {memory.story_text}
              </p>
              {isTruncated && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="mt-1 text-[13px] text-[var(--accent)] hover:underline flex items-center gap-1 transition-colors"
                >
                  {expanded ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Read more</>}
                </button>
              )}
            </div>
          )}

          {/* Photos */}
          {photos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-thin">
              {photos.slice(0, 4).map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => setLightboxImg(photo.photo_url)}
                  className="flex-shrink-0 w-[72px] h-[72px] rounded-[var(--radius-sm)] overflow-hidden border border-[var(--border)] hover:opacity-80 transition-opacity"
                >
                  <img src={photo.photo_url} alt={photo.caption || ''} className="w-full h-full object-cover" />
                </button>
              ))}
              {photos.length > 4 && (
                <div className="flex-shrink-0 w-[72px] h-[72px] rounded-[var(--radius-sm)] bg-[var(--bg)] flex items-center justify-center text-[var(--text-muted)] text-sm font-medium">
                  +{photos.length - 4}
                </div>
              )}
            </div>
          )}

          {/* Voice Note */}
          {memory.voice_note_url && (
            <div className="mb-3 p-3 bg-[var(--bg)] rounded-[var(--radius-sm)]">
              <audio controls className="w-full h-10">
                <source src={memory.voice_note_url} />
              </audio>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
            <div className="flex items-center gap-2">
              {memory.contributor ? (
                <>
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium text-white"
                    style={{ background: 'var(--accent)' }}
                  >
                    {getInitials(memory.contributor.name)}
                  </div>
                  <span className="text-[13px] text-[var(--text-muted)]">
                    {memory.contributor.name}
                  </span>
                </>
              ) : (
                <span className="text-[13px] text-[var(--text-muted)]">{personName || memory.person_name}</span>
              )}
            </div>
            <button
              onClick={handleWhatsAppShare}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#25D366] bg-[var(--success-bg)] hover:bg-[rgba(37,211,102,0.15)] transition-colors"
              title="Share to WhatsApp"
            >
              <MessageCircle size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Skeleton */}
      {!memory.id && (
        <div className="card p-5 space-y-3">
          <div className="skeleton h-6 w-3/4" />
          <div className="skeleton h-4 w-1/3" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-5/6" />
          <div className="skeleton h-4 w-2/3" />
          <div className="flex gap-2">
            <div className="skeleton w-[72px] h-[72px] rounded-[var(--radius-sm)]" />
            <div className="skeleton w-[72px] h-[72px] rounded-[var(--radius-sm)]" />
          </div>
          <div className="skeleton h-8 w-full rounded-[var(--radius-sm)]" />
        </div>
      )}

      {/* Lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setLightboxImg(null)}
        >
          <img src={lightboxImg} alt="Memory" className="max-w-full max-h-[90vh] rounded-[var(--radius-sm)] object-contain" />
        </div>
      )}
    </>
  );
}
