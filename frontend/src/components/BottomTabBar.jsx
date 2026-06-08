import { Link } from 'react-router-dom';
import { Home, GitBranch, Search, Users } from 'lucide-react';

export default function BottomTabBar({ familyId, activeTab }) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#FAF7F2] border-t border-[rgba(184,151,90,0.2)] safe-area-bottom">
      <div className="flex items-center justify-around py-2 px-2">
        <Link
          to={`/family/${familyId}`}
          className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors ${
            activeTab === 'home' ? 'text-[#C4857A]' : 'text-[#8B7355]'
          }`}
        >
          <Home size={20} />
          <span className="text-[10px] font-ui">Home</span>
          {activeTab === 'home' && <div className="w-6 h-0.5 bg-[#C4857A] rounded-full mt-0.5" />}
        </Link>
        <Link
          to={`/family/${familyId}/graph`}
          className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors ${
            activeTab === 'graph' ? 'text-[#C4857A]' : 'text-[#8B7355]'
          }`}
        >
          <GitBranch size={20} />
          <span className="text-[10px] font-ui">Graph</span>
          {activeTab === 'graph' && <div className="w-6 h-0.5 bg-[#C4857A] rounded-full mt-0.5" />}
        </Link>
        <Link
          to={`/family/${familyId}/search`}
          className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors ${
            activeTab === 'search' ? 'text-[#C4857A]' : 'text-[#8B7355]'
          }`}
        >
          <Search size={20} />
          <span className="text-[10px] font-ui">Search</span>
          {activeTab === 'search' && <div className="w-6 h-0.5 bg-[#C4857A] rounded-full mt-0.5" />}
        </Link>
        <Link
          to={`/family/${familyId}`}
          className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors ${
            activeTab === 'members' ? 'text-[#C4857A]' : 'text-[#8B7355]'
          }`}
        >
          <Users size={20} />
          <span className="text-[10px] font-ui">Members</span>
          {activeTab === 'members' && <div className="w-6 h-0.5 bg-[#C4857A] rounded-full mt-0.5" />}
        </Link>
      </div>
    </div>
  );
}
