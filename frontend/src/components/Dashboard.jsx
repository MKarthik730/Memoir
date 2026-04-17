import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, Plus, Users, Clock, Image, Mic, 
  X, ChevronRight, Filter, LogOut, BookOpen,
  Heart, Briefcase, Home, Sparkles
} from 'lucide-react'
import { cn, formatDate, getInitials, getJSON } from '../lib/utils'

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Users },
  { id: 'family', label: 'Family', icon: Home },
  { id: 'friends', label: 'Friends', icon: Heart },
  { id: 'colleagues', label: 'Colleagues', icon: Briefcase },
]

const categoryColors = {
  family: { bg: 'rgba(201, 132, 122, 0.15)', border: 'rgba(201, 132, 122, 0.4)', text: '#8B5A4A' },
  friends: { bg: 'rgba(184, 150, 62, 0.12)', border: 'rgba(184, 150, 62, 0.35)', text: '#7A6530' },
  colleagues: { bg: 'rgba(122, 158, 142, 0.12)', border: 'rgba(122, 158, 142, 0.35)', text: '#4A6B5C' }
}

function PersonCard({ person, onClick, index }) {
  const colors = categoryColors[person.category?.toLowerCase()] || categoryColors.friends
  const personName = person.person_name || person.name || 'Unknown'
  const personBio = person.bio || ''

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.6, 
        delay: index * 0.08,
        ease: [0.16, 1, 0.3, 1]
      }}
      onClick={onClick}
      whileHover={{ y: -4, boxShadow: '0 12px 48px rgba(28,23,16,0.16), 0 2px 8px rgba(28,23,16,0.08)' }}
      className="relative bg-cream border border-sepia rounded-sm shadow-card overflow-hidden cursor-pointer transition-all duration-300"
    >
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gold to-transparent opacity-50" />

      <div className="p-8">
        <div className="flex items-start gap-4 mb-4">
          <div className="relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0 border-2 border-sepia bg-sepia flex items-center justify-center">
            <span className="text-2xl font-display text-parchment">
              {personName.charAt(0).toUpperCase()}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-display mb-1 text-ink">
              {personName}
            </h3>
            
            <div 
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-[0.65rem] font-ui tracking-widest uppercase"
              style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}
            >
              {person.category?.toLowerCase() === 'family' && <Home size={10} />}
              {person.category?.toLowerCase() === 'friends' && <Heart size={10} />}
              {person.category?.toLowerCase() === 'colleagues' && <Briefcase size={10} />}
              {person.category || 'Other'}
            </div>
          </div>
        </div>

        {personBio ? (
          <p className="text-sm text-ink-soft mb-4 line-clamp-2 leading-relaxed">
            {personBio}
          </p>
        ) : (
          <p className="text-sm text-ink-muted italic mb-4">
            No description yet
          </p>
        )}
      </div>
    </motion.div>
  )
}

