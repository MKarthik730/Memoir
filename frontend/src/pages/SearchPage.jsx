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
    <div className="min-h-screen bg-[var(--page)] flex flex-col md:flex-row">
      <Sidebar family={family} familyId={family_id} activePage="search" />

      <div className="flex-1 min-w-0" style={{ paddingBottom: 80 }}>
        {/* Header */}
        <div className="sticky top-0 z-40 bg-[var(--page)]/95 backdrop-blur-sm border-b border-[var(--border)]">
          <div className="px-6 py-5 max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => navigate(`/family/${family_id}`)} className="btn-icon">
                <ArrowLeft size={18} />
              </button>
              <h1 className="font-display text-lg">Search the Archive</h1>
            </div>

            <form onSubmit={handleSearch}>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search letters, names, dates..."
                    className="w-full pl-11 pr-4 py-3 rounded-[var(--radius-sm)] bg-[var(--vellum)] border border-[var(--border)] focus:border-[var(--seal)] text-[var(--ink)] font-body text-sm outline-none transition-all"
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
              <div className="animate-thread-pull w-32 h-px mx-auto mb-4" />
              <p className="text-[var(--ink-muted)] text-sm font-mono text-xs tracking-wider">Searching the archive...</p>
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-12 animate-fade-in">
              <p className="text-[var(--danger)] mb-2 text-sm">{error}</p>
              <button onClick={handleSearch} className="text-[var(--seal)] hover:underline text-sm font-medium">Retry</button>
            </div>
          )}

          {searched && !loading && !error && results.length === 0 && (
            <div className="empty-journal animate-fade-in-up">
              <Search size={40} className="mx-auto mb-4 text-[var(--ink-muted)]" style={{ opacity: 0.3 }} />
              <div className="thread-divider max-w-[80px] mx-auto mb-6" />
              <h3 className="font-display text-xl mb-2">Nothing yet</h3>
              <p className="text-[var(--ink-light)] text-sm max-w-xs mx-auto leading-relaxed">
                No letters match that query. Try a different name, date, or memory.
              </p>
            </div>
          )}

          {results.length > 0 && !loading && (
            <div className="animate-fade-in-up">
              <div className="flex items-center gap-3 mb-6">
                <span className="font-mono text-[12px] text-[var(--ink-muted)] tracking-[0.02em]">
                  {results.length} {results.length === 1 ? 'letter found' : 'letters found'}
                </span>
                <span className="thread-line flex-1" />
              </div>

              <div className="space-y-6">
                {results.map((result, index) => (
                  <div key={result.memory?.id || index} className="card p-5 animate-fade-in-up" style={{ animationDelay: `${index * 0.05}s` }}>
                    {/* Letter excerpt header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <Link to={`/people/${result.memory?.person_id || '#'}`}
                          className="text-[13px] text-[var(--seal)] hover:underline font-medium">
                          {result.person_name}
                        </Link>
                      </div>
                      {result.memory?.memory_date && (
                        <div className="postmark flex-shrink-0">
                          <span>
                            {new Date(result.memory.memory_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      )}
                    </div>

                    {result.memory && (
                      <MemoryCard memory={result.memory} personName={result.person_name} compact />
                    )}

                    {/* Score indicator */}
                    {result.score !== undefined && (
                      <div className="mt-3 flex items-center gap-2">
                        <div className="flex-1 h-px bg-[var(--border-light)]" />
                        <span className="font-mono text-[10px] text-[var(--ink-muted)]">
                          relevance {Math.round(result.score * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!searched && !loading && (
            <div className="text-center py-20 animate-fade-in">
              <div className="w-16 h-16 mx-auto mb-5 rounded-full border-1.5 border-dashed border-[var(--border)] flex items-center justify-center">
                <Search size={28} className="text-[var(--ink-muted)]" style={{ opacity: 0.4 }} />
              </div>
              <div className="thread-divider max-w-[100px] mx-auto mb-6" />
              <h2 className="font-display text-xl mb-2">Search the Archive</h2>
              <p className="text-[var(--ink-light)] text-sm max-w-sm mx-auto">
                Find a letter, a name, a date — every memory is preserved here.
              </p>
            </div>
          )}
        </div>
      </div>

      <FloatingChatButton familyId={family_id} />
      <BottomTabBar familyId={family_id} activeTab="search" />
    </div>
  );
}
