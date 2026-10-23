import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { peopleAPI } from '../lib/api';
import Sidebar from '../components/Sidebar';
import BottomTabBar from '../components/BottomTabBar';
import FloatingChatButton from '../components/FloatingChatButton';
import MemoryCard from '../components/MemoryCard';
import Avatar from '../components/ui/Avatar';
import { Plus, BookOpen, Calendar, ArrowLeft, Camera, X } from 'lucide-react';
import { formatDate, memoriesAPI } from '../lib/api';
import { useToast } from '../components/ui';

export default function PersonDetailPage() {
  const { person_id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isPersonalDiary = new URLSearchParams(location.search).get('diary') === '1';
  const [person, setPerson] = useState(null);
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [family, setFamily] = useState(null);
  const [pdfProgress, setPdfProgress] = useState(null);
  const [editingMemory, setEditingMemory] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', story_text: '', memory_date: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const profilePhotoInput = useRef(null);
  const toast = useToast();
  const currentUser = JSON.parse(localStorage.getItem('memoir_user') || '{}') || {};
  const currentUserId = currentUser.id;
  const memoryPath = `/people/${person_id}/add-memory${isPersonalDiary ? '?diary=1' : ''}`;

  useEffect(() => { fetchPersonData(); }, [person_id]);

  const fetchPersonData = async () => {
    setLoading(true);
    try {
      const personData = await peopleAPI.get(person_id);
      setPerson(personData);
      setMemories(personData.memories || []);
      try {
        const familyData = await fetch(`/family/${personData.family_id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('memoir_token')}` },
        }).then(r => r.json());
        setFamily(familyData);
      } catch {}
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePDF = async () => {
    setPdfProgress('Crafting your memoir... (1/3) Gathering pages');
    setTimeout(() => setPdfProgress('(2/3) Arranging letters'), 1500);
    setTimeout(() => setPdfProgress('(3/3) Binding your book'), 3000);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Cover
      doc.setFillColor(47, 93, 70);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(36);
      doc.text(person?.name || 'Memoir', pageWidth / 2, pageHeight / 2 - 20, { align: 'center' });
      doc.setFontSize(14);
      doc.setTextColor(230, 220, 210);
      doc.text(`A Memoir by ${family?.name || 'Family'}`, pageWidth / 2, pageHeight / 2 + 20, { align: 'center' });
      doc.setFontSize(10);
      doc.setTextColor(200, 190, 180);
      doc.text(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth / 2, pageHeight / 2 + 40, { align: 'center' });

      // TOC
      doc.addPage();
      doc.setTextColor(47, 93, 70);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'italic');
      doc.text('Contents', pageWidth / 2, 30, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(36, 31, 26);
      memories.forEach((memory, i) => {
        const y = 60 + i * 10;
        doc.text(`${i + 1}. ${memory.title}`, 30, y);
      });

      const loadImageToDataUrl = (url) => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            resolve({ dataUrl, width: img.naturalWidth, height: img.naturalHeight });
          };
          img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
          img.src = url;
        });
      };

      // Memory pages
      for (const memory of memories) {
        doc.addPage();
        let yPos = 30;

        // Title
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(20);
        doc.setTextColor(47, 93, 70);
        const titleLines = doc.splitTextToSize(memory.title || 'Untitled', pageWidth - 40);
        doc.text(titleLines, 20, yPos);
        yPos += titleLines.length * 8 + 5;

        // Date + Contributor
        const metaParts = [];
        if (memory.memory_date) metaParts.push(formatDate(memory.memory_date));
        if (memory.contributor?.name) metaParts.push(`By ${memory.contributor.name}`);
        if (metaParts.length) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(10);
          doc.setTextColor(107, 98, 85);
          doc.text(metaParts.join(' — '), 20, yPos);
          yPos += 12;
        }

        // Photos
        const photoList = memory.photos || [];
        const photoDataUrls = await Promise.allSettled(
          photoList.slice(0, 4).map((p) => loadImageToDataUrl(p.photo_url))
        );
        const loadedPhotos = photoDataUrls
          .filter((r) => r.status === 'fulfilled')
          .map((r) => r.value);

        if (loadedPhotos.length > 0) {
          const imgWidth = pageWidth - 40;
          const maxImgHeight = 80;
          for (const { dataUrl, width, height } of loadedPhotos) {
            const aspectRatio = width / height;
            let renderW = imgWidth;
            let renderH = imgWidth / aspectRatio;
            if (renderH > maxImgHeight) {
              renderH = maxImgHeight;
              renderW = maxImgHeight * aspectRatio;
            }
            const offsetX = 20 + (imgWidth - renderW) / 2;

            if (yPos + renderH + 8 > pageHeight - 30) {
              doc.addPage();
              yPos = 30;
            }
            doc.addImage(dataUrl, 'JPEG', offsetX, yPos, renderW, renderH);
            yPos += renderH + 6;
          }
        }

        // Story text
        if (memory.story_text) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(36, 31, 26);
          const storyLines = doc.splitTextToSize(memory.story_text, pageWidth - 40);
          if (yPos + storyLines.length * 5 > pageHeight - 40) {
            doc.addPage();
            yPos = 30;
          }
          doc.text(storyLines, 20, yPos);
        }
      }

      // Back
      doc.addPage();
      doc.setFillColor(47, 93, 70);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text('Created with Memoir', pageWidth / 2, pageHeight / 2, { align: 'center' });
      doc.setFontSize(10);
      doc.setTextColor(200, 190, 180);
      doc.text(family?.name || 'Family archive', pageWidth / 2, pageHeight / 2 + 20, { align: 'center' });

      const fileName = `${(person?.name || 'Memoir').replace(/\s+/g, '_')}_Memoir_${new Date().getFullYear()}.pdf`;
      doc.save(fileName);
      setPdfProgress(null);
    } catch (err) {
      console.error('PDF generation failed:', err);
      setPdfProgress(null);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const startEditingMemory = (memory) => {
    setEditingMemory(memory);
    setEditForm({
      title: memory.title || '',
      story_text: memory.story_text || '',
      memory_date: memory.memory_date || '',
    });
    setEditError('');
  };

  const handleUpdateMemory = async (event) => {
    event.preventDefault();
    if (!editForm.title.trim()) return;
    setSavingEdit(true);
    setEditError('');
    try {
      const formData = new FormData();
      formData.append('title', editForm.title.trim());
      formData.append('story_text', editForm.story_text);
      formData.append('memory_date', editForm.memory_date);
      const updated = await memoriesAPI.update(editingMemory.id, formData);
      setMemories((current) => current.map((memory) => memory.id === updated.id ? updated : memory));
      setEditingMemory(null);
    } catch (err) {
      setEditError(err.response?.data?.detail || 'Could not update this entry.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteMemory = async (memory) => {
    if (!window.confirm(`Delete "${memory.title}" from your diary?`)) return;
    try {
      await memoriesAPI.delete(memory.id);
      setMemories((current) => current.filter((entry) => entry.id !== memory.id));
    } catch (err) {
      window.alert(err.response?.data?.detail || 'Could not delete this entry.');
    }
  };

  const handleProfilePhotoChange = async (event) => {
    const photo = event.target.files?.[0];
    if (!photo) return;

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('photo', photo);
      const updatedPerson = await peopleAPI.update(person_id, formData);
      setPerson(updatedPerson);
      toast('Profile photo updated.', 'success');
    } catch (err) {
      console.error('Failed to update profile photo:', err);
      toast(err.response?.data?.detail || 'Could not update the profile photo.', 'error');
    } finally {
      setUploadingPhoto(false);
      event.target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--page)] flex items-center justify-center">
        <div className="text-center">
          <div className="thread-line w-32 mx-auto mb-4" />
          <p className="text-[var(--ink-muted)] text-sm font-mono text-xs tracking-wider">Opening this page...</p>
        </div>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="min-h-screen bg-[var(--page)] flex items-center justify-center">
        <div className="text-center animate-fade-in-up">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full border-[1.5px] border-dashed border-[var(--border)] flex items-center justify-center">
            <BookOpen size={26} className="text-[var(--ink-muted)] opacity-40" />
          </div>
          <h1 className="font-display text-xl mb-2">Page not found</h1>
          <p className="text-[var(--ink-light)] text-sm mb-6">This chapter doesn't seem to exist.</p>
          <Link to="/family" className="px-4 py-2 rounded-full bg-[var(--seal)] hover:bg-[var(--seal-hover)] transition-colors" style={{ color: 'var(--page)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>Go Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--page)] flex flex-col md:flex-row">
      <Sidebar familyId={person.family_id} activePage={isPersonalDiary ? 'diary' : 'journal'} />

      <div className="flex-1 min-w-0" style={{ paddingBottom: 80 }}>
        {/* Hero */}
        <div className="relative h-[240px] overflow-hidden">
          {person.photo_url ? (
            <img src={person.photo_url} alt="" className="w-full h-full object-cover" style={{ filter: 'brightness(0.78)' }} />
          ) : (
            <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #526B5B 0%, #735A62 100%)' }} />
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(42,38,34,0.18) 0%, transparent 72%)' }} />

          <div className="absolute bottom-0 left-0 right-0 px-6 pb-6">
            {isPersonalDiary && <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--vellum)]/80 mb-1">My Diary</p>}
            <h1 className="font-display text-[26px] text-[var(--page)] mb-1">{person.name}</h1>
            <div className="flex items-center gap-3">
              {person.relationship_tag && (
                <span className="px-3 py-0.5 text-[11px] rounded-full border border-[var(--vellum)]/30 text-[var(--vellum)]/90 font-mono tracking-[0.03em]">
                  {person.relationship_tag}
                </span>
              )}
              {person.dob && (
                <span className="font-mono text-[12px] text-[var(--vellum)]/80 flex items-center gap-1">
                  <Calendar size={13} />
                  Born {formatDate(person.dob)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Avatar overlap */}
        <div className="relative z-10 px-6" style={{ marginTop: -36 }}>
          <div className="flex items-end justify-between">
            <div className="relative">
              <Avatar
                name={person.name}
                url={person.photo_url}
                size={72}
                className="border-[3px] border-[var(--bg)]"
              />
              <button
                type="button"
                onClick={() => profilePhotoInput.current?.click()}
                disabled={uploadingPhoto}
                className="profile-photo-button"
                aria-label={uploadingPhoto ? 'Uploading profile photo' : 'Add or change profile photo'}
                title={uploadingPhoto ? 'Uploading photo...' : 'Add or change profile photo'}
              >
                <Camera />
              </button>
              <input
                ref={profilePhotoInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handleProfilePhotoChange}
              />
            </div>
            <div className="flex gap-2 pb-1">
              <Link to={memoryPath} className="diary-action diary-action--primary">
                <Plus />Add Entry
              </Link>
              <button onClick={handleGeneratePDF} className="diary-action diary-action--secondary">
                <BookOpen />Bind Book
              </button>
          </div>
        </div>
        </div>

        {/* Bio */}
        {person.bio && (
          <div className="px-6 py-5 border-b border-[var(--border)]">
            <p className="text-[var(--ink-light)] leading-relaxed max-w-3xl mx-auto text-[14px] italic">{person.bio}</p>
          </div>
        )}

        {/* Memories */}
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-lg">{isPersonalDiary ? 'Diary Entries' : 'Entries'}</h2>
              <span className="font-mono text-[12px] text-[var(--ink-muted)]">
                {memories.length} {memories.length === 1 ? 'letter' : 'letters'}
              </span>
            </div>
            <Link to={memoryPath} className="diary-action diary-action--primary">
              <Plus />New Entry
            </Link>
          </div>

          {memories.length === 0 ? (
            <div className="text-center py-16 animate-fade-in-up">
              <BookOpen size={36} className="mx-auto mb-4 text-[var(--ink-muted)] opacity-30" />
              <div className="thread-divider max-w-[80px] mx-auto mb-6" />
              <h3 className="font-display text-xl mb-2">The first page is waiting</h3>
              <p className="text-[var(--ink-light)] text-sm max-w-xs mx-auto mb-6 leading-relaxed">
                Nothing has been written yet. Start {person.name}'s story with the first memory.
              </p>
              <Link to={memoryPath} className="diary-action diary-action--primary">
                <Plus />Write the First Entry
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {memories.map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                personName={person.name}
                onEdit={isPersonalDiary && memory.created_by_user_id === currentUserId ? startEditingMemory : undefined}
                onDelete={isPersonalDiary && memory.created_by_user_id === currentUserId ? handleDeleteMemory : undefined}
              />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PDF Progress Modal */}
      {editingMemory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={() => setEditingMemory(null)}>
          <form onSubmit={handleUpdateMemory} className="w-full max-w-lg rounded-[14px] border border-[var(--border)] bg-[var(--vellum)] p-6 shadow-[var(--shadow-lg)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg">Edit diary entry</h2>
              <button type="button" onClick={() => setEditingMemory(null)} className="btn-icon" aria-label="Close edit dialog"><X size={18} /></button>
            </div>
            {editError && <p role="alert" className="mb-4 text-sm text-[var(--danger)]">{editError}</p>}
            <label className="block text-xs font-medium text-[var(--ink-light)] mb-2" htmlFor="diary-title">Title</label>
            <input id="diary-title" value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} required className="mb-4" />
            <label className="block text-xs font-medium text-[var(--ink-light)] mb-2" htmlFor="diary-story">Entry</label>
            <textarea id="diary-story" value={editForm.story_text} onChange={(event) => setEditForm({ ...editForm, story_text: event.target.value })} rows={6} className="mb-4" />
            <label className="block text-xs font-medium text-[var(--ink-light)] mb-2" htmlFor="diary-date">Date</label>
            <input id="diary-date" type="date" value={editForm.memory_date} onChange={(event) => setEditForm({ ...editForm, memory_date: event.target.value })} className="mb-5" />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setEditingMemory(null)} className="btn btn-secondary">Cancel</button>
              <button type="submit" disabled={savingEdit} className="btn btn-primary">{savingEdit ? 'Saving...' : 'Save changes'}</button>
            </div>
          </form>
        </div>
      )}

      {pdfProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(36,31,26,0.3)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-[var(--vellum)] rounded-[14px] p-8 shadow-[var(--shadow-lg)] max-w-sm w-full text-center animate-fade-in border border-[var(--border)]">
            <BookOpen size={36} className="mx-auto mb-4 text-[var(--seal)]" />
            <p className="text-[var(--ink)] text-sm font-mono text-xs tracking-wider">{pdfProgress}</p>
            <div className="mt-6 h-1.5 bg-[var(--page)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--seal)] rounded-full animate-pulse" style={{
                width: pdfProgress.includes('3/3') ? '90%' : pdfProgress.includes('2/3') ? '60%' : '30%',
                transition: 'width 0.5s ease'
              }} />
            </div>
          </div>
        </div>
      )}

      <FloatingChatButton familyId={person.family_id} />
      <BottomTabBar familyId={person.family_id} activeTab={isPersonalDiary ? 'diary' : 'journal'} />
    </div>
  );
}
