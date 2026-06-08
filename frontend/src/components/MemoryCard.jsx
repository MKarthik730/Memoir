import { useState } from 'react';
import { formatDate, getInitials } from '../lib/api';
import { Play, MessageCircle, ChevronDown, ChevronUp, Image as ImageIcon } from 'lucide-react';

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
      <div className="card rounded-lg overflow-hidden">
        <div className="p-5">
          {/* Title and Date */}
          <div className="mb-3">
            <h3 className="font-display text-lg text-[#2C1810] mb-1">{memory.title}</h3>
            {memory.memory_date && (
              <p className="font-body italic text-sm text-[#8B7355]">{formatDate(memory.memory_date)}</p>
            )}
          </div>

          {/* Story Text */}
          {memory.story_text && (
            <div className="mb-3">
              <p className={`text-[#4A4035] leading-relaxed ${!expanded && isTruncated ? 'line-clamp-3' : ''}`}>
                {memory.story_text}
              </p>
              {isTruncated && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="mt-1 text-sm text-[#B8975A] hover:underline flex items-center gap-1"
                >
                  {expanded ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Read more</>}
                </button>
              )}
            </div>
          )}

          {/* Photos Strip */}
          {photos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-thin">
              {photos.slice(0, 4).map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => setLightboxImg(photo.photo_url)}
                  className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-[rgba(184,151,90,0.2)] hover:opacity-80 transition-opacity"
                >
                  <img src={photo.photo_url} alt={photo.caption || ''} className="w-full h-full object-cover" />
                </button>
              ))}
              {photos.length > 4 && (
                <div className="flex-shrink-0 w-20 h-20 rounded-lg bg-[#F5F0E8] flex items-center justify-center text-[#8B7355] text-sm font-ui">
                  +{photos.length - 4}
                </div>
              )}
            </div>
          )}

          {/* Voice Note */}
          {memory.voice_note_url && (
            <div className="mb-3 p-3 bg-[#F5F0E8] rounded-lg">
              <audio controls className="w-full h-10">
                <source src={memory.voice_note_url} />
              </audio>
            </div>
          )}

          {/* Footer - Contributor and Share */}
          <div className="flex items-center justify-between pt-3 border-t border-[rgba(184,151,90,0.15)]">
            <div className="flex items-center gap-2">
              {memory.contributor ? (
                <>
                  <div className="w-7 h-7 rounded-full bg-[#B8975A] flex items-center justify-center text-xs text-white font-ui">
                    {getInitials(memory.contributor.name)}
                  </div>
                  <span className="font-body italic text-sm text-[#8B7355]">{memory.contributor.name}</span>
                </>
              ) : (
                <span className="font-body italic text-sm text-[#8B7355]">{personName || memory.person_name}</span>
              )}
            </div>
            <button
              onClick={handleWhatsAppShare}
              className="p-2 text-[#25D366] hover:bg-green-50 rounded-lg transition-colors"
              title="Share to WhatsApp"
            >
              <MessageCircle size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Loading skeleton */}
      {!memory.id && (
        <div className="card rounded-lg p-5">
          <div className="skeleton h-6 w-3/4 mb-3" />
          <div className="skeleton h-4 w-1/3 mb-4" />
          <div className="skeleton h-4 w-full mb-2" />
          <div className="skeleton h-4 w-5/6 mb-2" />
          <div className="skeleton h-4 w-2/3 mb-4" />
          <div className="flex gap-2 mb-3">
            <div className="skeleton w-20 h-20 rounded-lg" />
            <div className="skeleton w-20 h-20 rounded-lg" />
            <div className="skeleton w-20 h-20 rounded-lg" />
          </div>
          <div className="skeleton h-8 w-full" />
        </div>
      )}

      {/* Lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4"
          onClick={() => setLightboxImg(null)}
        >
          <img src={lightboxImg} alt="Memory" className="max-w-full max-h-[90vh] rounded-lg object-contain" />
        </div>
      )}
    </>
  );
}
