import { Link, useNavigate } from 'react-router-dom';
import { Search, GitBranch, Settings, MessageCircle, LogOut, Archive, PenLine, Users, Map, CalendarDays } from 'lucide-react';

export default function Sidebar({ familyId, activePage }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('memoir_token');
    localStorage.removeItem('memoir_user');
    navigate('/login');
  };

  const navItems = [
    { id: 'diary', label: 'My Diary', icon: PenLine, path: '/my-diary' },
    { id: 'journal', label: 'People', icon: Users, path: `/family/${familyId || ''}` },
    { id: 'trips', label: 'Trips', icon: Map, path: '/trips' },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays, path: '/calendar' },
    { id: 'vault', label: 'Vault', icon: Archive, path: '/vault' },
    { id: 'search', label: 'Search', icon: Search, path: `/family/${familyId}/search` },
    { id: 'graph', label: 'Tree', icon: GitBranch, path: `/family/${familyId}/graph` },
    { id: 'assistant', label: 'Assistant', icon: MessageCircle, path: `/family/${familyId}/assistant` },
  ];

  return (
    <aside className="hidden md:flex flex-col flex-shrink-0 bg-[var(--vellum)] border-r border-[var(--border)]" style={{ width: 240, minHeight: '100vh' }}>
      {/* Logo */}
      <div className="px-5 py-[20px] border-b border-[var(--border)]">
        <Link to="/" className="flex items-center gap-3 no-underline">
          <div className="w-9 h-9 rounded-xl bg-[var(--seal)] text-[var(--page)] shadow-[var(--shadow-sm)] flex items-center justify-center">
            <span className="font-display text-lg">M</span>
          </div>
          <span className="font-display italic text-[20px] text-[var(--ink)]">Memoir</span>
        </Link>
      </div>

      <div className="thread-line mx-5 my-3" />

      <nav className="sidebar-nav flex-1 px-3 py-2 space-y-[2px]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <Link
              key={item.id}
              to={item.path}
              className={`sidebar-link relative flex items-center gap-3 pl-4 pr-4 py-[10px] rounded-[8px] text-sm transition-all no-underline ${
                isActive
                  ? 'is-active bg-[rgba(47,93,70,0.1)] text-[var(--seal)] font-medium'
                  : 'text-[var(--ink-light)] hover:bg-[rgba(47,93,70,0.05)] hover:text-[var(--ink)]'
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-full bg-[var(--seal)]" />
              )}
              <Icon className="flex-shrink-0" />
              <span className="text-[14px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-actions px-5 py-4 border-t border-[var(--border)]">
        <Link
          to="/settings"
          className="flex items-center gap-3 w-full px-4 py-[8px] rounded-[8px] text-[13px] text-[var(--ink-light)] hover:bg-[rgba(47,93,70,0.05)] hover:text-[var(--ink)] transition-all no-underline"
        >
          <Settings className="flex-shrink-0" />
          <span>Settings</span>
        </Link>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-[8px] rounded-[8px] text-[13px] text-[var(--ink-light)] hover:bg-[rgba(47,93,70,0.05)] hover:text-[var(--ink)] transition-all no-underline"
        >
          <LogOut className="flex-shrink-0" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
