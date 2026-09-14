import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image, MapPin, X, ChevronLeft } from 'lucide-react';
import { familyAPI, feedAPI } from '../lib/api';

export default function CreatePostPage() {
  const navigate = useNavigate();
  const [familyId, setFamilyId] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    familyAPI.getMyFamilies().then(families => {
      if (Array.isArray(families) && families.length > 0) {
        setFamilyId(families[0].id);
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
      alert(err?.response?.data?.detail || 'Failed to save entry');
    } finally { setUploading(false); }
  };

  return (
    <div className="min-h-screen bg-[var(--page)]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[var(--vellum)] border-b border-[var(--border)] h-[56px]">
        <div className="max-w-2xl mx-auto px-4 h-full flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center rounded-[6px] text-[var(--ink-light)] hover:bg-[var(--seal-lighter)] transition-colors"><ChevronLeft size={20} /></button>
          <h1 className="text-[17px] font-medium text-[var(--ink)]">New Entry</h1>
          <button onClick={handleSubmit} disabled={uploading || (photos.length === 0 && !caption.trim())}
            className="px-4 py-1.5 rounded-full bg-[var(--seal)] text-[var(--page)] text-[12px] font-medium hover:bg-[var(--seal-hover)] disabled:opacity-45 transition-colors">{uploading ? 'Saving...' : 'Save Entry'}</button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 animate-fade-in-up">
        {/* Entry text */}
        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-light)] mb-[6px] font-mono text-xs uppercase tracking-[0.05em]">Your entry</label>
          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Write what's on your mind..." rows={6}
            className="w-full bg-[var(--vellum)] border border-[var(--border)] rounded-[6px] p-4 text-[15px] text-[var(--ink)] leading-[1.7] placeholder:text-[var(--ink-muted)] outline-none resize-y focus:border-[var(--seal)] transition-colors" />
        </div>

        {/* Photos */}
        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-light)] mb-[6px] font-mono text-xs uppercase tracking-[0.05em]">Photos</label>
          <div onDrop={(e) => { e.preventDefault(); setDragOver(false); handlePhotos(e.dataTransfer.files); }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-[10px] h-[120px] flex flex-col items-center justify-center cursor-pointer transition-all ${dragOver ? 'border-[var(--seal)] bg-[var(--seal-light)]' : 'border-[var(--border)] hover:border-[var(--seal)]'}`}>
            <Image size={24} className="mb-1 text-[var(--ink-muted)]" />
            <p className="text-sm text-[var(--ink-muted)]">Drop photos here or tap to upload</p>
            <p className="text-[11px] text-[var(--ink-muted)] mt-1">JPG, PNG, WebP</p>
            <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handlePhotos(e.target.files)} />
          </div>
          {previews.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {previews.map((url, i) => (
                <div key={i} className="relative group">
                  <img src={url} alt="" className="w-20 h-20 object-cover rounded-[6px] border border-[var(--border)]" />
                  <button onClick={() => removePhoto(i)} className="absolute -top-2 -right-2 w-5 h-5 bg-[var(--danger)] text-[var(--page)] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Location */}
        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-light)] mb-[6px] font-mono text-xs uppercase tracking-[0.05em]">Location</label>
          <div className="relative">
            <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Add location (optional)"
              className="w-full pl-10 pr-4 py-3 bg-[var(--vellum)] border border-[var(--border)] rounded-[6px] text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] outline-none focus:border-[var(--seal)] transition-colors" />
          </div>
        </div>
      </div>
    </div>
  );
}
