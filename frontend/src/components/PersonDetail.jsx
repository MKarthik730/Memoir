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
      <div className="min-h-screen bg-parchment flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-sepia border-t-gold rounded-full animate-spin" />
      </div>
    )
  }

  if (!person) {
    return (
      <div className="min-h-screen bg-parchment flex items-center justify-center">
        <p>Person not found</p>
      </div>
    )
  }

  const colors = getCategoryColor(person.category)
  const personName = person.person_name || 'Unknown'

  return (
    <div className="min-h-screen bg-parchment">
      <nav className="sticky top-0 z-[100] border-b border-sepia bg-[rgba(247,241,232,0.92)] backdrop-blur-12">
        <div className="max-w-[1200px] mx-auto px-8 py-4 flex items-center gap-4">
          <button 
            onClick={onBack} 
            className="w-9 h-9 flex items-center justify-center bg-transparent border border-sepia rounded-sm text-ink-muted cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="font-display italic text-xl text-ink flex-1">
            {personName}
          </span>
          <button 
            onClick={downloadPdf} 
            className="flex items-center gap-1.5 px-5 py-2.5 bg-ink text-parchment border-none rounded-sm font-ui text-xs tracking-widest uppercase cursor-pointer"
          >
            <Download size={14} />
            PDF
          </button>
        </div>
      </nav>

      <main className="max-w-[1200px] mx-auto px-8 py-16">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="mb-16"
        >
          <div className="flex items-center gap-8 mb-8">
            <div className="w-20 h-20 rounded-full overflow-hidden flex-shrink-0 border-2 border-sepia bg-sepia flex items-center justify-center">
              <span className="text-3xl font-display text-parchment">
                {personName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="font-display italic text-[2.8rem] mb-1 text-ink">
                {personName}
              </h1>
              <div 
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-[0.65rem] font-ui tracking-widest uppercase"
                style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}
              >
                {person.category}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => setShowAddMemory(true)} 
              className="flex items-center gap-1.5 px-5 py-3 bg-ink text-parchment border-none rounded-sm font-ui text-xs tracking-widest uppercase cursor-pointer"
            >
              <Plus size={14} />
              Add Memory
            </button>
            <label className="flex items-center gap-1.5 px-5 py-3 bg-cream text-ink border border-sepia rounded-sm font-ui text-xs tracking-widest uppercase cursor-pointer">
              <Image size={14} />
              Add Photo
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={(e) => {
                  if (e.target.files[0]) handlePhotoUpload(e.target.files[0])
                }} 
              />
            </label>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.1 }}
          className="flex gap-8 mb-16"
        >
          {[{ icon: BookOpen, label: 'Memories', count: memories.length }, 
            { icon: Image, label: 'Photos', count: files.filter(f => f.file_type?.startsWith('image/')).length }].map(stat => (
            <div 
              key={stat.label} 
              className="px-8 py-4 bg-cream border border-sepia rounded-sm text-center"
            >
              <div className="text-2xl font-display text-gold">{stat.count}</div>
              <div className="text-xs font-ui tracking-widest uppercase text-ink-muted">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.2 }}
        >
          <h2 className="font-display italic text-xl mb-8 text-ink">
            Memories
          </h2>
          
          {memories.length === 0 ? (
            <div className="text-center py-16 bg-cream border border-sepia rounded-md">
              <BookOpen size={48} className="text-sepia mx-auto mb-4" />
              <p className="text-ink-muted">No memories yet. Add your first one!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {memories.map(memory => (
                <div 
                  key={memory.id} 
                  className="p-8 bg-cream border border-sepia rounded-sm"
                >
                  <div className="flex items-center gap-1.5 mb-2 text-ink-muted text-xs font-mono">
                    <Clock size={12} />
                    {new Date(memory.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <p className="text-base leading-relaxed text-ink">
                    {memory.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {files.filter(f => f.file_type?.startsWith('image/')).length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.3 }} 
            className="mt-16"
          >
            <h2 className="font-display italic text-xl mb-8 text-ink">
              Photos
            </h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
              {files.filter(f => f.file_type?.startsWith('image/')).map(file => (
                <img 
                  key={file.id} 
                  src={`/home/person/${personId}/files/${file.id}/download`} 
                  alt={file.file_name}
                  className="w-full aspect-square object-cover rounded-sm border border-sepia" 
                />
              ))}
            </div>
          </motion.div>
        )}
      </main>

      {showAddMemory && (
        <div 
          onClick={() => setShowAddMemory(false)} 
          className="fixed inset-0 bg-[rgba(28,23,16,0.5)] backdrop-blur-sm flex items-center justify-center z-[1000] p-4"
        >
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            onClick={e => e.stopPropagation()} 
            className="w-full max-w-[500px] bg-cream border border-sepia rounded-md overflow-hidden"
          >
            <div className="flex items-center justify-between p-8 border-b border-sepia">
              <h2 className="font-display italic text-xl">Add Memory</h2>
              <button 
                onClick={() => setShowAddMemory(false)} 
                className="bg-transparent border-none cursor-pointer text-ink-muted"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-8">
              <textarea 
                value={memoryContent} 
                onChange={e => setMemoryContent(e.target.value)} 
                rows={5}
                placeholder="Write your memory..." 
                className="w-full p-3 bg-transparent border-b border-sepia text-ink font-body text-base outline-none resize-none focus:border-gold transition-colors duration-150" 
              />
              <button 
                onClick={handleAddMemory} 
                className="w-full mt-8 px-4 py-3.5 bg-ink text-parchment border-none rounded-sm font-ui text-xs tracking-widest uppercase cursor-pointer"
              >
                Save Memory
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
