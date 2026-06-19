import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Image, MapPin, X, ChevronLeft, Users } from 'lucide-react';
import Avatar from '../components/ui/Avatar';
import { familyAPI, feedAPI } from '../lib/api';

export default function CreatePostPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [familyId, setFamilyId] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [members, setMembers] = useState([]);
  const [tagged, setTagged] = useState([]);
  const [showTagSearch, setShowTagSearch] = useState(false);
  const [tagQuery, setTagQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    familyAPI.getMyFamilies().then(families => {
      if (Array.isArray(families) && families.length > 0) {
        setFamilyId(families[0].id);
        familyAPI.get(families[0].id).then(data => setMembers(data.members || [])).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const handlePhotos = (files) => {
    const arr = Array.from(files);
    const valid = arr.filter(f => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type));
    setPhotos(prev => [...prev, ...valid]);
    setPreviews(prev => [...prev, ...valid.map(f => URL.createObjectURL(f))]);
  };

  const removePhoto = (i) => {
    URL.revokeObjectURL(previews[i]);
    setPhotos(p => p.filter((_, idx) => idx !== i));
    setPreviews(p => p.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async () => {
    if (photos.length === 0 && !caption.trim()) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('family_id', familyId);
      if (caption) formData.append('caption', caption);
      if (location) formData.append('location', location);
      photos.forEach(p => formData.append('photos', p));
      await feedAPI.createPost(formData);
      navigate('/');
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to create post');
    } finally { setUploading(false); }
  };

  const toggleTag = (member) => {
    setTagged(prev => prev.find(t => t.id === member.id) ? prev.filter(t => t.id !== member.id) : [...prev, member]);
  };

  return (
    <div className="min-h-screen bg-[var(--page)]">
      <div className="sticky top-0 z-40 bg-[var(--page)]/95 backdrop-blur-sm border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="btn-icon"><ChevronLeft size={20} /></button>
          <h1 className="font-display text-lg">New Post</h1>
          <button onClick={handleSubmit} disabled={uploading || (photos.length === 0 && !caption.trim())}
            className="btn btn-primary btn-sm">{uploading ? 'Posting...' : 'Share'}</button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 animate-fade-in-up">
        <div>
          <label className="text-sm font-medium text-[var(--ink-light)] mb-2 block font-mono text-xs uppercase tracking-[0.05em]">Photos</label>
          <div onDrop={(e) => { e.preventDefault(); setDragOver(false); handlePhotos(e.dataTransfer.files); }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-[var(--radius-md)] p-10 text-center cursor-pointer transition-all ${dragOver ? 'border-[var(--seal)] bg-[var(--seal-light)]' : 'border-[var(--border)] hover:border-[var(--seal)]'}`}>
            <Image size={32} className="mx-auto mb-3 text-[var(--ink-muted)]" />
            <p className="text-sm text-[var(--ink-muted)]">Drop photos here or tap to upload</p>
            <p className="text-[11px] text-[var(--ink-muted)] mt-1">JPG, PNG, WebP</p>
            <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handlePhotos(e.target.files)} />
          </div>
          {previews.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              {previews.map((url, i) => (
                <div key={i} className="relative group">
                  <img src={url} alt="" className="w-full h-24 object-cover rounded-[var(--radius-sm)] border border-[var(--border)]" />
                  <button onClick={() => removePhoto(i)} className="absolute -top-2 -right-2 w-5 h-5 bg-[var(--danger)] text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-[var(--ink-light)] mb-2 block font-mono text-xs uppercase tracking-[0.05em]">Caption</label>
          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Write something..." rows={4}
            className="w-full bg-[var(--vellum)] border border-[var(--border)] rounded-[var(--radius-sm)] p-4 text-[15px] text-[var(--ink)] placeholder:text-[var(--ink-muted)] outline-none resize-none focus:border-[var(--seal)] transition-colors font-body" />
        </div>

        <div>
          <label className="text-sm font-medium text-[var(--ink-light)] mb-2 block font-mono text-xs uppercase tracking-[0.05em]">Location</label>
          <div className="relative">
            <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Add location (optional)"
              className="w-full pl-10 pr-4 py-3 bg-[var(--vellum)] border border-[var(--border)] rounded-[var(--radius-sm)] text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] outline-none focus:border-[var(--seal)] transition-colors" />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-[var(--ink-light)] mb-2 block font-mono text-xs uppercase tracking-[0.05em]">Tag People</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tagged.map(t => (
              <div key={t.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--seal-light)] rounded-full">
                <span className="text-[12px] text-[var(--seal)]">{t.name}</span>
                <button onClick={() => toggleTag(t)} className="text-[var(--seal)] hover:text-[var(--seal-hover)]"><X size={12} /></button>
              </div>
            ))}
          </div>
          <div className="relative">
            <input type="text" value={tagQuery} onChange={(e) => { setTagQuery(e.target.value); setShowTagSearch(true); }}
              onFocus={() => setShowTagSearch(true)} placeholder="Search family members..."
              className="w-full px-4 py-3 bg-[var(--vellum)] border border-[var(--border)] rounded-[var(--radius-sm)] text-sm outline-none focus:border-[var(--seal)] transition-colors" />
            {showTagSearch && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--vellum)] border border-[var(--border)] rounded-[var(--radius-sm)] shadow-[var(--shadow-md)] max-h-40 overflow-y-auto z-10">
                {members.filter(m => m.name.toLowerCase().includes(tagQuery.toLowerCase())).map(m => (
                  <button key={m.id} onClick={() => { toggleTag(m); setShowTagSearch(false); setTagQuery(''); }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-[var(--page)] transition-colors">
                    <Avatar name={m.name} size={28} />
                    <span className="text-sm text-[var(--ink)]">{m.name}</span>
                    {tagged.find(t => t.id === m.id) && <span className="ml-auto text-[11px] text-[var(--seal)] font-mono">Tagged</span>}
                  </button>
                ))}
                {members.length === 0 && <p className="px-4 py-3 text-sm text-[var(--ink-muted)]">No family members found</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
