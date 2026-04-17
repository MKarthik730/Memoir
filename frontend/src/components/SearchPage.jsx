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
    <div className="min-h-screen bg-parchment">
      <nav className="sticky top-0 z-[100] border-b border-sepia bg-[rgba(247,241,232,0.92)] backdrop-blur-12">
        <div className="max-w-[800px] mx-auto px-8 py-4 flex items-center gap-4">
          <button 
            onClick={onBack} 
            className="w-9 h-9 flex items-center justify-center bg-transparent border border-sepia rounded-sm text-ink-muted cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="font-display italic text-xl text-ink flex-1">
            Search Memories
          </span>
        </div>
      </nav>

      <main className="max-w-[800px] mx-auto px-8 py-16">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="mb-16"
        >
          <div className="flex gap-2 p-2 bg-cream border border-sepia rounded-md">
            <Search size={20} className="my-auto pl-3 text-ink-muted" />
            <input 
              type="text" 
              value={query} 
              onChange={e => setQuery(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Ask about your memories..." 
              className="flex-1 px-3 py-3 bg-transparent border-none text-ink font-body text-base outline-none" 
            />
            <button 
              onClick={handleSearch} 
              disabled={loading} 
              className="px-6 py-3 bg-ink text-parchment border-none rounded-sm font-ui text-xs tracking-widest uppercase cursor-pointer"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-muted text-center">
            Example: "What did I do last summer?" or "Tell me about my trips with family"
          </p>
        </motion.div>

        {loading && (
          <div className="text-center py-16">
            <Sparkles size={32} className="text-gold mx-auto animate-spin" />
            <p className="mt-4 text-ink-muted">Searching your memories...</p>
          </div>
        )}

        {results && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {results.answer && !results.answer.includes('No memories') ? (
              <>
                <div className="p-8 bg-cream border border-sepia rounded-md mb-8">
                  <h3 className="flex items-center gap-2 mb-4 text-lg">
                    <Sparkles size={18} className="text-gold" />
                    Answer
                  </h3>
                  <p className="leading-relaxed text-ink">{results.answer}</p>
                </div>

                {results.sources?.length > 0 && (
                  <>
                    <h3 className="text-lg mb-4 text-ink">
                      Sources
                    </h3>
                    <div className="flex flex-col gap-2">
                      {results.sources.map((source, i) => (
                        <div 
                          key={i} 
                          className="p-4 bg-cream border border-sepia rounded-sm"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {source.type === 'memory' ? <BookOpen size={14} /> : <Image size={14} />}
                            <span className="font-semibold">{source.person_name}</span>
                            <span className="text-ink-muted text-xs">
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
              <div className="text-center py-16 bg-cream border border-sepia rounded-md">
                <Search size={48} className="text-sepia mx-auto mb-4" />
                <h3 className="mb-2 text-ink">No results found</h3>
                <p className="text-ink-muted">Add more memories and photos to get better search results</p>
              </div>
            )}
          </motion.div>
        )}

        {!results && !loading && (
          <div className="text-center py-16">
            <Search size={64} className="text-sepia mx-auto mb-8" />
            <h2 className="font-display italic text-2xl mb-2 text-ink">
              Ask about your memories
            </h2>
            <p className="text-ink-muted">
              Use AI to search through your saved memories and photos
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
