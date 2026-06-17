import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { searchAPI } from '../lib/api';
import Sidebar from '../components/Sidebar';
import BottomTabBar from '../components/BottomTabBar';
import FloatingChatButton from '../components/FloatingChatButton';
import MemoryCard from '../components/MemoryCard';
import { Search, ArrowLeft, Loader2 } from 'lucide-react';

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
    }).then(r => r.json()).then(data => setFamily(data)).catch(() => {});
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
    <div className="min-h-screen bg-[var(--bg)] flex flex-col md:flex-row">
      <Sidebar family={family} familyId={family_id} activePage="search" />

      <div className="flex-1 min-w-0" style={{ paddingBottom: 80 }}>
        {/* Header */}
        <div className="sticky top-0 z-40 bg-[var(--surface)]/95 backdrop-blur-sm border-b border-[var(--border)]">
          <div className="px-6 py-5 max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => navigate(`/family/${family_id}`)} className="btn-icon">
                <ArrowLeft size={18} />
              </button>
              <h1 className="font-display text-lg">Search Memories</h1>
            </div>

            <form onSubmit={handleSearch}>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search your family's memories..."
                    className="w-full pl-11 pr-4 py-3 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--accent)] text-[var(--text)] font-body text-sm outline-none transition-all"
                  />
                </div>
                <button type="submit" disabled={loading || !query.trim()}
                  className="btn btn-primary">
                  {loading ? (
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  ) : 'Search'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-3xl mx-auto px-6 py-8">
          {loading && (
            <div className="text-center py-12 animate-fade-in">
              <svg className="animate-spin mx-auto mb-3" width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="var(--border)" strokeWidth="3" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <p className="text-[var(--text-muted)] text-sm animate-pulse-slow">Searching through your memories...</p>
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-12 animate-fade-in">
              <p className="text-[var(--danger)] mb-2">{error}</p>
              <button onClick={handleSearch} className="text-[var(--accent)] hover:underline text-sm">Retry</button>
            </div>
          )}

          {searched && !loading && !error && results.length === 0 && (
            <div className="text-center py-16 animate-fade-in-up">
              <Search size={44} className="mx-auto mb-4 text-[var(--text-muted)]" style={{ opacity: 0.3 }} />
              <h3 className="font-display text-lg mb-2">No memories found</h3>
              <p className="text-[var(--text-secondary)] text-sm">Try different words or browse your family tree.</p>
            </div>
          )}

          {results.length > 0 && !loading && (
            <div className="animate-fade-in-up">
              <p className="text-sm text-[var(--text-muted)] mb-5 font-serif italic">
                Found {results.length} {results.length === 1 ? 'memory' : 'memories'}
              </p>
              <div className="space-y-5">
                {results.map((result, index) => (
                  <div key={result.memory?.id || index}>
                    <Link to={`/people/${result.memory?.person_id || '#'}`}
                      className="text-sm text-[var(--accent)] hover:underline font-medium mb-1 inline-block">
                      {result.person_name}
                    </Link>
                    <MemoryCard memory={result.memory} personName={result.person_name} compact />
                  </div>
                ))}
              </div>
            </div>
          )}

          {!searched && !loading && (
            <div className="text-center py-20 animate-fade-in">
              <Search size={56} className="mx-auto mb-6 text-[var(--text-muted)]" style={{ opacity: 0.25 }} />
              <h2 className="font-display text-xl mb-2">Search Your Memories</h2>
              <p className="text-[var(--text-secondary)]">Find stories, moments, and memories from your family</p>
            </div>
          )}
        </div>
      </div>

      <FloatingChatButton familyId={family_id} />
      <BottomTabBar familyId={family_id} activeTab="search" />
    </div>
  );
}
