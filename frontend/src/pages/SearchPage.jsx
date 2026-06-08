import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { searchAPI } from '../lib/api';
import Sidebar from '../components/Sidebar';
import BottomTabBar from '../components/BottomTabBar';
import MemoryCard from '../components/MemoryCard';
import { Search, Loader2, ArrowLeft } from 'lucide-react';

export default function SearchPage() {
  const { family_id } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [family, setFamily] = useState(null);

  useEffect(() => {
    fetch(`/family/${family_id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('memoir_token')}` },
    })
      .then(r => r.json())
      .then(data => setFamily(data))
      .catch(() => {});
  }, [family_id]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setSearched(true);
    try {
      const data = await searchAPI.search(family_id, query);
      setResults(data || []);
    } catch (err) {
      setError('Search unavailable. Try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col md:flex-row">
      <Sidebar family={family} familyId={family_id} activePage="search" />
      
      <div className="flex-1 pb-20 md:pb-0">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-[rgba(250,247,242,0.95)] backdrop-blur-sm border-b border-[rgba(184,151,90,0.15)] px-6 py-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => navigate(`/family/${family_id}`)} className="p-2 text-[#8B7355] hover:text-[#2C1810]">
                <ArrowLeft size={20} />
              </button>
              <h1 className="font-display text-xl text-[#4A1C0A]">Search Memories</h1>
            </div>
            
            <form onSubmit={handleSearch}>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8B7355]" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search your family's memories..."
                    className="w-full pl-12 pr-4 py-3 rounded-xl bg-[#F5F0E8] border border-[rgba(184,151,90,0.3)] focus:border-[#B8975A] text-[#2C1810] font-display text-lg outline-none transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="px-6 py-3 bg-[#C4857A] text-white rounded-xl font-ui text-sm hover:brightness-110 transition-all disabled:opacity-60"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : 'Search'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Results */}
        <div className="max-w-3xl mx-auto p-6">
          {loading && (
            <div className="text-center py-12">
              <Loader2 size={24} className="animate-spin text-[#B8975A] mx-auto mb-3" />
              <p className="font-body italic text-[#8B7355] animate-pulse-slow">Searching through your memories...</p>
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-12">
              <p className="text-[#C45A5A] mb-2">{error}</p>
              <button onClick={handleSearch} className="text-[#B8975A] hover:underline">Retry</button>
            </div>
          )}

          {searched && !loading && !error && results.length === 0 && (
            <div className="text-center py-12">
              <Search size={48} className="mx-auto mb-4 text-[#B8975A]" />
              <h3 className="font-display text-xl text-[#2C1810] mb-2">
                No memories found for '{query}'
              </h3>
              <p className="text-[#8B7355]">Try different words.</p>
            </div>
          )}

          {results.length > 0 && !loading && (
            <div className="space-y-4">
              <p className="text-sm text-[#8B7355] mb-4 font-body italic">
                Found {results.length} {results.length === 1 ? 'memory' : 'memories'}
              </p>
              {results.map((result, index) => (
                <div key={result.memory?.id || index}>
                  <Link
                    to={`/people/${result.memory?.person_id || '#'}`}
                    className="text-sm font-ui text-[#B8975A] hover:underline mb-1 inline-block"
                  >
                    {result.person_name}
                  </Link>
                  <MemoryCard memory={result.memory} personName={result.person_name} compact />
                </div>
              ))}
            </div>
          )}

          {!searched && !loading && (
            <div className="text-center py-16">
              <Search size={64} className="mx-auto mb-6 text-[#B8975A] opacity-50" />
              <h2 className="font-display text-2xl text-[#2C1810] mb-2">Search Your Memories</h2>
              <p className="text-[#8B7355]">Find stories, moments, and memories from your family</p>
            </div>
          )}
        </div>
      </div>

      <BottomTabBar familyId={family_id} activeTab="search" />
    </div>
  );
}
