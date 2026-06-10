import { Link, useNavigate } from 'react-router-dom';
import { Home, GitBranch, Search, LogOut } from 'lucide-react';

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

  return (
    <div className="hidden md:flex flex-col w-[220px] min-h-screen bg-[#F5F0E8] border-r border-[rgba(184,151,90,0.2)] flex-shrink-0">
      {/* Family Header */}
      <div className="p-5 border-b border-[rgba(184,151,90,0.15)]">
        {family?.cover_photo_url ? (
          <img src={family.cover_photo_url} alt="" className="w-full h-20 object-cover rounded-lg mb-3" />
        ) : (
          <div className="w-full h-20 bg-gradient-to-br from-[#B8975A] to-[#C4857A] rounded-lg mb-3 flex items-center justify-center">
            <span className="font-display italic text-2xl text-white">
              {family?.name?.charAt(0) || 'M'}
            </span>
          </div>
        )}
        <h2 className="font-display text-lg text-[#4A1C0A] truncate">{family?.name || 'Family'}</h2>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 p-3 space-y-1">
        <Link
          to={`/family/${familyId}`}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-ui transition-all ${
            activePage === 'home'
              ? 'bg-[#C4857A] text-white'
              : 'text-[#8B7355] hover:bg-[#EDE5D5] hover:text-[#4A1C0A]'
          }`}
        >
          <Home size={18} />
          <span>Home</span>
        </Link>
        <Link
          to={`/family/${familyId}/graph`}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-ui transition-all ${
            activePage === 'graph'
              ? 'bg-[#C4857A] text-white'
              : 'text-[#8B7355] hover:bg-[#EDE5D5] hover:text-[#4A1C0A]'
          }`}
        >
          <GitBranch size={18} />
          <span>Graph</span>
        </Link>
        <Link
          to={`/family/${familyId}/search`}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-ui transition-all ${
            activePage === 'search'
              ? 'bg-[#C4857A] text-white'
              : 'text-[#8B7355] hover:bg-[#EDE5D5] hover:text-[#4A1C0A]'
          }`}
        >
          <Search size={18} />
          <span>Search</span>
        </Link>
      </nav>

      {/* Members Section */}
      <div className="p-4 border-t border-[rgba(184,151,90,0.15)]">
        <p className="text-xs font-ui tracking-wider uppercase text-[#8B7355] mb-3">Members</p>
        <div className="flex flex-wrap gap-1.5">
          {visibleMembers.map((member) => (
            <div
              key={member.id}
              className="w-8 h-8 rounded-full bg-[#B8975A] flex items-center justify-center text-xs font-ui text-white"
              title={member.name}
            >
              {member.name?.charAt(0).toUpperCase()}
            </div>
          ))}
          {remainingCount > 0 && (
            <div className="w-8 h-8 rounded-full bg-[#EDE5D5] flex items-center justify-center text-xs font-ui text-[#8B7355]">
              +{remainingCount}
            </div>
          )}
        </div>
      </div>

      {/* Logout */}
      <div className="p-3">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-ui text-[#8B7355] hover:bg-[#EDE5D5] hover:text-[#4A1C0A] transition-all w-full"
        >
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
