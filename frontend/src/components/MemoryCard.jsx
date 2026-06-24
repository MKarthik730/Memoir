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
      <div className="bg-[var(--vellum)] border border-[var(--border)] rounded-[10px] overflow-hidden relative"
        style={{ borderLeft: '3px dashed var(--seal)' }}>
        <div className="p-4" style={{ paddingLeft: 20 }}>
          {/* Title + Postmark Date */}
          <div className="mb-3 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-[16px] text-[var(--ink)]">{memory.title}</h3>
            </div>
            {memory.memory_date && (
              <div className="font-mono text-[11px] text-[var(--postmark)] border border-[var(--postmark)] rounded-[2px] px-2 py-[2px] bg-[rgba(74,107,138,0.04)] flex-shrink-0 mt-0.5">
                <span>{formatDate(memory.memory_date)}</span>
              </div>
            )}
          </div>

          {/* Person label */}
          {personName && (
            <p className="text-[12px] text-[var(--ink-muted)] mb-[6px]">{personName}</p>
          )}

          {/* Story */}
          {memory.story_text && (
            <div className="mb-3">
              <p className={`text-[13px] text-[var(--ink-light)] leading-[1.7] ${!expanded && isTruncated ? 'line-clamp-3' : ''}`}>
                {memory.story_text}
              </p>
              {isTruncated && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="mt-1 text-[12px] text-[var(--seal)] hover:underline flex items-center gap-1 transition-colors"
                >
                  {expanded ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Continue reading</>}
                </button>
              )}
            </div>
          )}

          {/* Photos */}
          {photos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
              {photos.slice(0, 4).map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => setLightboxImg(photo.photo_url)}
                  className="flex-shrink-0 w-[48px] h-[44px] rounded-[6px] overflow-hidden border border-[var(--border)] hover:opacity-80 transition-opacity"
                >
                  <img src={photo.photo_url} alt={photo.caption || ''} className="w-full h-full object-cover" />
                </button>
              ))}
              {photos.length > 4 && (
                <div className="flex-shrink-0 w-[48px] h-[44px] rounded-[6px] bg-[rgba(28,26,23,0.06)] flex items-center justify-center text-[var(--ink-muted)] text-sm font-mono">
                  +{photos.length - 4}
                </div>
              )}
            </div>
          )}

          {/* Voice Note */}
          {memory.voice_note_url && (
            <div className="mb-3 p-3 bg-[rgba(74,107,138,0.06)] border border-[rgba(74,107,138,0.15)] rounded-[6px]">
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
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-medium text-[var(--page)]"
                    style={{ background: 'var(--seal)' }}
                  >
                    {getInitials(memory.contributor.name)}
                  </div>
                  <span className="text-[12px] text-[var(--ink-muted)]">
                    {memory.contributor.name}
                  </span>
                </>
              ) : (
                <span className="text-[12px] text-[var(--ink-muted)]">{personName || memory.person_name}</span>
              )}
            </div>
            <button
              onClick={handleWhatsAppShare}
              className="px-3 py-1 rounded-full text-[11px] text-[var(--success)] bg-[var(--success-bg)] border border-[var(--success)] hover:bg-[rgba(46,125,110,0.15)] transition-colors flex items-center gap-1"
              title="Share to WhatsApp"
            >
              <MessageCircle size={12} />
              <span className="hidden sm:inline">Share</span>
            </button>
          </div>
        </div>
      </div>

      {/* Skeleton */}
      {!memory.id && (
        <div className="bg-[var(--vellum)] border border-[var(--border)] rounded-[10px] p-4 space-y-3 relative"
          style={{ borderLeft: '3px dashed var(--seal)' }}>
          <div className="skeleton h-6 w-3/4" />
          <div className="skeleton h-4 w-1/3" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-5/6" />
          <div className="skeleton h-4 w-2/3" />
          <div className="flex gap-2">
            <div className="skeleton w-[56px] h-[56px] rounded-[6px]" />
            <div className="skeleton w-[56px] h-[56px] rounded-[6px]" />
          </div>
          <div className="skeleton h-8 w-full rounded-[6px]" />
        </div>
      )}

      {/* Lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(28,26,23,0.85)' }}
          onClick={() => setLightboxImg(null)}
        >
          <img src={lightboxImg} alt="Memory" className="max-w-full max-h-[90vh] rounded-[6px] object-contain" />
        </div>
      )}
    </>
  );
}
