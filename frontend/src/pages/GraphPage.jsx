import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import api, { familyAPI, peopleAPI, relationshipsAPI } from '../lib/api';
import Sidebar from '../components/Sidebar';
import BottomTabBar from '../components/BottomTabBar';
import FloatingChatButton from '../components/FloatingChatButton';
import { ZoomIn, ZoomOut, RotateCcw, Plus, X, Users } from 'lucide-react';

// Community-aware colors (color-blind friendly palette)
const COMMUNITY_COLORS = ['#A85542', '#4A6B8A', '#C4984F', '#5A8A7A', '#8B6B8B', '#B87A5A'];

function getColor(name, communityIdx = -1) {
  if (communityIdx >= 0) return COMMUNITY_COLORS[communityIdx % COMMUNITY_COLORS.length];
  return COMMUNITY_COLORS[name ? name.charCodeAt(0) % COMMUNITY_COLORS.length : 0];
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
  const [communities, setCommunities] = useState([]);

  useEffect(() => { fetchData(); }, [family_id]);

  useEffect(() => {
    if (people.length > 0 && svgRef.current) { drawGraph(); }
  }, [people, relationships]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [familyData, peopleData, relsData] = await Promise.all([
        familyAPI.get(family_id),
        peopleAPI.list(family_id),
        relationshipsAPI.list(family_id),
      ]);
      setFamily(familyData);
      setPeople(peopleData);
      setRelationships(relsData);

      // Fetch communities from API
      try {
        const communitiesData = await api.get(`/graph/communities?family_id=${family_id}`).then(r => r.data);
        setCommunities(communitiesData.communities || []);
      } catch {}
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
        .attr('fill', 'var(--ink-muted)')
        .attr('font-family', "'DM Serif Display', Georgia, serif")
        .attr('font-size', '16px')
        .text('Add people and relationships to see your family tree');
      return;
    }

    // Build community map: person_id -> community index
    const communityMap = {};
    communities.forEach((community, idx) => {
      community.forEach(({ id }) => { communityMap[id] = idx; });
    });

    const nodes = people.map(p => ({
      id: p.id,
      name: p.name,
      photo_url: p.photo_url,
      memory_count: p.memory_count || 0,
      relationship_tag: p.relationship_tag,
      communityIdx: communityMap[p.id] ?? -1,
    }));

    const links = relationships.map(r => ({
      source: r.person_a.id,
      target: r.person_b.id,
      label: r.label,
    }));

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(160).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-280))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(60));

    const g = svg.append('g');
    const zoom = d3.zoom()
      .scaleExtent([0.25, 3])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);

    // ─── Stitched Thread Connector Lines ───────────────────────────────────
    // Dashed, organic lines that look like binding thread
    const link = g.append('g').selectAll('line').data(links).join('line')
      .attr('stroke', 'var(--border)')
      .attr('stroke-width', 1.8)
      .attr('stroke-dasharray', '4,4')
      .attr('stroke-linecap', 'round')
      .attr('opacity', 0.7);

    // Thread "stitch dots" at each end of connector
    const linkDots = g.append('g').selectAll('circle').data(links).join('circle')
      .attr('r', 2)
      .attr('fill', 'var(--border)')
      .attr('opacity', 0.7);

    // Link labels (relationship type)
    const linkLabel = g.append('g').selectAll('text').data(links).join('text')
      .attr('fill', 'var(--ink-muted)')
      .attr('font-size', '9px')
      .attr('font-family', "'DM Mono', 'Courier New', monospace")
      .attr('text-anchor', 'middle')
      .attr('dy', -12)
      .text(d => d.label || '');

    // ─── Portrait-Stamp Nodes ──────────────────────────────────────────────
    const node = g.append('g').selectAll('g').data(nodes).join('g')
      .style('cursor', 'pointer')
      .on('click', (event, d) => navigate(`/people/${d.id}`))
      .on('mouseenter', (event, d) => {
        const rect = containerRef.current.getBoundingClientRect();
        const svgEl = svgRef.current;
        const point = svgEl.createSVGPoint();
        point.x = d.x;
        point.y = d.y;
        const ct = svgEl.getCTM();
        if (ct) {
          const transformed = point.matrixTransform(ct);
          setTooltip({
            x: transformed.x + rect.left,
            y: transformed.y + rect.top,
            name: d.name,
            count: d.memory_count,
            tag: d.relationship_tag,
          });
        }
        // Highlight thread connections on hover
        d3.select(event.currentTarget).select('ellipse')
          .transition().duration(200)
          .attr('stroke', getColor(d.name, d.communityIdx))
          .attr('stroke-width', 2.5);
        link.filter(l => l.source.id === d.id || l.target.id === d.id)
          .transition().duration(200)
          .attr('opacity', 1)
          .attr('stroke', getColor(d.name, d.communityIdx));
      })
      .on('mouseleave', (event, d) => {
        setTooltip(null);
        d3.select(event.currentTarget).select('ellipse')
          .transition().duration(200)
          .attr('stroke', 'var(--vellum)')
          .attr('stroke-width', 2);
        link.filter(l => l.source.id === d.id || l.target.id === d.id)
          .transition().duration(200)
          .attr('opacity', 0.7)
          .attr('stroke', 'var(--border)');
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

    const nodeRadius = d => Math.max(24, Math.min(40, (d.memory_count || 0) * 3 + 24));

    // Oval portrait-stamp background (vignette shape)
    node.append('ellipse')
      .attr('rx', d => nodeRadius(d))
      .attr('ry', d => nodeRadius(d) * 1.1)
      .attr('fill', d => {
        const c = getColor(d.name, d.communityIdx);
        return c + '22'; // very light tint of community color
      })
      .attr('stroke', 'var(--vellum)')
      .attr('stroke-width', 2);

    // Node circle (colored by community)
    node.append('circle')
      .attr('r', d => nodeRadius(d) - 4)
      .attr('fill', d => getColor(d.name, d.communityIdx))
      .attr('opacity', 0.9);

    // Node initials
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.2em')
      .attr('fill', 'white')
      .attr('font-family', "'DM Serif Display', Georgia, serif")
      .attr('font-size', d => `${Math.max(13, (nodeRadius(d) - 4) * 0.55)}px`)
      .text(d => d.name?.charAt(0).toUpperCase());

    // Node labels (name below stamp)
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', d => nodeRadius(d) * 1.1 + 18)
      .attr('fill', 'var(--ink)')
      .attr('font-family', "'Inter', sans-serif")
      .attr('font-size', '11px')
      .attr('font-weight', '500')
      .text(d => d.name);

    // Tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      linkDots
        .attr('cx', d => d.source.x).attr('cy', d => d.source.y);
      linkDots.each(function(d) {
        d3.select(this)
          .attr('cx', (d.source.x + d.target.x) / 2)
          .attr('cy', (d.source.y + d.target.y) / 2);
      });
      linkLabel
        .attr('x', d => (d.source.x + d.target.x) / 2)
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
      <div className="min-h-screen bg-[var(--page)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-thread-pull w-32 h-px mx-auto mb-4" />
          <p className="text-[var(--ink-muted)] text-sm font-mono text-xs tracking-wider">Binding the threads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--page)] flex flex-col md:flex-row">
      <Sidebar family={family} familyId={family_id} activePage="graph" />

      <div className="flex-1 flex flex-col min-w-0 p-4 md:p-6 pb-20 md:pb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display text-xl">Family Tree</h1>
            <p className="text-[12px] text-[var(--ink-light)] mt-0.5 font-mono tracking-[0.02em]">
              {people.length} {people.length === 1 ? 'page' : 'pages'}, {relationships.length} {relationships.length === 1 ? 'thread' : 'threads'}
            </p>
          </div>
        </div>

        {/* Legend (community colors) */}
        {communities.length > 1 && (
          <div className="flex items-center gap-4 mb-4 px-4 py-2 bg-[var(--vellum)] rounded-[var(--radius-sm)] border border-[var(--border)]">
            <Users size={14} className="text-[var(--ink-muted)]" />
            {communities.map((community, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: getColor('', idx) }} />
                <span className="font-mono text-[10px] text-[var(--ink-light)]">
                  {community.map(p => p.name).join(', ')}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Graph Canvas */}
        <div
          ref={containerRef}
          className="flex-1 relative rounded-[var(--radius-md)] bg-[var(--vellum)] border border-[var(--border)] overflow-hidden shadow-[var(--shadow-sm)]"
          style={{ minHeight: 450 }}
        >
          <svg ref={svgRef} className="w-full h-full" />

          {/* Empty state overlay */}
          {people.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full border-1.5 border-dashed border-[var(--border)] flex items-center justify-center">
                  <Users size={26} className="text-[var(--ink-muted)]" style={{ opacity: 0.4 }} />
                </div>
                <p className="font-display text-lg text-[var(--ink-muted)]">No threads yet</p>
                <p className="text-[var(--ink-light)] text-sm mt-1">Add people and connect them</p>
              </div>
            </div>
          )}

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
              className="w-9 h-9 rounded-[var(--radius-sm)] bg-[var(--seal)] text-white hover:bg-[var(--seal-hover)] flex items-center justify-center transition-colors shadow-[var(--shadow-sm)]">
              <Plus size={18} />
            </button>
          </div>

          {/* Tooltip */}
          {tooltip && (
            <div className="fixed z-20 px-4 py-3 bg-[var(--vellum)] border border-[var(--border)] rounded-[var(--radius-sm)] shadow-[var(--shadow-lg)] pointer-events-none"
              style={{ left: tooltip.x + 15, top: tooltip.y - 30 }}>
              <p className="text-sm font-medium text-[var(--ink)]">{tooltip.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {tooltip.tag && (
                  <span className="font-mono text-[10px] text-[var(--postmark)]">{tooltip.tag}</span>
                )}
                <span className="font-mono text-[10px] text-[var(--ink-muted)]">{tooltip.count} entries</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <FloatingChatButton familyId={family_id} />
      <BottomTabBar familyId={family_id} activeTab="graph" />

      {/* Add Relationship Modal */}
      {showAddRel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(28,26,23,0.25)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowAddRel(false)}>
          <div className="w-full max-w-[400px] bg-[var(--vellum)] rounded-[var(--radius-md)] shadow-[var(--shadow-lg)] animate-fade-in"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
              <h2 className="font-display text-lg">Add Thread</h2>
              <button onClick={() => setShowAddRel(false)} className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--ink-muted)] hover:bg-[var(--page)] hover:text-[var(--ink)] transition-colors">
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
                <button onClick={handleAddRelationship} className="btn btn-primary flex-1">Add Thread</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
