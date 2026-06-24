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
        <div className="hidden md:block" style={{ width: 240 }} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="thread-line w-32 mx-auto mb-4" />
            <p className="text-[var(--ink-muted)] text-sm font-mono tracking-wider">Opening your journal...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--page)] flex flex-col md:flex-row">
      <Sidebar family={family} familyId={family_id} activePage="journal" />

      <div className="flex-1" style={{ paddingBottom: 80 }}>
        {/* Header */}
        <div className="sticky top-0 z-40 bg-[var(--vellum)] border-b border-[var(--border)] h-[56px]">
          <div className="px-4 max-w-4xl mx-auto h-full flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <h1 className="text-[15px] font-medium text-[var(--ink)] truncate">{family?.name || 'Family'}</h1>
              <div className="font-mono text-[11px] text-[var(--postmark)] border border-[var(--postmark)] rounded-[2px] px-2 py-[2px] bg-[rgba(74,107,138,0.05)] flex-shrink-0">
                <span>{people.length} {people.length === 1 ? 'page' : 'pages'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => setShowInvite(!showInvite)} className="w-9 h-9 flex items-center justify-center rounded-[6px] border border-[var(--border)] bg-[var(--page)] text-[var(--ink-light)] hover:bg-[rgba(168,85,66,0.05)] hover:text-[var(--ink)] transition-colors" title="Invite members">
                <Share2 size={18} />
              </button>
              <Link to={`/family/${family_id}/search`} className="w-9 h-9 flex items-center justify-center rounded-[6px] border border-[var(--border)] bg-[var(--page)] text-[var(--ink-light)] hover:bg-[rgba(168,85,66,0.05)] hover:text-[var(--ink)] transition-colors">
                <Search size={18} />
              </Link>
              <button onClick={() => setShowAddPerson(true)} className="px-4 py-1.5 rounded-full bg-[var(--seal)] text-[var(--page)] text-[12px] font-medium hover:bg-[var(--seal-hover)] transition-colors flex items-center gap-1">
                <UserPlus size={14} />
                <span className="hidden sm:inline">Add Page</span>
              </button>
            </div>
          </div>

          {/* Invite Link */}
          {showInvite && inviteLink && (
            <div className="px-4 pb-4 max-w-4xl mx-auto">
              <div className="p-4 bg-[var(--page)] rounded-[6px] border border-[var(--border)]">
                <p className="text-[11px] font-mono tracking-[0.05em] text-[var(--ink-muted)] mb-2 uppercase">Send an invitation</p>
                <div className="flex gap-2">
                  <input type="text" value={inviteLink} readOnly className="flex-1 px-3 py-2 bg-[var(--vellum)] border border-[var(--border)] rounded-[6px] text-sm font-mono" />
                  <button onClick={copyInviteLink} className="px-3 py-1.5 rounded-full bg-transparent text-[var(--seal)] border border-[var(--seal)] text-[12px] font-medium hover:bg-[rgba(168,85,66,0.08)] transition-colors flex items-center gap-1">
                    {copied ? <><Check size={14} />Copied</> : <><Copy size={14} />Copy</>}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-4 py-8">
          {people.length === 0 ? (
            <div className="text-center py-16 animate-fade-in-up">
              <BookOpen size={40} className="mx-auto mb-4 text-[var(--ink-muted)] opacity-35" />
              <div className="thread-divider max-w-[100px] mx-auto mb-6" />
              <h2 className="font-display text-2xl mb-3">Start the first page</h2>
              <p className="text-[var(--ink-light)] text-sm max-w-sm mx-auto mb-8 leading-relaxed">
                Every family story begins with a name. Add your first family member and begin writing your story together.
              </p>
              <button onClick={() => setShowAddPerson(true)} className="px-6 py-3 rounded-full bg-[var(--seal)] text-[var(--page)] text-[14px] font-medium hover:bg-[var(--seal-hover)] transition-all shadow-[0_2px_8px_rgba(168,85,66,0.2)] active:scale-[0.98]">
                <Plus size={18} className="inline mr-2" />Add Your First Page
              </button>
            </div>
          ) : (
            <>
              <div className="thread-divider mb-6">
                <span className="thread-divider-dot" />
              </div>

              <div className="space-y-3">
                {people.map((person, index) => (
                  <div
                    key={person.id}
                    onClick={() => navigate(`/people/${person.id}`)}
                    className="bg-[var(--vellum)] border border-[var(--border)] rounded-[10px] p-[14px] cursor-pointer hover:shadow-[var(--shadow-md)] transition-shadow animate-fade-in-up"
                    style={{ animationDelay: `${index * 0.04}s` }}
                  >
                    <div className="flex items-start gap-4">
                      <Avatar name={person.name} url={person.photo_url} size={36} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <h3 className="text-[14px] font-medium text-[var(--ink)] truncate">{person.name}</h3>
                          {person.relationship_tag && (
                            <span className="flex-shrink-0 px-2 py-[2px] rounded-[2px] border border-[var(--postmark)] text-[10px] text-[var(--postmark)] font-mono">
                              {person.relationship_tag}
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-[11px] text-[var(--seal)] mt-1">
                          {person.memory_count} {person.memory_count === 1 ? 'entry' : 'entries'}
                        </p>
                        {person.bio && (
                          <p className="text-[13px] text-[var(--ink-light)] italic leading-relaxed mt-1 line-clamp-2">
                            {person.bio}
                          </p>
                        )}
                        {person.created_at && (
                          <p className="font-mono text-[10px] text-[var(--ink-muted)] mt-1">
                            Added {new Date(person.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <FloatingChatButton familyId={family_id} />
      <BottomTabBar familyId={family_id} activeTab="journal" />

      {/* Add Person Modal */}
      {showAddPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(28,26,23,0.25)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowAddPerson(false)}>
          <div className="w-full max-w-[400px] bg-[var(--vellum)] rounded-[14px] shadow-[var(--shadow-lg)] animate-fade-in"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
              <h2 className="font-display text-lg">New Page</h2>
              <button onClick={() => setShowAddPerson(false)} className="w-8 h-8 flex items-center justify-center rounded-[6px] text-[var(--ink-muted)] hover:bg-[var(--page)] hover:text-[var(--ink)] transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddPerson} className="p-6">
              <div className="mb-4">
                <label className="block text-[12px] font-medium text-[var(--ink-light)] mb-[6px]">Name</label>
                <input type="text" value={newPerson.name} onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })} placeholder="Full name" required className="w-full px-3 py-3 bg-[var(--vellum)] border border-[var(--border)] rounded-[6px] text-[14px] outline-none focus:border-[var(--seal)] transition-colors" />
              </div>
              <div className="mb-4">
                <label className="block text-[12px] font-medium text-[var(--ink-light)] mb-[6px]">Relationship</label>
                <select value={newPerson.relationship_tag} onChange={(e) => setNewPerson({ ...newPerson, relationship_tag: e.target.value })} className="w-full px-3 py-3 bg-[var(--vellum)] border border-[var(--border)] rounded-[6px] text-[14px] outline-none focus:border-[var(--seal)] transition-colors">
                  {relationshipTags.map((tag) => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </div>
              <div className="mb-5">
                <label className="block text-[12px] font-medium text-[var(--ink-light)] mb-[6px]">Bio (optional)</label>
                <textarea value={newPerson.bio} onChange={(e) => setNewPerson({ ...newPerson, bio: e.target.value })} placeholder="A short description..." rows={3} className="w-full px-3 py-3 bg-[var(--vellum)] border border-[var(--border)] rounded-[6px] text-[14px] outline-none resize-vertical focus:border-[var(--seal)] transition-colors" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAddPerson(false)} className="flex-1 px-4 py-2 rounded-full bg-transparent text-[var(--seal)] border border-[var(--seal)] text-[13px] font-medium hover:bg-[rgba(168,85,66,0.08)] transition-colors">Cancel</button>
                <button type="submit" disabled={adding || !newPerson.name.trim()} className="flex-1 px-4 py-2 rounded-full bg-[var(--seal)] text-[var(--page)] text-[13px] font-medium hover:bg-[var(--seal-hover)] disabled:opacity-45 transition-colors">
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
