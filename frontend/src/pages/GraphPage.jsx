import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import * as d3 from 'd3';
import { peopleAPI, relationshipsAPI } from '../lib/api';
import Sidebar from '../components/Sidebar';
import BottomTabBar from '../components/BottomTabBar';
import { Loader2, ZoomIn, ZoomOut, RotateCcw, Plus } from 'lucide-react';

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

  useEffect(() => {
    fetchData();
  }, [family_id]);

  useEffect(() => {
    if (people.length > 0 && svgRef.current) {
      drawGraph();
    }
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

    // Define arrow marker
    svg.append('defs').append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#B8975A')
      .attr('opacity', 0.6);

    // If no people
    if (people.length === 0) {
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#8B7355')
        .attr('font-family', "'Playfair Display', serif")
        .attr('font-size', '18px')
        .text('Add people and relationships to see your family tree');
      return;
    }

    // Create nodes and links
    const nodes = people.map(p => ({
      id: p.id,
      name: p.name,
      photo_url: p.photo_url,
      memory_count: p.memory_count || 0,
      relationship_tag: p.relationship_tag,
    }));

    const links = relationships.map(r => ({
      source: r.person_a.id,
      target: r.person_b.id,
      label: r.label,
    }));

    // If no relationships
    if (links.length === 0 && nodes.length > 0) {
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', 40)
        .attr('text-anchor', 'middle')
        .attr('fill', '#8B7355')
        .attr('font-family', "'Playfair Display', serif")
        .attr('font-size', '14px')
        .text('Connect your family members using the + button');
    }

    // Simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(50));

    // Zoom
    const g = svg.append('g');
    const zoom = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);

    // Links
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#B8975A')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrow)');

    // Link labels
    const linkLabel = g.append('g')
      .selectAll('text')
      .data(links)
      .join('text')
      .attr('fill', '#B8975A')
      .attr('font-size', '10px')
      .attr('font-family', "'DM Sans', sans-serif")
      .attr('text-anchor', 'middle')
      .attr('dy', -8)
      .text(d => d.label || '');

    // Nodes
    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        navigate(`/people/${d.id}`);
      })
      .on('mouseenter', (event, d) => {
        setTooltip({ x: event.offsetX, y: event.offsetY, name: d.name, count: d.memory_count });
        d3.select(event.currentTarget).select('circle')
          .transition().duration(200)
          .attr('stroke', '#FFD700')
          .attr('stroke-width', 3);
      })
      .on('mouseleave', (event) => {
        setTooltip(null);
        d3.select(event.currentTarget).select('circle')
          .transition().duration(200)
          .attr('stroke', 'rgba(255,255,255,0.3)')
          .attr('stroke-width', 2);
      })
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    // Node circles
    const nodeRadius = d => Math.max(20, Math.min(40, (d.memory_count || 0) * 5 + 20));

    node.append('circle')
      .attr('r', nodeRadius)
      .attr('fill', d => d.photo_url ? '#B8975A' : '#C4857A')
      .attr('stroke', 'rgba(255,255,255,0.3)')
      .attr('stroke-width', 2)
      .style('filter', 'drop-shadow(0 2px 6px rgba(0,0,0,0.15))');

    // Node images (clip-path circle)
    node.filter(d => d.photo_url).append('clipPath')
      .attr('id', d => `clip-${d.id}`)
      .append('circle')
      .attr('r', nodeRadius);

    node.filter(d => d.photo_url).append('image')
      .attr('xlink:href', d => d.photo_url)
      .attr('x', d => -nodeRadius(d))
      .attr('y', d => -nodeRadius(d))
      .attr('width', d => nodeRadius(d) * 2)
      .attr('height', d => nodeRadius(d) * 2)
      .attr('clip-path', d => `url(#clip-${d.id})`)
      .attr('preserveAspectRatio', 'xMidYMid slice');

    // Node initials (fallback)
    node.filter(d => !d.photo_url).append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', 'white')
      .attr('font-family', "'Playfair Display', serif")
      .attr('font-size', d => `${Math.max(12, nodeRadius(d) * 0.6)}px`)
      .text(d => d.name?.charAt(0).toUpperCase());

    // Node labels
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', d => nodeRadius(d) + 16)
      .attr('fill', '#2C1810')
      .attr('font-family', "'DM Sans', sans-serif")
      .attr('font-size', '11px')
      .text(d => d.name);

    // Simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      linkLabel
        .attr('x', d => (d.source.x + d.target.x) / 2)
        .attr('y', d => (d.source.y + d.target.y) / 2);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Pulse animation via CSS
    node.select('circle').style('animation', 'nodePulse 3s ease-in-out infinite');
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
    const svg = d3.select(svgRef.current);
    svg.transition().duration(500).call(d3.zoom().scaleBy, 1.3);
  };

  const handleZoomOut = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().duration(500).call(d3.zoom().scaleBy, 0.7);
  };

  const handleReset = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().duration(500).call(d3.zoom().transform, d3.zoomIdentity);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#B8975A]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col md:flex-row">
      <Sidebar family={family} familyId={family_id} activePage="graph" />
      
      <div className="flex-1 relative m-4 md:m-6 rounded-xl bg-[#F5F0E8] border border-[rgba(184,151,90,0.2)] overflow-hidden shadow-sm" ref={containerRef} style={{ minHeight: 'calc(100vh - 100px)' }}>
        {/* Controls */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          <button onClick={handleZoomIn} className="p-2.5 bg-[#F5F0E8] hover:bg-[#EDE5D5] rounded-lg text-[#8B7355] hover:text-[#4A1C0A] transition-colors shadow-sm">
            <ZoomIn size={18} />
          </button>
          <button onClick={handleZoomOut} className="p-2.5 bg-[#F5F0E8] hover:bg-[#EDE5D5] rounded-lg text-[#8B7355] hover:text-[#4A1C0A] transition-colors shadow-sm">
            <ZoomOut size={18} />
          </button>
          <button onClick={handleReset} className="p-2.5 bg-[#F5F0E8] hover:bg-[#EDE5D5] rounded-lg text-[#8B7355] hover:text-[#4A1C0A] transition-colors shadow-sm">
            <RotateCcw size={18} />
          </button>
          <button
            onClick={() => setShowAddRel(true)}
            className="p-2.5 bg-[#C4857A] hover:brightness-110 rounded-lg text-white transition-all"
            title="Add Relationship"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-20 px-4 py-3 bg-[#FAF7F2] border border-[#B8975A] rounded-lg shadow-xl pointer-events-none"
            style={{ left: tooltip.x + 15, top: tooltip.y - 10 }}
          >
            <p className="text-[#2C1810] font-display text-sm">{tooltip.name}</p>
            <p className="text-[#8B7355] text-xs">{tooltip.count} memories</p>
          </div>
        )}

        {/* SVG Canvas */}
        <svg ref={svgRef} className="w-full h-full" />

        {/* Add Relationship Modal */}
        {showAddRel && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddRel(false)}>
            <div className="w-full max-w-md bg-[#FAF7F2] rounded-xl p-8 border border-[rgba(184,151,90,0.2)]" onClick={e => e.stopPropagation()}>
              <h2 className="font-display text-2xl text-[#4A1C0A] mb-6">Add Relationship</h2>
              
              <div className="mb-4">
                <label className="block mb-1.5 text-xs font-ui tracking-wider uppercase text-[#8B7355]">Person A</label>
                <select
                  value={newRel.person_a_id}
                  onChange={e => setNewRel({ ...newRel, person_a_id: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-[#F5F0E8] border border-[rgba(184,151,90,0.3)] text-[#2C1810] font-ui text-sm outline-none"
                >
                  <option value="">Select person...</option>
                  {people.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block mb-1.5 text-xs font-ui tracking-wider uppercase text-[#8B7355]">Person B</label>
                <select
                  value={newRel.person_b_id}
                  onChange={e => setNewRel({ ...newRel, person_b_id: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-[#F5F0E8] border border-[rgba(184,151,90,0.3)] text-[#2C1810] font-ui text-sm outline-none"
                >
                  <option value="">Select person...</option>
                  {people.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="mb-6">
                <label className="block mb-1.5 text-xs font-ui tracking-wider uppercase text-[#8B7355]">Label</label>
                <input
                  type="text"
                  value={newRel.label}
                  onChange={e => setNewRel({ ...newRel, label: e.target.value })}
                  placeholder="e.g. Married, Sisters, Father-Son"
                  className="w-full px-4 py-3 rounded-lg bg-[#F5F0E8] border border-[rgba(184,151,90,0.3)] text-[#2C1810] font-ui text-sm outline-none"
                />
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowAddRel(false)} className="flex-1 py-3 border border-[#B8975A] text-[#B8975A] rounded-lg font-ui text-sm">
                  Cancel
                </button>
                <button onClick={handleAddRelationship} className="flex-1 py-3 bg-[#C4857A] text-white rounded-lg font-ui text-sm">
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Tab Bar */}
        <BottomTabBar familyId={family_id} activeTab="graph" />
      </div>
    </div>
  );
}
