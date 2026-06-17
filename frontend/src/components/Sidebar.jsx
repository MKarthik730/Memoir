import { Link, useNavigate } from 'react-router-dom';
import { Home, Search, Share2, Settings, MessageCircle, LogOut } from 'lucide-react';
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
    { id: 'home', label: 'Home', icon: Home, path: `/family/${familyId}` },
    { id: 'search', label: 'Search', icon: Search, path: `/family/${familyId}/search` },
    { id: 'graph', label: 'Graph', icon: Share2, path: `/family/${familyId}/graph` },
    { id: 'assistant', label: 'Assistant', icon: MessageCircle, path: `/family/${familyId}/assistant` },
  ];

  return (
    <aside
      className="hidden md:flex flex-col flex-shrink-0 bg-[var(--surface)] border-r border-[var(--border)]"
      style={{ width: 'var(--sidebar-width)', minHeight: '100vh' }}
    >
      {/* Logo */}
      <div className="px-5 py-6 border-b border-[var(--border)]">
        <Link to={`/family/${familyId}`} className="flex items-center gap-[10px] no-underline">
          <div className="w-8 h-8 bg-[var(--accent)] rounded-[var(--radius-sm)] flex items-center justify-center">
            <span className="font-display italic text-base text-white">M</span>
          </div>
          <span className="font-display italic text-lg text-[var(--text)]">Memoir</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-[2px]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id || (item.id === 'home' && activePage === 'profile');
          return (
            <Link
              key={item.id}
              to={item.path}
              className={`flex items-center gap-[10px] px-[14px] py-[10px] rounded-[var(--radius-sm)] text-sm font-medium transition-all no-underline ${
                isActive
                  ? 'bg-[var(--accent-light)] text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--accent-lighter)] hover:text-[var(--text)]'
              }`}
            >
              <Icon size={18} className="flex-shrink-0 opacity-70" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Members + Logout */}
      <div className="px-5 py-4 border-t border-[var(--border)]">
        {members.length > 0 && (
          <>
            <div className="flex items-center gap-[6px] mb-2">
              {visibleMembers.map((member) => (
                <Avatar key={member.id} name={member.name} size={28} />
              ))}
              {remainingCount > 0 && (
                <div className="w-7 h-7 rounded-full bg-[var(--bg)] flex items-center justify-center text-[10px] text-[var(--text-muted)] border-2 border-[var(--surface)]">
                  +{remainingCount}
                </div>
              )}
            </div>
            <p className="text-[11px] uppercase tracking-[0.5px] font-medium text-[var(--text-muted)] mb-3">
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </p>
          </>
        )}
        <Link
          to="/settings"
          className="flex items-center gap-[10px] w-full px-[14px] py-[10px] rounded-[var(--radius-sm)] text-sm text-[var(--text-secondary)] hover:bg-[var(--accent-lighter)] hover:text-[var(--text)] transition-all no-underline mb-1"
        >
          <Settings size={18} className="flex-shrink-0 opacity-70" />
          <span>Settings</span>
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-[10px] w-full px-[14px] py-[10px] rounded-[var(--radius-sm)] text-sm text-[var(--text-secondary)] hover:bg-[var(--accent-lighter)] hover:text-[var(--text)] transition-all no-underline"
        >
          <LogOut size={18} className="flex-shrink-0 opacity-70" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
