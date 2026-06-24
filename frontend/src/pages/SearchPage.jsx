import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { searchAPI } from '../lib/api';
import MemoryCard from '../components/MemoryCard';
import { Search, ArrowLeft } from 'lucide-react';

export default function SearchPage() {
  const { family_id } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

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
    <div className="min-h-screen bg-[var(--page)]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[var(--vellum)] border-b border-[var(--border)]">
        <div className="px-4 py-4 max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center rounded-[6px] text-[var(--ink-light)] hover:bg-[rgba(168,85,66,0.05)] transition-colors">
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-[17px] font-medium text-[var(--ink)]">Search the Archive</h1>
          </div>

          <form onSubmit={handleSearch} className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search letters, names, dates..."
              className="w-full h-[44px] rounded-full pl-11 pr-[88px] bg-[var(--vellum)] border border-[var(--border)] focus:border-[var(--seal)] text-[var(--ink)] text-sm outline-none transition-all"
            />
            <button type="submit" disabled={loading || !query.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-full bg-[var(--seal)] text-[var(--page)] text-[12px] font-medium hover:bg-[var(--seal-hover)] disabled:opacity-40 transition-all">
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {loading && (
          <div className="text-center py-12 animate-fade-in">
            <div className="thread-line w-32 mx-auto mb-4" />
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
          <div className="text-center py-20 animate-fade-in-up">
            <Search size={40} className="mx-auto mb-4 text-[var(--ink-muted)] opacity-30" />
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

            <div className="space-y-4">
              {results.map((result, index) => (
                <div key={result.memory?.id || index} className="bg-[var(--vellum)] border border-[var(--border)] rounded-[10px] p-4 animate-fade-in-up" style={{ animationDelay: `${index * 0.05}s` }}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <Link to={`/people/${result.memory?.person_id || '#'}`}
                        className="text-[13px] text-[var(--seal)] hover:underline font-medium">
                        {result.person_name}
                      </Link>
                    </div>
                    {result.memory?.memory_date && (
                      <div className="font-mono text-[11px] text-[var(--postmark)] border border-[var(--postmark)] rounded-[2px] px-2 py-[2px] bg-[rgba(74,107,138,0.04)]">
                        <span>
                          {new Date(result.memory.memory_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                  </div>

                  {result.memory && (
                    <MemoryCard memory={result.memory} personName={result.person_name} compact />
                  )}

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
            <div className="w-16 h-16 mx-auto mb-5 rounded-full border-[1.5px] border-dashed border-[var(--border)] flex items-center justify-center">
              <Search size={28} className="text-[var(--ink-muted)] opacity-40" />
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
  );
}
