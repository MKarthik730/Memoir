import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { peopleAPI } from '../lib/api';
import Sidebar from '../components/Sidebar';
import BottomTabBar from '../components/BottomTabBar';
import FloatingChatButton from '../components/FloatingChatButton';
import MemoryCard from '../components/MemoryCard';
import Avatar from '../components/ui/Avatar';
import { Plus, BookOpen, Calendar, ArrowLeft } from 'lucide-react';
import { formatDate } from '../lib/api';

export default function PersonDetailPage() {
  const { person_id } = useParams();
  const navigate = useNavigate();
  const [person, setPerson] = useState(null);
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [family, setFamily] = useState(null);
  const [pdfProgress, setPdfProgress] = useState(null);

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
      doc.setFillColor(168, 85, 66);
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
      doc.setTextColor(168, 85, 66);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'italic');
      doc.text('Contents', pageWidth / 2, 30, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(28, 26, 23);
      memories.forEach((memory, i) => {
        const y = 60 + i * 10;
        doc.text(`${i + 1}. ${memory.title}`, 30, y);
      });

      // Helper: load an image URL into a data URL via canvas, returning dimensions
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
        doc.setTextColor(168, 85, 66);
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
          doc.setTextColor(107, 101, 96);
          doc.text(metaParts.join(' — '), 20, yPos);
          yPos += 12;
        }

        // Photos — load all in parallel, then render preserving aspect ratio
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
            // Compute dimensions preserving aspect ratio using pre-loaded canvas dimensions
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
          doc.setTextColor(28, 26, 23);
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
      doc.setFillColor(168, 85, 66);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text('Created with Memoir', pageWidth / 2, pageHeight / 2, { align: 'center' });
      doc.setFontSize(10);
      doc.setTextColor(200, 190, 180);
      const memberNames = family?.members?.map(m => m.name).join(', ') || 'Family';
      doc.text(memberNames, pageWidth / 2, pageHeight / 2 + 20, { align: 'center' });

      const fileName = `${(person?.name || 'Memoir').replace(/\s+/g, '_')}_Memoir_${new Date().getFullYear()}.pdf`;
      doc.save(fileName);
      setPdfProgress(null);
    } catch (err) {
      console.error('PDF generation failed:', err);
      setPdfProgress(null);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--page)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-thread-pull w-32 h-px mx-auto mb-4" />
          <p className="text-[var(--ink-muted)] text-sm font-mono text-xs tracking-wider">Opening this page...</p>
        </div>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="min-h-screen bg-[var(--page)] flex items-center justify-center">
        <div className="text-center animate-fade-in-up">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full border-1.5 border-dashed border-[var(--border)] flex items-center justify-center">
            <BookOpen size={26} className="text-[var(--ink-muted)]" style={{ opacity: 0.4 }} />
          </div>
          <h1 className="font-display text-xl mb-2">Page not found</h1>
          <p className="text-[var(--ink-light)] text-sm mb-6">This chapter doesn't seem to exist.</p>
          <Link to="/family" className="btn btn-primary">Go Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--page)] flex flex-col md:flex-row">
      <Sidebar family={family} familyId={person.family_id} activePage="home" />

      <div className="flex-1 min-w-0" style={{ paddingBottom: 80 }}>
        {/* Hero */}
        <div className="relative h-[260px] md:h-[300px] overflow-hidden bg-[var(--page)]">
          {person.photo_url ? (
            <img src={person.photo_url} alt="" className="w-full h-full object-cover" style={{ filter: 'brightness(0.7)' }} />
          ) : (
            <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #A85542, #4A6B8A)' }} />
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(28,26,23,0.6), transparent)' }} />

          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
            <div className="flex items-end justify-between">
              <div className="flex items-center gap-5">
                <Avatar name={person.name} url={person.photo_url} size={72} className="border-[3px] border-[var(--vellum)]/80" />
                <div>
                  <h1 className="font-display text-3xl md:text-[40px] text-white">{person.name}</h1>
                  <div className="flex items-center gap-3 mt-1">
                    {person.relationship_tag && (
                      <span className="px-3 py-0.5 text-[11px] rounded-full border border-white/30 text-white/90 font-mono tracking-[0.03em]">
                        {person.relationship_tag}
                      </span>
                    )}
                    {person.dob && (
                      <span className="font-mono text-[12px] text-white/80 flex items-center gap-1">
                        <Calendar size={13} />
                        Born {formatDate(person.dob)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Link to={`/people/${person_id}/add-memory`} className="btn btn-primary btn-sm">
                  <Plus size={16} />
                  <span className="hidden sm:inline">Add Entry</span>
                </Link>
                <button onClick={handleGeneratePDF} className="btn btn-secondary btn-sm">
                  <BookOpen size={16} />
                  <span className="hidden sm:inline">Bind Book</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bio */}
        {person.bio && (
          <div className="px-6 py-5 border-b border-[var(--border)]">
            <p className="text-[var(--ink-light)] leading-relaxed max-w-3xl mx-auto text-[14px] font-body italic">{person.bio}</p>
          </div>
        )}

        {/* Memories */}
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-lg">Entries</h2>
              <span className="font-mono text-[12px] text-[var(--ink-muted)]">
                {memories.length} {memories.length === 1 ? 'letter' : 'letters'}
              </span>
            </div>
            <Link to={`/people/${person_id}/add-memory`} className="btn btn-primary btn-sm">
              <Plus size={16} /> New Entry
            </Link>
          </div>

          {memories.length === 0 ? (
            <div className="empty-journal animate-fade-in-up">
              <BookOpen size={36} className="mx-auto mb-4 text-[var(--ink-muted)]" style={{ opacity: 0.3 }} />
              <div className="thread-divider max-w-[80px] mx-auto mb-6" />
              <h3 className="font-display text-xl mb-2">The first page is waiting</h3>
              <p className="text-[var(--ink-light)] text-sm max-w-xs mx-auto mb-6 leading-relaxed">
                Nothing has been written yet. Start {person.name}'s story with the first memory.
              </p>
              <Link to={`/people/${person_id}/add-memory`} className="btn-seal">
                <Plus size={18} />
                Write the First Entry
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              {memories.map((memory) => (
                <MemoryCard key={memory.id} memory={memory} personName={person.name} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PDF Progress Modal */}
      {pdfProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(28,26,23,0.3)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-[var(--vellum)] rounded-[var(--radius-md)] p-8 shadow-[var(--shadow-lg)] max-w-sm w-full text-center animate-fade-in border border-[var(--border)]">
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
      <BottomTabBar familyId={person.family_id} activeTab="home" />
    </div>
  );
}
