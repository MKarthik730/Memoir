import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { memoriesAPI } from '../lib/api';
import { formatDate } from '../lib/api';
import { MessageCircle, Loader2, Home } from 'lucide-react';

export default function PublicMemoryPage() {
  const { memory_id } = useParams();
  const [memory, setMemory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMemory();
  }, [memory_id]);

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
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#B8975A]" />
      </div>
    );
  }

  if (error || !memory) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">😕</div>
          <h1 className="font-display text-4xl text-[#4A1C0A] mb-4">This memory is lost.</h1>
          <p className="text-[#8B7355] mb-8">{error || 'The memory you are looking for does not exist.'}</p>
          <Link to="/" className="btn-primary">Go Home</Link>
        </div>
      </div>
    );
  }

  const photos = memory.photos || [];

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Simple centered layout */}
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Breadcrumb */}
        <div className="text-sm text-[#8B7355] mb-8 font-body italic text-center">
          {memory.family_name && <>{memory.family_name} &mdash; </>}
          {memory.person_name && <>{memory.person_name}</>}
        </div>

        {/* Memory Content */}
        <div className="bg-[#FAF7F2] rounded-xl p-8 border border-[rgba(184,151,90,0.2)] shadow-[0_4px_24px_rgba(44,24,16,0.08)]">
          {/* Title */}
          <h1 className="font-display text-3xl text-[#4A1C0A] mb-3 text-center">
            {memory.title}
          </h1>

          {/* Date */}
          {memory.memory_date && (
            <p className="font-body italic text-[#8B7355] text-center mb-6">
              {formatDate(memory.memory_date)}
            </p>
          )}

          {/* Story */}
          {memory.story_text && (
            <div className="mb-8">
              <p className="text-[#2C1810] leading-relaxed whitespace-pre-line">
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
                  className="w-full rounded-lg border border-[rgba(184,151,90,0.2)]"
                />
              ))}
            </div>
          )}

          {/* Voice Note */}
          {memory.voice_note_url && (
            <div className="mb-8 p-4 bg-[#F5F0E8] rounded-lg">
              <audio controls src={memory.voice_note_url} className="w-full h-12" />
            </div>
          )}

          {/* Contributor */}
          {memory.contributor && (
            <div className="text-center text-sm text-[#8B7355] font-body italic border-t border-[rgba(184,151,90,0.15)] pt-6">
              Shared by {memory.contributor.name}
            </div>
          )}

          {/* WhatsApp Share */}
          <div className="text-center mt-6">
            <button
              onClick={handleWhatsAppShare}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white rounded-lg font-ui text-sm hover:brightness-110 transition-all"
            >
              <MessageCircle size={18} />
              Share on WhatsApp
            </button>
          </div>
        </div>

        {/* CTA */}
        {memory.family_name && (
          <div className="text-center mt-8 p-6 bg-[#F5F0E8] rounded-xl border border-[rgba(184,151,90,0.15)]">
            <p className="font-display text-lg text-[#4A1C0A] mb-3">
              Join {memory.family_name} on Memoir
            </p>
            <p className="text-sm text-[#8B7355] mb-4 font-body italic">
              Preserve and share your family's precious memories
            </p>
            <Link to="/login" className="btn-primary inline-block">
              Get Started
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
