import { Link } from 'react-router-dom';
import { Home, Search, Share2, MessageCircle, Settings } from 'lucide-react';

export default function BottomTabBar({ familyId, activeTab }) {
  const tabs = [
    { id: 'home', label: 'Home', icon: Home, path: `/family/${familyId}` },
    { id: 'search', label: 'Search', icon: Search, path: `/family/${familyId}/search` },
    { id: 'graph', label: 'Graph', icon: Share2, path: `/family/${familyId}/graph` },
    { id: 'assistant', label: 'Ask AI', icon: MessageCircle, path: `/family/${familyId}/assistant` },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--surface)] border-t border-[var(--border)] safe-area-bottom">
      <div className="flex items-center justify-around py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <Link
              key={tab.id}
              to={tab.path}
              className={`flex flex-col items-center gap-[2px] px-4 py-1 transition-colors no-underline ${
                isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{tab.label}</span>
              {isActive && (
                <div className="w-5 h-[3px] bg-[var(--accent)] rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
