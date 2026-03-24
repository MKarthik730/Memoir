import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Search } from 'lucide-react'

export default function GraphPage({ onBack, token }) {
  const [people, setPeople] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredPerson, setHoveredPerson] = useState(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const nodesRef = useRef([])
  const animationRef = useRef(null)

  useEffect(() => {
    fetchData()
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        })
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (people.length > 0) {
      initializeNodes()
      startAnimation()
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [people, dimensions])

  const fetchData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` }
      const catsRes = await fetch('/home/categories', { headers })
      const cats = await catsRes.json()
      setCategories(cats)
      
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

  const getCategoryColor = (cat) => {
    const colors = {
      family: { h: 15, s: 50, l: 60 },
      friends: { h: 45, s: 70, l: 50 },
      colleagues: { h: 200, s: 60, l: 55 }
    }
    return colors[cat?.toLowerCase()] || colors.friends
  }

  const initializeNodes = () => {
    const centerX = dimensions.width / 2
    const centerY = dimensions.height / 2
    const radius = Math.min(dimensions.width, dimensions.height) * 0.35

    nodesRef.current = people.map((person, index) => {
      const angle = (index / people.length) * 2 * Math.PI - Math.PI / 2
      const baseX = centerX + radius * Math.cos(angle)
      const baseY = centerY + radius * Math.sin(angle)
      const color = getCategoryColor(person.category)

      return {
        ...person,
        x: baseX,
        y: baseY,
        targetX: baseX,
        targetY: baseY,
        vx: 0,
        vy: 0,
        radius: 25,
        color: `hsl(${color.h}, ${color.s}%, ${color.l}%)`,
        glowColor: `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.3)`,
        pulsePhase: Math.random() * Math.PI * 2,
        name: person.person_name || 'Unknown'
      }
    })
  }

  const startAnimation = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const animate = () => {
      ctx.fillStyle = '#0d1117'
      ctx.fillRect(0, 0, dimensions.width, dimensions.height)

      const nodes = nodesRef.current
      const time = Date.now() * 0.001

      // Draw connections
      ctx.strokeStyle = 'rgba(139, 148, 158, 0.15)'
      ctx.lineWidth = 1
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x
          const dy = nodes[j].y - nodes[i].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 250) {
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.stroke()
          }
        }
      }

      // Physics simulation
      nodes.forEach((node, i) => {
        // Spring force toward target position
        const dx = node.targetX - node.x
        const dy = node.targetY - node.y
        node.vx += dx * 0.02
        node.vy += dy * 0.02

        // Repulsion from other nodes
        nodes.forEach((other, j) => {
          if (i === j) return
          const odx = node.x - other.x
          const ody = node.y - other.y
          const dist = Math.sqrt(odx * odx + ody * ody)
          if (dist < 100) {
            node.vx += odx / dist * 2
            node.vy += ody / dist * 2
          }
        })

        // Damping
        node.vx *= 0.92
        node.vy *= 0.92

        node.x += node.vx
        node.y += node.vy
      })

      // Draw nodes
      nodes.forEach(node => {
        const pulse = 1 + Math.sin(time * 2 + node.pulsePhase) * 0.05
        const isHovered = hoveredPerson === node.id
        const isSearched = searchQuery && node.name.toLowerCase().includes(searchQuery.toLowerCase())

        // Glow
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius * 3 * pulse)
        gradient.addColorStop(0, isHovered ? node.glowColor.replace('0.3', '0.8') : node.glowColor)
        gradient.addColorStop(1, 'transparent')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius * 3 * pulse, 0, Math.PI * 2)
        ctx.fill()

        // Node circle
        ctx.fillStyle = node.color
        ctx.beginPath()
        ctx.arc(node.x, node.y, (isHovered ? node.radius * 1.3 : node.radius) * pulse, 0, Math.PI * 2)
        ctx.fill()

        // Node border
        ctx.strokeStyle = isHovered || isSearched ? 'white' : 'rgba(255,255,255,0.2)'
        ctx.lineWidth = isHovered ? 2 : 1
        ctx.stroke()

        // Label
        ctx.fillStyle = isHovered ? 'white' : 'rgba(201, 208, 215, 0.8)'
        ctx.font = `${isHovered ? 'bold ' : ''}12px -apple-system, BlinkMacSystemFont, sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(node.name, node.x, node.y + node.radius + 18)
      })

      // Draw center
      ctx.fillStyle = 'rgba(139, 148, 158, 0.1)'
      ctx.beginPath()
      ctx.arc(dimensions.width / 2, dimensions.height / 2, 30, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('MEMOIR', dimensions.width / 2, dimensions.height / 2 + 4)

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()
  }

  const handleCanvasClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    nodesRef.current.forEach(node => {
      const dx = node.x - x
      const dy = node.y - y
      if (Math.sqrt(dx * dx + dy * dy) < node.radius + 10) {
        setHoveredPerson(hoveredPerson === node.id ? null : node.id)
      }
    })
  }

  if (loading) {
    return (
      <div style={{ 
        height: '100vh', backgroundColor: '#0d1117', display: 'flex', 
        alignItems: 'center', justifyContent: 'center', color: 'white' 
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '40px', height: '40px', border: '2px solid #30363d', 
            borderTopColor: '#58a6ff', borderRadius: '50%', 
            animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' 
          }} />
          <p style={{ color: '#8b949e' }}>Loading graph...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', backgroundColor: '#0d1117', position: 'relative' }}>
      {/* Header */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px',
        background: 'linear-gradient(to bottom, #0d1117, transparent)'
      }}>
        <button onClick={onBack} style={{
          width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(139, 148, 158, 0.1)', border: '1px solid #30363d', borderRadius: '6px',
          color: '#c9d1d9', cursor: 'pointer'
        }}>
          <ArrowLeft size={18} />
        </button>
        <h1 style={{ 
          fontSize: '16px', fontWeight: 600, color: '#c9d1d9', flex: 1,
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
        }}>
          Graph View
        </h1>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8b949e' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search nodes..."
            style={{
              padding: '8px 12px 8px 36px', backgroundColor: 'rgba(139, 148, 158, 0.1)',
              border: '1px solid #30363d', borderRadius: '6px', color: '#c9d1d9',
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontSize: '13px',
              outline: 'none', width: '200px'
            }}
          />
        </div>
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: '20px', left: '20px', zIndex: 10,
        padding: '12px 16px', backgroundColor: 'rgba(13, 17, 23, 0.9)',
        border: '1px solid #30363d', borderRadius: '8px'
      }}>
        <p style={{ color: '#8b949e', fontSize: '11px', marginBottom: '8px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Categories</p>
        {categories.map(cat => {
          const color = getCategoryColor(cat.cat_name)
          return (
            <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: `hsl(${color.h}, ${color.s}%, ${color.l}%)` }} />
              <span style={{ color: '#c9d1d9', fontSize: '12px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>{cat.cat_name}</span>
            </div>
          )
        })}
      </div>

      {/* Stats */}
      <div style={{
        position: 'absolute', bottom: '20px', right: '20px', zIndex: 10,
        padding: '12px 16px', backgroundColor: 'rgba(13, 17, 23, 0.9)',
        border: '1px solid #30363d', borderRadius: '8px'
      }}>
        <p style={{ color: '#8b949e', fontSize: '11px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
          <span style={{ color: '#c9d1d9', fontWeight: 600 }}>{people.length}</span> nodes
        </p>
      </div>

      {/* Hover Info */}
      {hoveredPerson && (
        <div style={{
          position: 'absolute', top: '80px', right: '20px', zIndex: 10,
          padding: '16px', backgroundColor: 'rgba(13, 17, 23, 0.95)',
          border: '1px solid #30363d', borderRadius: '8px', minWidth: '200px'
        }}>
          {(() => {
            const person = people.find(p => p.id === hoveredPerson)
            if (!person) return null
            return (
              <>
                <h3 style={{ color: 'white', fontSize: '14px', marginBottom: '8px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
                  {person.person_name}
                </h3>
                <p style={{ color: '#8b949e', fontSize: '12px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
                  {person.category}
                </p>
              </>
            )
          })()}
        </div>
      )}

      {/* Canvas */}
      {people.length === 0 ? (
        <div style={{ 
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          textAlign: 'center'
        }}>
          <p style={{ color: '#8b949e', fontSize: '14px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
            No people to display. Add people from the dashboard!
          </p>
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          onClick={handleCanvasClick}
          style={{ cursor: 'pointer', display: 'block' }}
        />
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
