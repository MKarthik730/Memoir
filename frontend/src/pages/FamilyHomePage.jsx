import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { familyAPI, peopleAPI } from '../lib/api';
import Sidebar from '../components/Sidebar';
import BottomTabBar from '../components/BottomTabBar';
import { Plus, Users, Search as SearchIcon, Share2, Loader2, UserPlus } from 'lucide-react';

export default function FamilyHomePage() {
  const { family_id } = useParams();
  const navigate = useNavigate();
  const [family, setFamily] = useState(null);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newPerson, setNewPerson] = useState({ name: '', relationship_tag: 'Other', bio: '' });
  const [adding, setAdding] = useState(false);
  const [mobileTab, setMobileTab] = useState('home');
  const [inviteLink, setInviteLink] = useState('');
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    fetchData();
  }, [family_id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [familyData, peopleData] = await Promise.all([
        familyAPI.get(family_id),
        peopleAPI.list(family_id),
      ]);
      setFamily(familyData);
      setPeople(peopleData);
      
      // Get invite link
      try {
        const linkData = await familyAPI.getInviteLink(family_id);
        setInviteLink(linkData.invite_url);
      } catch {}
    } catch (err) {
      console.error('Failed to fetch family data:', err);
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
    alert('Invite link copied!');
  };

  const relationshipTags = ['Grandparent', 'Parent', 'Sibling', 'Child', 'Uncle/Aunt', 'Spouse', 'Friend', 'Other'];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex">
        <div className="hidden md:block w-[220px] bg-[#F5F0E8] border-r border-[rgba(184,151,90,0.2)] p-6 animate-pulse" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-[#B8975A]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col md:flex-row">
      {/* Sidebar - Desktop */}
      <Sidebar family={family} familyId={family_id} activePage="home" />

      {/* Main Content */}
      <div className="flex-1 pb-20 md:pb-0">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-[rgba(250,247,242,0.95)] backdrop-blur-sm border-b border-[rgba(184,151,90,0.15)] px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl text-[#4A1C0A]">{family?.name || 'Family'}</h1>
              <p className="text-sm text-[#8B7355] font-body italic">{people.length} members</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowInvite(!showInvite)}
                className="p-2 text-[#8B7355] hover:text-[#B8975A] transition-colors rounded-lg hover:bg-[#F5F0E8]"
                title="Invite family members"
              >
                <Share2 size={18} />
              </button>
              <Link
                to={`/family/${family_id}/search`}
                className="p-2 text-[#8B7355] hover:text-[#B8975A] transition-colors rounded-lg hover:bg-[#F5F0E8]"
              >
                <SearchIcon size={18} />
              </Link>
              <Link
                to={`/family/${family_id}/graph`}
                className="p-2 text-[#8B7355] hover:text-[#B8975A] transition-colors rounded-lg hover:bg-[#F5F0E8]"
              >
                <Share2 size={18} />
              </Link>
            </div>
          </div>

          {/* Invite link */}
          {showInvite && inviteLink && (
            <div className="max-w-5xl mx-auto mt-4 p-4 bg-[#F5F0E8] rounded-lg border border-[rgba(184,151,90,0.2)]">
              <p className="text-xs font-ui tracking-wider uppercase text-[#8B7355] mb-2">Invite Link</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white rounded border border-[rgba(184,151,90,0.2)] text-sm text-[#2C1810]"
                />
                <button onClick={copyInviteLink} className="btn-primary text-sm py-2">
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>

        {/* People Grid */}
        <div className="max-w-5xl mx-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl text-[#2C1810]">Family Members</h2>
            <button
              onClick={() => setShowAddPerson(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#C4857A] text-white rounded-lg font-ui text-sm hover:brightness-110 transition-all active:scale-[0.97]"
            >
              <UserPlus size={16} />
              <span className="hidden sm:inline">Add Member</span>
            </button>
          </div>

          {people.length === 0 ? (
            <div className="text-center py-16">
              <Users size={48} className="mx-auto mb-4 text-[#B8975A]" />
              <h3 className="font-display text-xl text-[#2C1810] mb-2">No family members yet</h3>
              <p className="text-[#8B7355] mb-6">Add your first family member to start building your tree.</p>
              <button onClick={() => setShowAddPerson(true)} className="btn-primary">
                Add Your First Member
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {people.map((person) => (
                <div
                  key={person.id}
                  onClick={() => navigate(`/people/${person.id}`)}
                  className="card p-5 rounded-lg cursor-pointer group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 bg-[#B8975A] flex items-center justify-center">
                      {person.photo_url ? (
                        <img src={person.photo_url} alt={person.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl font-display text-white">
                          {person.name?.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-lg text-[#2C1810] group-hover:text-[#B8975A] transition-colors">
                        {person.name}
                      </h3>
                      {person.relationship_tag && (
                        <span className="inline-block mt-1 px-2.5 py-0.5 text-xs font-ui rounded-full border border-[#B8975A] text-[#B8975A]">
                          {person.relationship_tag}
                        </span>
                      )}
                      <p className="text-xs text-[#8B7355] mt-1.5">
                        {person.memory_count} {person.memory_count === 1 ? 'memory' : 'memories'}
                      </p>
                    </div>
                  </div>
                  {person.bio && (
                    <p className="mt-3 text-sm text-[#8B7355] line-clamp-2">{person.bio}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Tab Bar - Mobile */}
      <BottomTabBar familyId={family_id} activeTab={mobileTab} />

      {/* Add Person Modal */}
      {showAddPerson && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddPerson(false)}
        >
          <div
            className="w-full max-w-md bg-[#FAF7F2] rounded-xl p-8 shadow-xl border border-[rgba(184,151,90,0.2)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-2xl text-[#4A1C0A] mb-6">Add Family Member</h2>
            <form onSubmit={handleAddPerson}>
              <div className="mb-4">
                <label className="block mb-1.5 text-xs font-ui tracking-wider uppercase text-[#8B7355]">Name</label>
                <input
                  type="text"
                  value={newPerson.name}
                  onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })}
                  placeholder="Full name"
                  required
                  className="w-full px-4 py-3 rounded-lg bg-[#F5F0E8] border border-[rgba(184,151,90,0.3)] focus:border-[#B8975A] text-[#2C1810] font-ui text-sm outline-none transition-all"
                />
              </div>

              <div className="mb-4">
                <label className="block mb-1.5 text-xs font-ui tracking-wider uppercase text-[#8B7355]">Relationship</label>
                <select
                  value={newPerson.relationship_tag}
                  onChange={(e) => setNewPerson({ ...newPerson, relationship_tag: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-[#F5F0E8] border border-[rgba(184,151,90,0.3)] focus:border-[#B8975A] text-[#2C1810] font-ui text-sm outline-none transition-all"
                >
                  {relationshipTags.map((tag) => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </div>

              <div className="mb-6">
                <label className="block mb-1.5 text-xs font-ui tracking-wider uppercase text-[#8B7355]">Bio (optional)</label>
                <textarea
                  value={newPerson.bio}
                  onChange={(e) => setNewPerson({ ...newPerson, bio: e.target.value })}
                  placeholder="A short description..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg bg-[#F5F0E8] border border-[rgba(184,151,90,0.3)] focus:border-[#B8975A] text-[#2C1810] font-body text-sm outline-none transition-all resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddPerson(false)}
                  className="flex-1 py-3 border border-[#B8975A] text-[#B8975A] rounded-lg font-ui text-sm hover:brightness-110 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding || !newPerson.name.trim()}
                  className="flex-1 py-3 bg-[#C4857A] text-white rounded-lg font-ui text-sm hover:brightness-110 transition-all disabled:opacity-60"
                >
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
