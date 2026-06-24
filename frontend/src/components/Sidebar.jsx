import { Link, useNavigate } from 'react-router-dom';
import { Home, Search, Share2, Settings, MessageCircle, LogOut, Archive, Heart, User, BookOpen, Route } from 'lucide-react';
import Avatar from './ui/Avatar';

export default function Sidebar({ family, familyId, activePage }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('memoir_token');
    localStorage.removeItem('memoir_user');
    navigate('/login');
  };

  const members = family?.members || [];
  const visibleMembers = members.slice(0, 5);
  const remainingCount = members.length - 5;

  const MEMBER_COLORS = ['#A85542', '#4A6B8A', '#C4984F', '#5A8A7A', '#8B6B8B'];

  const navItems = [
    { id: 'feed', label: 'Feed', icon: Home, path: '/' },
    { id: 'journal', label: 'Journal', icon: BookOpen, path: `/family/${familyId || ''}` },
    { id: 'trips', label: 'Trips', icon: Route, path: '/trips' },
    { id: 'vault', label: 'Vault', icon: Archive, path: '/vault' },
    { id: 'notifications', label: 'Alerts', icon: Heart, path: '/notifications' },
    { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
    { id: 'search', label: 'Search', icon: Search, path: `/family/${familyId}/search` },
    { id: 'graph', label: 'Tree', icon: Share2, path: `/family/${familyId}/graph` },
    { id: 'assistant', label: 'Assistant', icon: MessageCircle, path: `/family/${familyId}/assistant` },
  ];

  return (
    <aside className="hidden md:flex flex-col flex-shrink-0 bg-[var(--vellum)] border-r border-[var(--border)]" style={{ width: 240, minHeight: '100vh' }}>
      {/* Logo */}
      <div className="px-5 py-[20px] border-b border-[var(--border)]">
        <Link to="/" className="flex items-center gap-3 no-underline">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--seal)] flex items-center justify-center">
            <span className="font-display italic text-sm text-[var(--seal)]">M</span>
          </div>
          <span className="font-display italic text-[20px] text-[var(--ink)]">Memoir</span>
        </Link>
      </div>

      <div className="thread-line mx-5 my-3" />

      <nav className="flex-1 px-3 py-2 space-y-[2px]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <Link
              key={item.id}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-[10px] rounded-[8px] text-sm transition-all no-underline ${
                isActive
                  ? 'bg-[rgba(168,85,66,0.1)] text-[var(--seal)] font-medium'
                  : 'text-[var(--ink-light)] hover:bg-[rgba(168,85,66,0.05)] hover:text-[var(--ink)]'
              }`}
            >
              <Icon size={18} className="flex-shrink-0" />
              <span className="text-[14px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-[var(--border)]">
        {members.length > 0 && (
          <>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-muted)] mb-2">MEMBERS</p>
            <div className="flex items-center gap-[6px] mb-3">
              {visibleMembers.map((member, i) => (
                <div
                  key={member.id}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium text-[var(--page)]"
                  style={{ background: MEMBER_COLORS[i % MEMBER_COLORS.length] }}
                >
                  {member.name?.charAt(0).toUpperCase()}
                </div>
              ))}
              {remainingCount > 0 && (
                <div className="w-7 h-7 rounded-full bg-[var(--page)] flex items-center justify-center text-[10px] text-[var(--ink-muted)] border-2 border-[var(--vellum)] font-mono">
                  +{remainingCount}
                </div>
              )}
            </div>
            <div className="thread-line mb-3" />
          </>
        )}

        <Link
          to="/settings"
          className="flex items-center gap-3 w-full px-4 py-[8px] rounded-[8px] text-[13px] text-[var(--ink-light)] hover:bg-[rgba(168,85,66,0.05)] hover:text-[var(--ink)] transition-all no-underline"
        >
          <Settings size={18} className="flex-shrink-0" />
          <span>Settings</span>
        </Link>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-[8px] rounded-[8px] text-[13px] text-[var(--ink-light)] hover:bg-[rgba(168,85,66,0.05)] hover:text-[var(--ink)] transition-all no-underline"
        >
          <LogOut size={18} className="flex-shrink-0" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