function AddPersonModal({ isOpen, onClose, onPersonAdded, token }) {
  const [form, setForm] = useState({ name: '', category: 'friends', bio: '' })
  const [loading, setLoading] = useState(false)
  const [hoverButton, setHoverButton] = useState(false)

  if (!isOpen) return null

  const handleAdd = async () => {
    if (!form.name.trim()) return
    setLoading(true)
    try {
      const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      
      const catsRes = await fetch('/home/categories', { headers })
      const cats = await catsRes.json()
      
      let categoryId = null
      const existingCat = cats.find(c => c.cat_name.toLowerCase() === form.category.toLowerCase())
      if (existingCat) {
        categoryId = existingCat.id
      } else {
        const newCatRes = await fetch('/home/category', {
          method: 'POST',
          headers,
          body: JSON.stringify({ cat_name: form.category })
        })
        const newCat = await newCatRes.json()
        categoryId = newCat.id
      }
      
      await fetch('/home/person', {
        method: 'POST',
        headers,
        body: JSON.stringify({ person_name: form.name, category_id: categoryId })
      })
      
      onPersonAdded()
      onClose()
    } catch (err) {
      console.error('Failed to add person:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-[rgba(28,23,16,0.5)] backdrop-blur-sm flex items-center justify-center z-[1000] p-4"
      >
        <motion.div
          initial={{ opacity: 0, y: 20, rotateY: -5 }}
          animate={{ opacity: 1, y: 0, rotateY: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[480px] bg-cream border border-sepia rounded-md shadow-lg overflow-hidden"
        >
          <div className="flex items-center justify-between p-8 border-b border-sepia">
            <h2 className="font-display italic text-xl">Add Someone New</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center bg-transparent border-none text-ink-muted cursor-pointer rounded-sm transition-colors duration-150 hover:text-ink"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-8">
            <div className="mb-4">
              <label className="block mb-1 text-xs font-ui tracking-widest uppercase text-ink-soft">
                Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter their name"
                className="w-full py-3 bg-transparent border-b border-sepia text-ink font-body text-base outline-none focus:border-gold transition-colors duration-150"
              />
            </div>

            <div className="mb-4">
              <label className="block mb-1 text-xs font-ui tracking-widest uppercase text-ink-soft">
                Relationship
              </label>
              <div className="flex gap-2">
                {CATEGORIES.slice(1).map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setForm({ ...form, category: cat.id })}
                    className={`flex-1 px-2 py-2.5 rounded-sm text-xs font-ui tracking-widest uppercase cursor-pointer transition-all duration-150 ${
                      form.category === cat.id 
                        ? 'border border-gold bg-[rgba(184,150,62,0.1)] text-gold' 
                        : 'border border-sepia text-ink-muted'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <label className="block mb-1 text-xs font-ui tracking-widest uppercase text-ink-soft">
                Short Bio
              </label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="How do you know them?"
                rows={3}
                className="w-full py-3 bg-transparent border-b border-sepia text-ink font-body text-base outline-none resize-none leading-relaxed focus:border-gold transition-colors duration-150"
              />
            </div>

            <button
              onClick={handleAdd}
              disabled={loading}
              onMouseEnter={() => setHoverButton(true)}
              onMouseLeave={() => setHoverButton(false)}
              className={`w-full px-4 py-3.5 ${hoverButton && !loading ? 'bg-gold' : 'bg-ink'} text-parchment border-none rounded-sm font-ui text-xs tracking-widest uppercase cursor-wait flex items-center justify-center gap-2 transition-all duration-150`}
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              <Plus size={16} />
              <span>{loading ? 'Adding...' : 'Add to Your Circle'}</span>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default function Dashboard({ onLogout, onPersonClick, onSearchClick, onGraphClick }) {
  const [people, setPeople] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchFocus, setSearchFocus] = useState(false)
  const [navHoverAdd, setNavHoverAdd] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('memoir_token')
      const headers = { 'Authorization': `Bearer ${token}` }
      
      const catsRes = await fetch('/home/categories', { headers })
      const cats = await catsRes.json()
      setCategories(Array.isArray(cats) ? cats : [])
      
      const allPeople = []
      for (const cat of cats) {
        const peopleRes = await fetch(`/home/category/${cat.id}/people`, { headers })
        const catPeople = await peopleRes.json()
        if (Array.isArray(catPeople)) {
          allPeople.push(...catPeople.map(p => ({ ...p, category: cat.cat_name })))
        }
      }
      setPeople(allPeople)
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredPeople = people.filter(person => {
    const matchesCategory = selectedCategory === 'all' || person.category?.toLowerCase() === selectedCategory
    const matchesSearch = person.person_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          person.bio?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const userName = localStorage.getItem('memoir_user') || 'Friend'

  return (
    <div className="min-h-screen bg-parchment">
      <nav className="sticky top-0 z-[100] border-b border-sepia bg-[rgba(247,241,232,0.92)] backdrop-blur-12">
        <div className="max-w-[1400px] mx-auto px-8 py-4 flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-ink rounded-sm flex items-center justify-center">
              <span className="font-display italic text-lg text-parchment">
                M
              </span>
            </div>
            <span className="font-display italic text-xl text-ink">
              Memoir
            </span>
          </div>

          <div className="flex-1 max-w-[400px] relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setSearchFocus(false)}
              placeholder="Search your circle..."
              className={`w-full pl-10 pr-3 py-2.5 bg-cream border ${searchFocus ? 'border-gold' : 'border-sepia'} rounded-sm text-ink font-body text-sm outline-none transition-colors duration-150`}
            />
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={onSearchClick} 
              className="flex items-center gap-1.5 px-4 py-2.5 bg-cream text-ink border border-sepia rounded-sm font-ui text-xs tracking-widest uppercase cursor-pointer"
            >
              <Search size={14} />
              Search
            </button>
            <button 
              onClick={onGraphClick} 
              className="flex items-center gap-1.5 px-4 py-2.5 bg-cream text-ink border border-sepia rounded-sm font-ui text-xs tracking-widest uppercase cursor-pointer"
            >
              <Sparkles size={14} />
              Graph
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              onMouseEnter={() => setNavHoverAdd(true)}
              onMouseLeave={() => setNavHoverAdd(false)}
              className={`flex items-center gap-1.5 px-5 py-2.5 ${navHoverAdd ? 'bg-gold' : 'bg-ink'} text-parchment border-none rounded-sm font-ui text-xs tracking-widest uppercase cursor-pointer transition-colors duration-150`}
            >
              <Plus size={14} />
              <span>Add Person</span>
            </button>

            <button
              onClick={onLogout}
              className="w-9 h-9 flex items-center justify-center bg-transparent border border-sepia rounded-sm text-ink-muted cursor-pointer transition-all duration-150 hover:text-ink"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-16"
        >
          <h1 className="font-display italic text-[2.8rem] mb-2 text-ink">
            Your Circle
          </h1>
          <p className="text-base text-ink-muted">
            {filteredPeople.length} {filteredPeople.length === 1 ? 'person' : 'people'} in your life
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="flex gap-2 mb-16 p-1 bg-cream rounded-md w-fit"
        >
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon
            const isActive = selectedCategory === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-5 py-2.5 border-none rounded-sm font-ui text-xs tracking-widest uppercase cursor-pointer transition-all duration-150 ${
                  isActive ? 'bg-ink text-parchment' : 'bg-transparent text-ink-muted'
                }`}
              >
                <Icon size={14} />
                {cat.label}
              </button>
            )
          })}
        </motion.div>

        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-24"
          >
            <div className="w-20 h-20 mx-auto mb-8 bg-cream rounded-full flex items-center justify-center">
              <Sparkles size={32} className="text-sepia" />
            </div>
            <h3 className="font-display italic text-xl mb-2 text-ink">
              Loading your circle...
            </h3>
          </motion.div>
        ) : filteredPeople.length > 0 ? (
          <div 
            className="stagger-children grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-8"
          >
            {filteredPeople.map((person, index) => (
              <PersonCard
                key={person.id}
                person={person}
                index={index}
                onClick={() => onPersonClick(person.id)}
              />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-24"
          >
            <div className="w-20 h-20 mx-auto mb-8 bg-cream rounded-full flex items-center justify-center">
              <Users size={32} className="text-sepia" />
            </div>
            <h3 className="font-display italic text-xl mb-2 text-ink">
              No one found
            </h3>
            <p className="text-base text-ink-muted mb-8">
              {searchQuery 
                ? `No results for "${searchQuery}"`
                : 'Start building your circle by adding someone special'}
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-6 py-3 bg-ink text-parchment border-none rounded-sm font-ui text-xs tracking-widest uppercase cursor-pointer"
            >
              <Plus size={14} />
              Add Your First Person
            </button>
          </motion.div>
        )}
      </main>

      <AddPersonModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)}
        onPersonAdded={fetchData}
        token={localStorage.getItem('memoir_token')}
      />
    </div>
  )
}
