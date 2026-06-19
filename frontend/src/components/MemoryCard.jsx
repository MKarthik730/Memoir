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
      <div className="card overflow-hidden relative">
        {/* Thread line left border (signature element) */}
        <div className="absolute left-0 top-0 bottom-0 w-[3px] opacity-40"
          style={{
            background: 'repeating-linear-gradient(to bottom, var(--border) 0px, var(--border) 4px, transparent 4px, transparent 8px)',
          }}
        />

        <div className="p-5 pl-6">
          {/* Title + Postmark Date */}
          <div className="mb-3 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-lg text-[var(--ink)]">{memory.title}</h3>
            </div>
            {memory.memory_date && (
              <div className="postmark flex-shrink-0 mt-0.5">
                <span>{formatDate(memory.memory_date)}</span>
              </div>
            )}
          </div>

          {/* Story */}
          {memory.story_text && (
            <div className="mb-3">
              <p className={`text-[var(--ink-light)] leading-relaxed text-[14px] ${!expanded && isTruncated ? 'line-clamp-3' : ''}`}>
                {memory.story_text}
              </p>
              {isTruncated && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="mt-1 text-[13px] text-[var(--seal)] hover:underline flex items-center gap-1 transition-colors"
                >
                  {expanded ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Continue reading</>}
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
                <div className="flex-shrink-0 w-[72px] h-[72px] rounded-[var(--radius-sm)] bg-[var(--page)] flex items-center justify-center text-[var(--ink-muted)] text-sm font-mono">
                  +{photos.length - 4}
                </div>
              )}
            </div>
          )}

          {/* Voice Note */}
          {memory.voice_note_url && (
            <div className="mb-3 p-3 bg-[var(--page)] rounded-[var(--radius-sm)]">
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
                    style={{ background: 'var(--seal)' }}
                  >
                    {getInitials(memory.contributor.name)}
                  </div>
                  <span className="text-[13px] text-[var(--ink-muted)] font-body">
                    {memory.contributor.name}
                  </span>
                </>
              ) : (
                <span className="text-[13px] text-[var(--ink-muted)] font-body">{personName || memory.person_name}</span>
              )}
            </div>
            <button
              onClick={handleWhatsAppShare}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--success)] bg-[var(--success-bg)] hover:bg-[rgba(46,125,110,0.15)] transition-colors"
              title="Share to WhatsApp"
            >
              <MessageCircle size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Skeleton */}
      {!memory.id && (
        <div className="card p-5 pl-6 space-y-3 relative">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] opacity-40"
            style={{
              background: 'repeating-linear-gradient(to bottom, var(--border) 0px, var(--border) 4px, transparent 4px, transparent 8px)',
            }}
          />
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
          style={{ background: 'rgba(28,26,23,0.85)' }}
          onClick={() => setLightboxImg(null)}
        >
          <img src={lightboxImg} alt="Memory" className="max-w-full max-h-[90vh] rounded-[var(--radius-sm)] object-contain" />
        </div>
      )}
    </>
  );
}
