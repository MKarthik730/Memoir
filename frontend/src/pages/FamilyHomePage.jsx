import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { familyAPI, peopleAPI } from '../lib/api';
import Sidebar from '../components/Sidebar';
import BottomTabBar from '../components/BottomTabBar';
import FloatingChatButton from '../components/FloatingChatButton';
import Avatar from '../components/ui/Avatar';
import { Plus, Users, Search, Share2, UserPlus, Image, Copy, Check, X } from 'lucide-react';

export default function FamilyHomePage() {
  const { family_id } = useParams();
  const navigate = useNavigate();
  const [family, setFamily] = useState(null);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newPerson, setNewPerson] = useState({ name: '', relationship_tag: 'Other', bio: '' });
  const [adding, setAdding] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { fetchData(); }, [family_id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [familyData, peopleData] = await Promise.all([
        familyAPI.get(family_id),
        peopleAPI.list(family_id),
      ]);
      setFamily(familyData);
      setPeople(peopleData);
      try {
        const linkData = await familyAPI.getInviteLink(family_id);
        setInviteLink(linkData.invite_url);
      } catch {}
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddPerson = async (e) => {
    e.preventDefault();
    if (!newPerson.name.trim()) return;
    setAdding(true);
    try {
      const formData = new FormData();
      formData.append('name', newPerson.name);
      formData.append('relationship_tag', newPerson.relationship_tag);
      formData.append('bio', newPerson.bio);
      await peopleAPI.create(family_id, formData);
      setNewPerson({ name: '', relationship_tag: 'Other', bio: '' });
      setShowAddPerson(false);
      fetchData();
    } catch (err) {
      console.error('Failed to add person:', err);
    } finally {
      setAdding(false);
    }
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const relationshipTags = ['Grandparent', 'Parent', 'Sibling', 'Child', 'Uncle/Aunt', 'Spouse', 'Friend', 'Other'];

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex">
        <div className="hidden md:block" style={{ width: 'var(--sidebar-width)' }} />
        <div className="flex-1 flex items-center justify-center">
          <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="var(--border)" strokeWidth="3" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col md:flex-row">
      <Sidebar family={family} familyId={family_id} activePage="home" />

      <div className="flex-1" style={{ paddingBottom: 80 }}>
        {/* Header */}
        <div className="sticky top-0 z-40 bg-[var(--surface)]/95 backdrop-blur-sm border-b border-[var(--border)]">
          <div className="px-6 py-5 max-w-5xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="font-display text-xl">{family?.name || 'Family'}</h1>
              <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">{people.length} {people.length === 1 ? 'member' : 'members'}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowInvite(!showInvite)}
                className="btn-icon"
                title="Invite members"
              >
                <Share2 size={18} />
              </button>
              <Link to={`/family/${family_id}/search`} className="btn-icon">
                <Search size={18} />
              </Link>
              <button
                onClick={() => setShowAddPerson(true)}
                className="btn btn-primary btn-sm"
              >
                <UserPlus size={16} />
                <span className="hidden sm:inline">Add Member</span>
              </button>
            </div>
          </div>

          {/* Invite Link */}
          {showInvite && inviteLink && (
            <div className="px-6 pb-5 max-w-5xl mx-auto">
              <div className="p-4 bg-[var(--bg)] rounded-[var(--radius-sm)]">
                <p className="text-[11px] uppercase tracking-[0.5px] font-medium text-[var(--text-muted)] mb-2">Invite Link</p>
                <div className="flex gap-2">
                  <input type="text" value={inviteLink} readOnly className="flex-1 px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)] text-sm" />
                  <button onClick={copyInviteLink} className="btn btn-secondary btn-sm">
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* People Grid */}
        <div className="max-w-5xl mx-auto px-6 py-8">
          {people.length === 0 ? (
            <div className="text-center py-20 animate-fade-in-up">
              <Users size={48} className="mx-auto mb-4 text-[var(--text-muted)]" style={{ opacity: 0.4 }} />
              <h2 className="font-display text-xl mb-2">No family members yet</h2>
              <p className="text-[var(--text-secondary)] mb-6">Add your first family member to start building your tree.</p>
              <button onClick={() => setShowAddPerson(true)} className="btn btn-primary">
                <UserPlus size={16} />
                Add Your First Member
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-lg text-[var(--text)]">Family Members</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
                {people.map((person) => (
                  <div
                    key={person.id}
                    onClick={() => navigate(`/people/${person.id}`)}
                    className="card card-clickable p-5"
                  >
                    <div className="flex items-start gap-4">
                      <Avatar name={person.name} url={person.photo_url} size={48} />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-[var(--text)] truncate">{person.name}</h3>
                        {person.relationship_tag && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-[var(--accent-light)] text-[var(--accent)]">
                            {person.relationship_tag}
                          </span>
                        )}
                        <p className="text-[12px] text-[var(--text-muted)] mt-1.5 flex items-center gap-1">
                          <Image size={12} />
                          {person.memory_count} {person.memory_count === 1 ? 'memory' : 'memories'}
                        </p>
                      </div>
                    </div>
                    {person.bio && (
                      <p className="mt-3 text-[13px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed">{person.bio}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <FloatingChatButton familyId={family_id} />
      <BottomTabBar familyId={family_id} activeTab="home" />

      {/* Add Person Modal */}
      {showAddPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowAddPerson(false)}>
          <div className="w-full max-w-[400px] bg-[var(--surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] animate-fade-in"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
              <h2 className="font-display text-lg">Add Family Member</h2>
              <button onClick={() => setShowAddPerson(false)} className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddPerson} className="p-6">
              <div className="form-group">
                <label>Name</label>
                <input type="text" value={newPerson.name} onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })} placeholder="Full name" required />
              </div>
              <div className="form-group">
                <label>Relationship</label>
                <select value={newPerson.relationship_tag} onChange={(e) => setNewPerson({ ...newPerson, relationship_tag: e.target.value })}>
                  {relationshipTags.map((tag) => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 24 }}>
                <label>Bio (optional)</label>
                <textarea value={newPerson.bio} onChange={(e) => setNewPerson({ ...newPerson, bio: e.target.value })} placeholder="A short description..." rows={3} />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAddPerson(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={adding || !newPerson.name.trim()} className="btn btn-primary flex-1">
                  {adding ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
