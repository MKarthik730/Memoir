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

function PersonCard({ person, onClick, index }) {
  const categoryColors = {
    family: { bg: 'rgba(201, 132, 122, 0.15)', border: 'rgba(201, 132, 122, 0.4)', text: '#8B5A4A' },
    friends: { bg: 'rgba(184, 150, 62, 0.12)', border: 'rgba(184, 150, 62, 0.35)', text: '#7A6530' },
    colleagues: { bg: 'rgba(122, 158, 142, 0.12)', border: 'rgba(122, 158, 142, 0.35)', text: '#4A6B5C' }
  }
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
      style={{
        position: 'relative',
        backgroundColor: 'var(--color-cream)',
        border: '1px solid var(--color-sepia)',
        borderRadius: 'var(--radius-sm)',
        boxShadow: '0 2px 0 var(--color-sepia), 0 8px 32px rgba(28,23,16,0.10)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform var(--duration-base) var(--ease-out), box-shadow var(--duration-base) var(--ease-out)'
      }}
      whileHover={{ y: -4, boxShadow: '0 12px 48px rgba(28,23,16,0.16), 0 2px 8px rgba(28,23,16,0.08)' }}
    >
      {/* Gold top line */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: '1px',
        background: 'linear-gradient(90deg, transparent, var(--color-gold), transparent)',
        opacity: 0.5
      }} />

      <div style={{ padding: 'var(--space-lg)' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-md)'
        }}>
          {/* Avatar */}
          <div style={{
            position: 'relative',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
            border: '2px solid var(--color-sepia)',
            backgroundColor: 'var(--color-sepia)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ fontSize: '24px', fontFamily: 'var(--font-display)', color: 'var(--color-parchment)' }}>
              {personName.charAt(0).toUpperCase()}
            </span>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{
              fontSize: 'var(--text-lg)',
              fontFamily: 'var(--font-display)',
              marginBottom: '4px',
              color: 'var(--color-ink)'
            }}>
              {personName}
            </h3>
            
            {/* Category Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              backgroundColor: colors.bg,
              border: `1px solid ${colors.border}`,
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.65rem',
              fontFamily: 'var(--font-ui)',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: colors.text
            }}>
              {person.category?.toLowerCase() === 'family' && <Home size={10} />}
              {person.category?.toLowerCase() === 'friends' && <Heart size={10} />}
              {person.category?.toLowerCase() === 'colleagues' && <Briefcase size={10} />}
              {person.category || 'Other'}
            </div>
          </div>
        </div>

        {/* Bio */}
        {personBio && (
          <p style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--color-ink-soft)',
            marginBottom: 'var(--space-md)',
            lineHeight: 1.6,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {personBio}
          </p>
        )}

        {/* Empty state message */}
        {!personBio && (
          <p style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--color-ink-muted)',
            fontStyle: 'italic',
            marginBottom: 'var(--space-md)'
          }}>
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
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(28, 23, 16, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 'var(--space-md)'
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, rotateY: -5 }}
          animate={{ opacity: 1, y: 0, rotateY: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: '480px',
            backgroundColor: 'var(--color-cream)',
            border: '1px solid var(--color-sepia)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-lg)',
            borderBottom: '1px solid var(--color-sepia)'
          }}>
            <h2 style={{ fontSize: 'var(--text-xl)' }}>Add Someone New</h2>
            <button
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                color: 'var(--color-ink-muted)',
                cursor: 'pointer',
                borderRadius: 'var(--radius-sm)',
                transition: 'color var(--duration-fast)'
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: 'var(--space-lg)' }}>
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <label style={{
                display: 'block',
                marginBottom: 'var(--space-xs)',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-ui)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-soft)'
              }}>
                Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter their name"
                style={{
                  width: '100%',
                  padding: '12px 0',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--color-sepia)',
                  borderRadius: 0,
                  color: 'var(--color-ink)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-base)',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: 'var(--space-md)' }}>
              <label style={{
                display: 'block',
                marginBottom: 'var(--space-xs)',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-ui)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-soft)'
              }}>
                Relationship
              </label>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                {CATEGORIES.slice(1).map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setForm({ ...form, category: cat.id })}
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: `1px solid ${form.category === cat.id ? 'var(--color-gold)' : 'var(--color-sepia)'}`,
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: form.category === cat.id ? 'rgba(184, 150, 62, 0.1)' : 'transparent',
                      color: form.category === cat.id ? 'var(--color-gold)' : 'var(--color-ink-muted)',
                      fontFamily: 'var(--font-ui)',
                      fontSize: 'var(--text-xs)',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      transition: 'all var(--duration-fast)'
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 'var(--space-lg)' }}>
              <label style={{
                display: 'block',
                marginBottom: 'var(--space-xs)',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-ui)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-soft)'
              }}>
                Short Bio
              </label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="How do you know them?"
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px 0',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--color-sepia)',
                  borderRadius: 0,
                  color: 'var(--color-ink)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-base)',
                  outline: 'none',
                  resize: 'none',
                  lineHeight: 1.6
                }}
              />
            </div>

            <button
              onClick={handleAdd}
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: 'var(--color-ink)',
                color: 'var(--color-parchment)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-ui)',
                fontSize: 'var(--text-xs)',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                cursor: loading ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background-color var(--duration-fast)',
                opacity: loading ? 0.7 : 1
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = 'var(--color-gold)' }}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-ink)'}
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
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-parchment)' }}>
      {/* Top Navigation */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        borderBottom: '1px solid var(--color-sepia)',
        backgroundColor: 'rgba(247, 241, 232, 0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: 'var(--space-md) var(--space-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-lg)'
        }}>
          {/* Logo */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              backgroundColor: 'var(--color-ink)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '18px',
                fontStyle: 'italic',
                color: 'var(--color-parchment)'
              }}>
                M
              </span>
            </div>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-xl)',
              fontStyle: 'italic',
              color: 'var(--color-ink)'
            }}>
              Memoir
            </span>
          </div>

          {/* Search */}
          <div style={{
            flex: 1,
            maxWidth: '400px',
            position: 'relative'
          }}>
            <Search size={16} style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-ink-muted)'
            }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your circle..."
              style={{
                width: '100%',
                padding: '10px 12px 10px 40px',
                backgroundColor: 'var(--color-cream)',
                border: '1px solid var(--color-sepia)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-ink)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                outline: 'none',
                transition: 'border-color var(--duration-fast)'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--color-gold)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--color-sepia)'}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <button onClick={onSearchClick} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 16px', backgroundColor: 'var(--color-cream)', color: 'var(--color-ink)',
              border: '1px solid var(--color-sepia)', borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-ui)', fontSize: 'var(--text-xs)', letterSpacing: '0.1em', textTransform: 'uppercase',
              cursor: 'pointer'
            }}>
              <Search size={14} />
              Search
            </button>
            <button onClick={onGraphClick} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 16px', backgroundColor: 'var(--color-cream)', color: 'var(--color-ink)',
              border: '1px solid var(--color-sepia)', borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-ui)', fontSize: 'var(--text-xs)', letterSpacing: '0.1em', textTransform: 'uppercase',
              cursor: 'pointer'
            }}>
              <Sparkles size={14} />
              Graph
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 20px',
                backgroundColor: 'var(--color-ink)',
                color: 'var(--color-parchment)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-ui)',
                fontSize: 'var(--text-xs)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'background-color var(--duration-fast)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-gold)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-ink)'}
            >
              <Plus size={14} />
              <span>Add Person</span>
            </button>

            <button
              onClick={onLogout}
              style={{
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: '1px solid var(--color-sepia)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-ink-muted)',
                cursor: 'pointer',
                transition: 'all var(--duration-fast)'
              }}
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: 'var(--space-xl) var(--space-lg)'
      }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginBottom: 'var(--space-xl)' }}
        >
          <h1 style={{
            fontSize: 'var(--text-3xl)',
            fontStyle: 'italic',
            marginBottom: 'var(--space-sm)',
            color: 'var(--color-ink)'
          }}>
            Your Circle
          </h1>
          <p style={{
            fontSize: 'var(--text-base)',
            color: 'var(--color-ink-muted)'
          }}>
            {filteredPeople.length} {filteredPeople.length === 1 ? 'person' : 'people'} in your life
          </p>
        </motion.div>

        {/* Category Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{
            display: 'flex',
            gap: 'var(--space-sm)',
            marginBottom: 'var(--space-xl)',
            padding: '4px',
            backgroundColor: 'var(--color-cream)',
            borderRadius: 'var(--radius-md)',
            width: 'fit-content'
          }}
        >
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon
            const isActive = selectedCategory === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isActive ? 'var(--color-ink)' : 'transparent',
                  color: isActive ? 'var(--color-parchment)' : 'var(--color-ink-muted)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 'var(--text-xs)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all var(--duration-fast)'
                }}
              >
                <Icon size={14} />
                {cat.label}
              </button>
            )
          })}
        </motion.div>

        {/* Loading State */}
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              textAlign: 'center',
              padding: 'var(--space-2xl) var(--space-lg)'
            }}
          >
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto var(--space-lg)',
              backgroundColor: 'var(--color-cream)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sparkles size={32} style={{ color: 'var(--color-sepia)' }} />
            </div>
            <h3 style={{
              fontSize: 'var(--text-xl)',
              marginBottom: 'var(--space-sm)',
              color: 'var(--color-ink)'
            }}>
              Loading your circle...
            </h3>
          </motion.div>
        ) : filteredPeople.length > 0 ? (
          <div 
            className="stagger-children"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: 'var(--space-lg)'
            }}
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
            style={{
              textAlign: 'center',
              padding: 'var(--space-2xl) var(--space-lg)'
            }}
          >
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto var(--space-lg)',
              backgroundColor: 'var(--color-cream)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Users size={32} style={{ color: 'var(--color-sepia)' }} />
            </div>
            <h3 style={{
              fontSize: 'var(--text-xl)',
              marginBottom: 'var(--space-sm)',
              color: 'var(--color-ink)'
            }}>
              No one found
            </h3>
            <p style={{
              fontSize: 'var(--text-base)',
              color: 'var(--color-ink-muted)',
              marginBottom: 'var(--space-lg)'
            }}>
              {searchQuery 
                ? `No results for "${searchQuery}"`
                : 'Start building your circle by adding someone special'}
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '12px 24px',
                backgroundColor: 'var(--color-ink)',
                color: 'var(--color-parchment)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-ui)',
                fontSize: 'var(--text-xs)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: 'pointer'
              }}
            >
              <Plus size={14} />
              Add Your First Person
            </button>
          </motion.div>
        )}
      </main>

      {/* Add Person Modal */}
      <AddPersonModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)}
        onPersonAdded={fetchData}
        token={localStorage.getItem('memoir_token')}
      />
    </div>
  )
}
