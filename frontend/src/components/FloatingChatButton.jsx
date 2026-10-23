import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';

export default function FloatingChatButton({ familyId }) {
  const navigate = useNavigate();

  if (!familyId) return null;

  return (
    <button
      onClick={() => navigate(`/family/${familyId}/assistant`)}
      className="fixed bottom-24 md:bottom-8 right-6 z-50 w-14 h-14 rounded-full bg-[var(--primary)] text-[var(--bg)] shadow-[0_4px_16px_rgba(47,93,70,0.3)] hover:bg-[var(--primary-hover)] active:scale-95 transition-all duration-150 flex items-center justify-center"
      title="Ask the Memory Assistant"
      aria-label="Open Memory Assistant"
    >
      <MessageCircle />
    </button>
  );
}
