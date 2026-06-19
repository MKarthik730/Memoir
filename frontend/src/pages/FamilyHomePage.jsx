import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { familyAPI, peopleAPI } from '../lib/api';
import Sidebar from '../components/Sidebar';
import BottomTabBar from '../components/BottomTabBar';
import FloatingChatButton from '../components/FloatingChatButton';
import Avatar from '../components/ui/Avatar';
import { Plus, Users, Search, Share2, UserPlus, Image, Copy, Check, X, BookOpen } from 'lucide-react';

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
      <div className="min-h-screen bg-[var(--page)] flex">
        <div className="hidden md:block" style={{ width: 'var(--sidebar-width)' }} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-thread-pull w-32 h-px mx-auto mb-4" />
            <p className="text-[var(--ink-muted)] text-sm font-mono text-xs tracking-wider">Opening your journal...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--page)] flex flex-col md:flex-row">
      <Sidebar family={family} familyId={family_id} activePage="home" />

      <div className="flex-1" style={{ paddingBottom: 80 }}>
        {/* Header */}
        <div className="sticky top-0 z-40 bg-[var(--page)]/95 backdrop-blur-sm border-b border-[var(--border)]">
          <div className="px-6 py-5 max-w-5xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="font-display text-xl">{family?.name || 'Family'}</h1>
              <p className="text-[12px] text-[var(--ink-light)] mt-0.5 font-mono tracking-[0.02em]">
                {people.length} {people.length === 1 ? 'page' : 'pages'}
              </p>
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
                <span className="hidden sm:inline">Add Page</span>
              </button>
            </div>
          </div>

          {/* Invite Link */}
          {showInvite && inviteLink && (
            <div className="px-6 pb-5 max-w-5xl mx-auto">
              <div className="p-4 bg-[var(--vellum)] rounded-[var(--radius-sm)] border border-[var(--border)]">
                <p className="text-[11px] font-mono tracking-[0.05em] text-[var(--ink-muted)] mb-2 uppercase">
                  Send an invitation
                </p>
                <div className="flex gap-2">
                  <input type="text" value={inviteLink} readOnly className="flex-1 px-3 py-2 bg-[var(--page)] border border-[var(--border)] rounded-[var(--radius-sm)] text-sm font-mono text-xs" />
                  <button onClick={copyInviteLink} className="btn btn-secondary btn-sm">
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="max-w-5xl mx-auto px-6 py-8">
          {people.length === 0 ? (
            /* Journal empty state */
            <div className="empty-journal animate-fade-in-up">
              <BookOpen size={40} className="mx-auto mb-4 text-[var(--ink-muted)]" style={{ opacity: 0.35 }} />
              <div className="thread-divider max-w-[100px] mx-auto mb-6" />
              <h2 className="font-display text-2xl mb-3">Start the first page</h2>
              <p className="text-[var(--ink-light)] text-sm max-w-sm mx-auto mb-8 leading-relaxed">
                Every family story begins with a name. Add your first family member and begin writing your story together.
              </p>
              <button onClick={() => setShowAddPerson(true)} className="btn-seal">
                <Plus size={18} />
                Add Your First Page
              </button>
            </div>
          ) : (
            <>
              {/* Thread divider */}
              <div className="thread-divider mb-8">
                <span className="thread-divider-dot" />
              </div>

              {/* Ledger-style member list */}
              <div className="space-y-3">
                {people.map((person, index) => (
                  <div
                    key={person.id}
                    onClick={() => navigate(`/people/${person.id}`)}
                    className="card card-clickable p-5 animate-fade-in-up"
                    style={{ animationDelay: `${index * 0.04}s` }}
                  >
                    <div className="flex items-center gap-4">
                      <Avatar name={person.name} url={person.photo_url} size={44} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium text-[var(--ink)] truncate">{person.name}</h3>
                          {person.relationship_tag && (
                            <span className="flex-shrink-0 px-2.5 py-0.5 rounded-full border border-[var(--postmark)] text-[10px] text-[var(--postmark)] font-mono tracking-[0.03em]">
                              {person.relationship_tag}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="font-mono text-[11px] text-[var(--ink-muted)]">
                            {person.memory_count} {person.memory_count === 1 ? 'entry' : 'entries'}
                          </span>
                          {person.bio && (
                            <>
                              <span className="w-[3px] h-[3px] rounded-full bg-[var(--border)]" />
                              <span className="text-[12px] text-[var(--ink-light)] truncate">{person.bio}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Postmark date indicator */}
                      {person.created_at && (
                        <div className="postmark flex-shrink-0 hidden sm:flex">
                          <span>{new Date(person.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                      )}
                    </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(28,26,23,0.25)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowAddPerson(false)}>
          <div className="w-full max-w-[400px] bg-[var(--vellum)] rounded-[var(--radius-md)] shadow-[var(--shadow-lg)] animate-fade-in"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
              <h2 className="font-display text-lg">New Page</h2>
              <button onClick={() => setShowAddPerson(false)} className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--ink-muted)] hover:bg-[var(--page)] hover:text-[var(--ink)] transition-colors">
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
                  {adding ? 'Adding...' : 'Add Page'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
