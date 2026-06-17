import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import { peopleAPI, relationshipsAPI } from '../lib/api';
import Sidebar from '../components/Sidebar';
import BottomTabBar from '../components/BottomTabBar';
import FloatingChatButton from '../components/FloatingChatButton';
import { ZoomIn, ZoomOut, RotateCcw, Plus, X } from 'lucide-react';

const AVATAR_COLORS = ['#7C6A5E', '#8B7A6E', '#9B8B7E', '#6B9E8A', '#A68B7B', '#7E8B9B', '#8B7E6B', '#9E7E8B'];
function getColor(name) {
  return AVATAR_COLORS[name ? name.charCodeAt(0) % AVATAR_COLORS.length : 0];
}

export default function GraphPage() {
  const { family_id } = useParams();
  const navigate = useNavigate();
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [people, setPeople] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [family, setFamily] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [showAddRel, setShowAddRel] = useState(false);
  const [newRel, setNewRel] = useState({ person_a_id: '', person_b_id: '', label: '' });

  useEffect(() => { fetchData(); }, [family_id]);

  useEffect(() => {
    if (people.length > 0 && svgRef.current) { drawGraph(); }
  }, [people, relationships]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [familyData, peopleData, relsData] = await Promise.all([
        fetch(`/family/${family_id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('memoir_token')}` },
        }).then(r => r.json()),
        peopleAPI.list(family_id),
        relationshipsAPI.list(family_id),
      ]);
      setFamily(familyData);
      setPeople(peopleData);
      setRelationships(relsData);
    } catch (err) {
      console.error('Failed to fetch graph data:', err);
    } finally {
      setLoading(false);
    }
  };

  const drawGraph = () => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;

    svg.attr('width', width).attr('height', height);

    if (people.length === 0) {
      svg.append('text')
        .attr('x', width / 2).attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--text-muted)')
        .attr('font-family', "'Playfair Display', serif")
        .attr('font-size', '16px')
        .text('Add people and relationships to see your family tree');
      return;
    }

    const nodes = people.map(p => ({
      id: p.id, name: p.name, photo_url: p.photo_url,
      memory_count: p.memory_count || 0, relationship_tag: p.relationship_tag,
    }));

    const links = relationships.map(r => ({
      source: r.person_a.id, target: r.person_b.id, label: r.label,
    }));

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(150).strength(0.6))
      .force('charge', d3.forceManyBody().strength(-250))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(55));

    const g = svg.append('g');
    const zoom = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);

    // SVG arrow markers
    svg.append('defs').append('marker')
      .attr('id', 'graph-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 22).attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
      .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', '#d0c8c0').attr('opacity', 0.6);

    // Links
    const link = g.append('g').selectAll('line').data(links).join('line')
      .attr('stroke', '#d0c8c0').attr('stroke-opacity', 0.5).attr('stroke-width', 1.5);

    // Link labels
    const linkLabel = g.append('g').selectAll('text').data(links).join('text')
      .attr('fill', 'var(--text-muted)').attr('font-size', '10px')
      .attr('font-family', "'DM Sans', sans-serif").attr('text-anchor', 'middle').attr('dy', -8)
      .text(d => d.label || '');

    // Nodes
    const node = g.append('g').selectAll('g').data(nodes).join('g')
      .style('cursor', 'pointer')
      .on('click', (event, d) => navigate(`/people/${d.id}`))
      .on('mouseenter', (event, d) => {
        const rect = containerRef.current.getBoundingClientRect();
        setTooltip({ x: event.offsetX, y: event.offsetY, name: d.name, count: d.memory_count });
        d3.select(event.currentTarget).select('circle')
          .transition().duration(200).attr('stroke', 'var(--accent)').attr('stroke-width', 3);
      })
      .on('mouseleave', (event) => {
        setTooltip(null);
        d3.select(event.currentTarget).select('circle')
          .transition().duration(200).attr('stroke', 'rgba(255,255,255,0.4)').attr('stroke-width', 2);
      })
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        })
      );

    const nodeRadius = d => Math.max(22, Math.min(38, (d.memory_count || 0) * 4 + 22));

    // Node circles
    node.append('circle')
      .attr('r', nodeRadius)
      .attr('fill', d => getColor(d.name))
      .attr('stroke', 'rgba(255,255,255,0.4)').attr('stroke-width', 2);

    // Node initials
    node.append('text')
      .attr('text-anchor', 'middle').attr('dy', '0.35em')
      .attr('fill', 'white').attr('font-family', "'Playfair Display', serif")
      .attr('font-size', d => `${Math.max(12, nodeRadius(d) * 0.55)}px`)
      .text(d => d.name?.charAt(0).toUpperCase());

    // Node labels
    node.append('text')
      .attr('text-anchor', 'middle').attr('dy', d => nodeRadius(d) + 16)
      .attr('fill', 'var(--text)').attr('font-family', "'DM Sans', sans-serif")
      .attr('font-size', '11px').attr('font-weight', '500')
      .text(d => d.name);

    // Tick
    simulation.on('tick', () => {
      link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      linkLabel.attr('x', d => (d.source.x + d.target.x) / 2)
        .attr('y', d => (d.source.y + d.target.y) / 2);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Initial zoom to fit
    setTimeout(() => {
      const bounds = g.node()?.getBBox();
      if (bounds) {
        const scale = Math.min(width / (bounds.width + 100), height / (bounds.height + 100), 1.5);
        const tx = width / 2 - (bounds.x + bounds.width / 2) * scale;
        const ty = height / 2 - (bounds.y + bounds.height / 2) * scale;
        svg.transition().duration(500).call(d3.zoom().transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
      }
    }, 200);
  };

  const handleAddRelationship = async () => {
    if (!newRel.person_a_id || !newRel.person_b_id) return;
    try {
      await relationshipsAPI.create(family_id, newRel);
      setShowAddRel(false);
      setNewRel({ person_a_id: '', person_b_id: '', label: '' });
      fetchData();
    } catch (err) {
      console.error('Failed to add relationship:', err);
    }
  };

  const handleZoomIn = () => {
    d3.select(svgRef.current).transition().duration(300).call(d3.zoom().scaleBy, 1.3);
  };

  const handleZoomOut = () => {
    d3.select(svgRef.current).transition().duration(300).call(d3.zoom().scaleBy, 0.7);
  };

  const handleReset = () => {
    d3.select(svgRef.current).transition().duration(300).call(d3.zoom().transform, d3.zoomIdentity);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="var(--border)" strokeWidth="3" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col md:flex-row">
      <Sidebar family={family} familyId={family_id} activePage="graph" />

      <div className="flex-1 flex flex-col min-w-0 p-4 md:p-6 pb-20 md:pb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display text-xl">Family Graph</h1>
            <p className="text-[13px] text-[var(--text-secondary)]">{people.length} members, {relationships.length} connections</p>
          </div>
        </div>

        {/* Graph Canvas */}
        <div
          ref={containerRef}
          className="flex-1 relative rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border)] overflow-hidden shadow-[var(--shadow-sm)]"
          style={{ minHeight: 450 }}
        >
          <svg ref={svgRef} className="w-full h-full" />

          {/* Controls */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10">
            <button onClick={handleZoomIn} className="btn-icon shadow-[var(--shadow-sm)]">
              <ZoomIn size={18} />
            </button>
            <button onClick={handleZoomOut} className="btn-icon shadow-[var(--shadow-sm)]">
              <ZoomOut size={18} />
            </button>
            <button onClick={handleReset} className="btn-icon shadow-[var(--shadow-sm)]">
              <RotateCcw size={18} />
            </button>
            <div className="h-px bg-[var(--border)] my-1" />
            <button onClick={() => setShowAddRel(true)}
              className="w-9 h-9 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] flex items-center justify-center transition-colors shadow-[var(--shadow-sm)]">
              <Plus size={18} />
            </button>
          </div>

          {/* Tooltip */}
          {tooltip && (
            <div className="absolute z-20 px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)] shadow-[var(--shadow-lg)] pointer-events-none"
              style={{ left: tooltip.x + 15, top: tooltip.y - 10 }}>
              <p className="text-sm font-medium text-[var(--text)]">{tooltip.name}</p>
              <p className="text-xs text-[var(--text-muted)]">{tooltip.count} memories</p>
            </div>
          )}
        </div>
      </div>

      <FloatingChatButton familyId={family_id} />
      <BottomTabBar familyId={family_id} activeTab="graph" />

      {/* Add Relationship Modal */}
      {showAddRel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowAddRel(false)}>
          <div className="w-full max-w-[400px] bg-[var(--surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] animate-fade-in"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
              <h2 className="font-display text-lg">Add Relationship</h2>
              <button onClick={() => setShowAddRel(false)} className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <div className="form-group">
                <label>Person A</label>
                <select value={newRel.person_a_id} onChange={e => setNewRel({ ...newRel, person_a_id: e.target.value })}>
                  <option value="">Select person...</option>
                  {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Person B</label>
                <select value={newRel.person_b_id} onChange={e => setNewRel({ ...newRel, person_b_id: e.target.value })}>
                  <option value="">Select person...</option>
                  {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 24 }}>
                <label>Label</label>
                <input type="text" value={newRel.label} onChange={e => setNewRel({ ...newRel, label: e.target.value })}
                  placeholder="e.g. Married, Sisters, Father-Son" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowAddRel(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={handleAddRelationship} className="btn btn-primary flex-1">Add</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
