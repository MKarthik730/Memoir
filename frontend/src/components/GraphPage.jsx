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

      nodes.forEach((node, i) => {
        const dx = node.targetX - node.x
        const dy = node.targetY - node.y
        node.vx += dx * 0.02
        node.vy += dy * 0.02

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

        node.vx *= 0.92
        node.vy *= 0.92

        node.x += node.vx
        node.y += node.vy
      })

      nodes.forEach(node => {
        const pulse = 1 + Math.sin(time * 2 + node.pulsePhase) * 0.05
        const isHovered = hoveredPerson === node.id
        const isSearched = searchQuery && node.name.toLowerCase().includes(searchQuery.toLowerCase())

        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius * 3 * pulse)
        gradient.addColorStop(0, isHovered ? node.glowColor.replace('0.3', '0.8') : node.glowColor)
        gradient.addColorStop(1, 'transparent')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius * 3 * pulse, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = node.color
        ctx.beginPath()
        ctx.arc(node.x, node.y, (isHovered ? node.radius * 1.3 : node.radius) * pulse, 0, Math.PI * 2)
        ctx.fill()

        ctx.strokeStyle = isHovered || isSearched ? 'white' : 'rgba(255,255,255,0.2)'
        ctx.lineWidth = isHovered ? 2 : 1
        ctx.stroke()

        ctx.fillStyle = isHovered ? 'white' : 'rgba(201, 208, 215, 0.8)'
        ctx.font = `${isHovered ? 'bold ' : ''}12px -apple-system, BlinkMacSystemFont, sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(node.name, node.x, node.y + node.radius + 18)
      })

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
      <div className="h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#30363d] border-t-[#58a6ff] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#8b949e]">Loading graph...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-[#0d1117] relative">
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center gap-4 bg-gradient-to-b from-[#0d1117] to-transparent">
        <button 
          onClick={onBack} 
          className="w-9 h-9 flex items-center justify-center bg-[rgba(139,148,158,0.1)] border border-[#30363d] rounded-md text-[#c9d1d9] cursor-pointer"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-base font-semibold text-[#c9d1d9] flex-1 font-sans">
          Graph View
        </h1>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search nodes..."
            className="pl-9 pr-3 py-2 bg-[rgba(139,148,158,0.1)] border border-[#30363d] rounded-md text-[#c9d1d9] font-sans text-sm outline-none w-[200px]"
          />
        </div>
      </div>

      <div className="absolute bottom-5 left-5 z-10 p-3 bg-[rgba(13,17,23,0.9)] border border-[#30363d] rounded-lg">
        <p className="text-[#8b949e] text-[11px] mb-2 font-sans uppercase tracking-wider">Categories</p>
        {categories.map(cat => {
          const color = getCategoryColor(cat.cat_name)
          return (
            <div key={cat.id} className="flex items-center gap-2 mb-1">
              <div 
                className="w-2.5 h-2.5 rounded-full" 
                style={{ backgroundColor: `hsl(${color.h}, ${color.s}%, ${color.l}%)` }} 
              />
              <span className="text-[#c9d1d9] text-xs font-sans">{cat.cat_name}</span>
            </div>
          )
        })}
      </div>

      <div className="absolute bottom-5 right-5 z-10 p-3 bg-[rgba(13,17,23,0.9)] border border-[#30363d] rounded-lg">
        <p className="text-[#8b949e] text-[11px] font-sans">
          <span className="text-[#c9d1d9] font-semibold">{people.length}</span> nodes
        </p>
      </div>

      {hoveredPerson && (
        <div className="absolute top-20 right-5 z-10 p-4 bg-[rgba(13,17,23,0.95)] border border-[#30363d] rounded-lg min-w-[200px]">
          {(() => {
            const person = people.find(p => p.id === hoveredPerson)
            if (!person) return null
            return (
              <>
                <h3 className="text-white text-sm mb-2 font-sans">
                  {person.person_name}
                </h3>
                <p className="text-[#8b949e] text-xs font-sans">
                  {person.category}
                </p>
              </>
            )
          })()}
        </div>
      )}

      {people.length === 0 ? (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <p className="text-[#8b949e] text-sm font-sans">
            No people to display. Add people from the dashboard!
          </p>
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          onClick={handleCanvasClick}
          className="cursor-pointer block"
        />
      )}
    </div>
  )
}
