import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';

export default function FloatingChatButton({ familyId }) {
  const navigate = useNavigate();

  if (!familyId) return null;

  return (
    <button
      onClick={() => navigate(`/family/${familyId}/assistant`)}
      className="fixed bottom-24 md:bottom-8 right-6 z-50 w-14 h-14 rounded-full bg-[var(--accent)] text-white shadow-[var(--shadow-lg)] hover:bg-[var(--accent-hover)] active:scale-95 transition-all duration-200 flex items-center justify-center"
      title="Ask the Memory Assistant"
      aria-label="Open Memory Assistant"
    >
      <MessageCircle size={24} />
    </button>
  );
}
