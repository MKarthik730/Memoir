import { Link, useNavigate } from 'react-router-dom';
import { Home, Search, Share2, Settings, MessageCircle, LogOut, Archive, Heart, User, BookOpen } from 'lucide-react';
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

  const navItems = [
    { id: 'feed', label: 'Feed', icon: Home, path: '/' },
    { id: 'journal', label: 'Journal', icon: BookOpen, path: `/family/${familyId || ''}` },
    { id: 'vault', label: 'Vault', icon: Archive, path: '/vault' },
    { id: 'notifications', label: 'Alerts', icon: Heart, path: '/notifications' },
    { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
    { id: 'search', label: 'Search', icon: Search, path: `/family/${familyId}/search` },
    { id: 'graph', label: 'Tree', icon: Share2, path: `/family/${familyId}/graph` },
    { id: 'assistant', label: 'Assistant', icon: MessageCircle, path: `/family/${familyId}/assistant` },
  ];

  return (
    <aside
      className="hidden md:flex flex-col flex-shrink-0 bg-[var(--vellum)] border-r border-[var(--border)]"
      style={{ width: 'var(--sidebar-width)', minHeight: '100vh' }}
    >
      {/* Logo */}
      <div className="px-5 py-6 border-b border-[var(--border)]">
        <Link to="/" className="flex items-center gap-[10px] no-underline">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--seal)] flex items-center justify-center">
            <span className="font-display italic text-sm text-[var(--seal)]">M</span>
          </div>
          <span className="font-display text-lg text-[var(--ink)]">Memoir</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-[2px]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <Link
              key={item.id}
              to={item.path}
              className={`flex items-center gap-[10px] px-[14px] py-[10px] rounded-[var(--radius-sm)] text-sm font-medium transition-all no-underline ${
                isActive
                  ? 'bg-[var(--seal-light)] text-[var(--seal)]'
                  : 'text-[var(--ink-light)] hover:bg-[var(--seal-lighter)] hover:text-[var(--ink)]'
              }`}
            >
              <Icon size={18} className="flex-shrink-0 opacity-70" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Members + Settings + Logout */}
      <div className="px-5 py-4 border-t border-[var(--border)]">
        {members.length > 0 && (
          <>
            <div className="flex items-center gap-[6px] mb-2">
              {visibleMembers.map((member) => (
                <Avatar key={member.id} name={member.name} size={28} />
              ))}
              {remainingCount > 0 && (
                <div className="w-7 h-7 rounded-full bg-[var(--page)] flex items-center justify-center text-[10px] text-[var(--ink-muted)] border-2 border-[var(--vellum)] font-mono">
                  +{remainingCount}
                </div>
              )}
            </div>
            <p className="text-[11px] font-mono tracking-[0.04em] text-[var(--ink-muted)] mb-3 uppercase">
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </p>
          </>
        )}
        <Link
          to="/settings"
          className="flex items-center gap-[10px] w-full px-[14px] py-[10px] rounded-[var(--radius-sm)] text-sm text-[var(--ink-light)] hover:bg-[var(--seal-lighter)] hover:text-[var(--ink)] transition-all no-underline mb-1"
        >
          <Settings size={18} className="flex-shrink-0 opacity-70" />
          <span>Settings</span>
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-[10px] w-full px-[14px] py-[10px] rounded-[var(--radius-sm)] text-sm text-[var(--ink-light)] hover:bg-[var(--seal-lighter)] hover:text-[var(--ink)] transition-all no-underline"
        >
          <LogOut size={18} className="flex-shrink-0 opacity-70" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
