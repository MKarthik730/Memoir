import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  ArrowLeft, Download, BookOpen, Image, Mic, Plus, 
  Clock, Heart, Home, Briefcase, Edit2, Sparkles, X
} from 'lucide-react'

export default function PersonDetail({ personId, onBack, token }) {
  const [person, setPerson] = useState(null)
  const [memories, setMemories] = useState([])
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddMemory, setShowAddMemory] = useState(false)
  const [showAddPhoto, setShowAddPhoto] = useState(false)
  const [memoryContent, setMemoryContent] = useState('')

  useEffect(() => {
    fetchPersonData()
  }, [personId])

  const fetchPersonData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` }
      
      const catsRes = await fetch('/home/categories', { headers })
      const cats = await catsRes.json()
      
      let personData = null
      let personCategory = ''
      
      for (const cat of cats) {
        const peopleRes = await fetch(`/home/category/${cat.id}/people`, { headers })
        const people = await peopleRes.json()
        const found = people.find(p => p.id === parseInt(personId))
        if (found) {
          personData = found
          personCategory = cat.cat_name
          break
        }
      }

      if (personData) {
        setPerson({ ...personData, category: personCategory })
        
        const memRes = await fetch(`/home/person/${personId}/memories`, { headers })
        setMemories(await memRes.json())
        
        const fileRes = await fetch(`/home/person/${personId}/files`, { headers })
        setFiles(await fileRes.json())
      }
    } catch (err) {
      console.error('Failed to fetch person:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddMemory = async () => {
    if (!memoryContent.trim()) return
    try {
      await fetch(`/home/person/${personId}/memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: memoryContent })
      })
      setMemoryContent('')
      setShowAddMemory(false)
      fetchPersonData()
    } catch (err) {
      console.error('Failed to add memory:', err)
    }
  }

  const handlePhotoUpload = async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    try {
      await fetch(`/home/person/${personId}/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      })
      setShowAddPhoto(false)
      fetchPersonData()
    } catch (err) {
      console.error('Failed to upload photo:', err)
    }
  }

  const downloadPdf = async () => {
    try {
      const res = await fetch(`/home/person/${personId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${person?.person_name || 'person'}_memoir.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF download failed:', err)
    }
  }

  const getCategoryColor = (cat) => {
    const colors = {
      family: { bg: 'rgba(201, 132, 122, 0.15)', border: 'rgba(201, 132, 122, 0.4)', text: '#8B5A4A' },
      friends: { bg: 'rgba(184, 150, 62, 0.12)', border: 'rgba(184, 150, 62, 0.35)', text: '#7A6530' },
      colleagues: { bg: 'rgba(122, 158, 142, 0.12)', border: 'rgba(122, 158, 142, 0.35)', text: '#4A6B5C' }
    }
    return colors[cat?.toLowerCase()] || colors.friends
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-parchment)' }}>
        <div style={{ width: '40px', height: '40px', border: '2px solid var(--color-sepia)', borderTopColor: 'var(--color-gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  if (!person) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-parchment)' }}>
        <p>Person not found</p>
      </div>
    )
  }

  const colors = getCategoryColor(person.category)
  const personName = person.person_name || 'Unknown'

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
          maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-md) var(--space-lg)',
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
            {personName}
          </span>
          <button onClick={downloadPdf} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '10px 20px', backgroundColor: 'var(--color-ink)', color: 'var(--color-parchment)',
            border: 'none', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-ui)',
            fontSize: 'var(--text-xs)', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer'
          }}>
            <Download size={14} />
            PDF
          </button>
        </div>
      </nav>

      {/* Content */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-xl) var(--space-lg)' }}>
        {/* Person Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 'var(--space-xl)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
              border: '2px solid var(--color-sepia)', backgroundColor: 'var(--color-sepia)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <span style={{ fontSize: '32px', fontFamily: 'var(--font-display)', color: 'var(--color-parchment)' }}>
                {personName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 style={{ fontSize: 'var(--text-3xl)', fontStyle: 'italic', marginBottom: 'var(--space-xs)', color: 'var(--color-ink)' }}>
                {personName}
              </h1>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '4px 12px', backgroundColor: colors.bg, border: `1px solid ${colors.border}`,
                borderRadius: 'var(--radius-sm)', fontSize: '0.65rem',
                fontFamily: 'var(--font-ui)', letterSpacing: '0.14em', textTransform: 'uppercase', color: colors.text
              }}>
                {person.category}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button onClick={() => setShowAddMemory(true)} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '12px 20px', backgroundColor: 'var(--color-ink)', color: 'var(--color-parchment)',
              border: 'none', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-ui)',
              fontSize: 'var(--text-xs)', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer'
            }}>
              <Plus size={14} />
              Add Memory
            </button>
            <label style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '12px 20px', backgroundColor: 'var(--color-cream)', color: 'var(--color-ink)',
              border: '1px solid var(--color-sepia)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-ui)',
              fontSize: 'var(--text-xs)', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer'
            }}>
              <Image size={14} />
              Add Photo
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                if (e.target.files[0]) handlePhotoUpload(e.target.files[0])
              }} />
            </label>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{ display: 'flex', gap: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
          {[{ icon: BookOpen, label: 'Memories', count: memories.length }, 
            { icon: Image, label: 'Photos', count: files.filter(f => f.file_type?.startsWith('image/')).length }].map(stat => (
            <div key={stat.label} style={{
              padding: 'var(--space-md) var(--space-lg)', backgroundColor: 'var(--color-cream)',
              border: '1px solid var(--color-sepia)', borderRadius: 'var(--radius-sm)', textAlign: 'center'
            }}>
              <div style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-display)', color: 'var(--color-gold)' }}>{stat.count}</div>
              <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-ui)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Memories */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h2 style={{ fontSize: 'var(--text-xl)', fontStyle: 'italic', marginBottom: 'var(--space-lg)', color: 'var(--color-ink)' }}>
            Memories
          </h2>
          
          {memories.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: 'var(--space-2xl)', backgroundColor: 'var(--color-cream)',
              border: '1px solid var(--color-sepia)', borderRadius: 'var(--radius-md)'
            }}>
              <BookOpen size={48} style={{ color: 'var(--color-sepia)', marginBottom: 'var(--space-md)' }} />
              <p style={{ color: 'var(--color-ink-muted)' }}>No memories yet. Add your first one!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {memories.map(memory => (
                <div key={memory.id} style={{
                  padding: 'var(--space-lg)', backgroundColor: 'var(--color-cream)',
                  border: '1px solid var(--color-sepia)', borderRadius: 'var(--radius-sm)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 'var(--space-sm)', color: 'var(--color-ink-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>
                    <Clock size={12} />
                    {new Date(memory.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <p style={{ fontSize: 'var(--text-base)', lineHeight: 1.7, color: 'var(--color-ink)' }}>
                    {memory.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Photos */}
        {files.filter(f => f.file_type?.startsWith('image/')).length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} style={{ marginTop: 'var(--space-xl)' }}>
            <h2 style={{ fontSize: 'var(--text-xl)', fontStyle: 'italic', marginBottom: 'var(--space-lg)', color: 'var(--color-ink)' }}>
              Photos
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
              {files.filter(f => f.file_type?.startsWith('image/')).map(file => (
                <img key={file.id} src={`/home/person/${personId}/files/${file.id}/download`} alt={file.file_name}
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-sepia)' }} />
              ))}
            </div>
          </motion.div>
        )}
      </main>

      {/* Add Memory Modal */}
      {showAddMemory && (
        <div onClick={() => setShowAddMemory(false)} style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 23, 16, 0.5)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 'var(--space-md)'
        }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: '500px', backgroundColor: 'var(--color-cream)',
            border: '1px solid var(--color-sepia)', borderRadius: 'var(--radius-md)', overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-lg)', borderBottom: '1px solid var(--color-sepia)' }}>
              <h2 style={{ fontSize: 'var(--text-xl)' }}>Add Memory</h2>
              <button onClick={() => setShowAddMemory(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-muted)' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: 'var(--space-lg)' }}>
              <textarea value={memoryContent} onChange={e => setMemoryContent(e.target.value)} rows={5}
                placeholder="Write your memory..." style={{
                  width: '100%', padding: '12px', backgroundColor: 'transparent', border: 'none',
                  borderBottom: '1px solid var(--color-sepia)', color: 'var(--color-ink)',
                  fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', outline: 'none', resize: 'none'
                }} />
              <button onClick={handleAddMemory} style={{
                width: '100%', marginTop: 'var(--space-lg)', padding: '14px',
                backgroundColor: 'var(--color-ink)', color: 'var(--color-parchment)', border: 'none',
                borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-ui)', fontSize: 'var(--text-xs)',
                letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer'
              }}>
                Save Memory
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
