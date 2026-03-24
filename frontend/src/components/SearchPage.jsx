import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, ArrowLeft, Sparkles, BookOpen, Image } from 'lucide-react'

export default function SearchPage({ onBack, token }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/home/rag/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ question: query, top_k: 5 })
      })
      const data = await res.json()
      setResults(data)
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-parchment)' }}>
      {/* Header */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        borderBottom: '1px solid var(--color-sepia)',
        backgroundColor: 'rgba(247, 241, 232, 0.92)',
        backdropFilter: 'blur(12px)'
      }}>
        <div style={{
          maxWidth: '800px', margin: '0 auto', padding: 'var(--space-md) var(--space-lg)',
          display: 'flex', alignItems: 'center', gap: 'var(--space-md)'
        }}>
          <button onClick={onBack} style={{
            width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: '1px solid var(--color-sepia)', borderRadius: 'var(--radius-sm)',
            color: 'var(--color-ink-muted)', cursor: 'pointer'
          }}>
            <ArrowLeft size={18} />
          </button>
          <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'var(--text-xl)', color: 'var(--color-ink)', flex: 1 }}>
            Search Memories
          </span>
        </div>
      </nav>

      {/* Content */}
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: 'var(--space-xl) var(--space-lg)' }}>
        {/* Search Box */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 'var(--space-xl)' }}>
          <div style={{
            display: 'flex', gap: 'var(--space-sm)', padding: '8px', backgroundColor: 'var(--color-cream)',
            border: '1px solid var(--color-sepia)', borderRadius: 'var(--radius-md)'
          }}>
            <Search size={20} style={{ margin: 'auto 0', paddingLeft: '12px', color: 'var(--color-ink-muted)' }} />
            <input type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Ask about your memories..." style={{
                flex: 1, padding: '12px', backgroundColor: 'transparent', border: 'none', color: 'var(--color-ink)',
                fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', outline: 'none'
              }} />
            <button onClick={handleSearch} disabled={loading} style={{
              padding: '12px 24px', backgroundColor: 'var(--color-ink)', color: 'var(--color-parchment)',
              border: 'none', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-ui)',
              fontSize: 'var(--text-xs)', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer'
            }}>
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
          <p style={{ marginTop: 'var(--space-sm)', fontSize: 'var(--text-xs)', color: 'var(--color-ink-muted)', textAlign: 'center' }}>
            Example: "What did I do last summer?" or "Tell me about my trips with family"
          </p>
        </motion.div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <Sparkles size={32} style={{ color: 'var(--color-gold)', animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: 'var(--space-md)', color: 'var(--color-ink-muted)' }}>Searching your memories...</p>
          </div>
        )}

        {/* Results */}
        {results && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {results.answer && !results.answer.includes('No memories') ? (
              <>
                <div style={{
                  padding: 'var(--space-lg)', backgroundColor: 'var(--color-cream)',
                  border: '1px solid var(--color-sepia)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-lg)'
                }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-md)', fontSize: 'var(--text-lg)' }}>
                    <Sparkles size={18} style={{ color: 'var(--color-gold)' }} />
                    Answer
                  </h3>
                  <p style={{ lineHeight: 1.8, color: 'var(--color-ink)' }}>{results.answer}</p>
                </div>

                {results.sources?.length > 0 && (
                  <>
                    <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-md)', color: 'var(--color-ink)' }}>
                      Sources
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                      {results.sources.map((source, i) => (
                        <div key={i} style={{
                          padding: 'var(--space-md)', backgroundColor: 'var(--color-cream)',
                          border: '1px solid var(--color-sepia)', borderRadius: 'var(--radius-sm)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            {source.type === 'memory' ? <BookOpen size={14} /> : <Image size={14} />}
                            <span style={{ fontWeight: 600 }}>{source.person_name}</span>
                            <span style={{ color: 'var(--color-ink-muted)', fontSize: 'var(--text-xs)' }}>
                              {source.category_name}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div style={{
                textAlign: 'center', padding: 'var(--space-2xl)', backgroundColor: 'var(--color-cream)',
                border: '1px solid var(--color-sepia)', borderRadius: 'var(--radius-md)'
              }}>
                <Search size={48} style={{ color: 'var(--color-sepia)', marginBottom: 'var(--space-md)' }} />
                <h3 style={{ marginBottom: 'var(--space-sm)', color: 'var(--color-ink)' }}>No results found</h3>
                <p style={{ color: 'var(--color-ink-muted)' }}>Add more memories and photos to get better search results</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Empty State */}
        {!results && !loading && (
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <Search size={64} style={{ color: 'var(--color-sepia)', marginBottom: 'var(--space-lg)' }} />
            <h2 style={{ fontSize: 'var(--text-2xl)', fontStyle: 'italic', marginBottom: 'var(--space-sm)', color: 'var(--color-ink)' }}>
              Ask about your memories
            </h2>
            <p style={{ color: 'var(--color-ink-muted)' }}>
              Use AI to search through your saved memories and photos
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
