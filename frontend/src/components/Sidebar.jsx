import { Link, useNavigate } from 'react-router-dom';
import { Search, Share2, Settings, MessageCircle, LogOut, Archive, BookOpen, Route, CalendarDays } from 'lucide-react';

export default function Sidebar({ familyId, activePage }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('memoir_token');
    localStorage.removeItem('memoir_user');
    navigate('/login');
  };

  const navItems = [
    { id: 'diary', label: 'My Diary', icon: BookOpen, path: '/my-diary' },
    { id: 'journal', label: 'People', icon: BookOpen, path: `/family/${familyId || ''}` },
    { id: 'trips', label: 'Trips', icon: Route, path: '/trips' },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays, path: '/calendar' },
    { id: 'vault', label: 'Vault', icon: Archive, path: '/vault' },
    { id: 'search', label: 'Search', icon: Search, path: `/family/${familyId}/search` },
    { id: 'graph', label: 'Tree', icon: Share2, path: `/family/${familyId}/graph` },
    { id: 'assistant', label: 'Assistant', icon: MessageCircle, path: `/family/${familyId}/assistant` },
  ];

  return (
    <aside className="hidden md:flex flex-col flex-shrink-0 bg-[var(--vellum)] border-r border-[var(--border)]" style={{ width: 240, minHeight: '100vh' }}>
      {/* Logo */}
      <div className="px-5 py-[20px] border-b border-[var(--border)]">
        <Link to="/" className="flex items-center gap-3 no-underline">
          <div className="wax-seal w-8 h-8">
            <span className="font-display italic text-sm">M</span>
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
              className={`relative flex items-center gap-3 pl-4 pr-4 py-[10px] rounded-[8px] text-sm transition-all no-underline ${
                isActive
                  ? 'bg-[rgba(63,93,70,0.1)] text-[var(--seal)] font-medium'
                  : 'text-[var(--ink-light)] hover:bg-[rgba(63,93,70,0.05)] hover:text-[var(--ink)]'
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-full bg-[var(--seal)]" />
              )}
              <Icon size={18} className="flex-shrink-0" />
              <span className="text-[14px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-[var(--border)]">
        <Link
          to="/settings"
          className="flex items-center gap-3 w-full px-4 py-[8px] rounded-[8px] text-[13px] text-[var(--ink-light)] hover:bg-[rgba(63,93,70,0.05)] hover:text-[var(--ink)] transition-all no-underline"
        >
          <Settings size={18} className="flex-shrink-0" />
          <span>Settings</span>
        </Link>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-[8px] rounded-[8px] text-[13px] text-[var(--ink-light)] hover:bg-[rgba(63,93,70,0.05)] hover:text-[var(--ink)] transition-all no-underline"
        >
          <LogOut size={18} className="flex-shrink-0" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
