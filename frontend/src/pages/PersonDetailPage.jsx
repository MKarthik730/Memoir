import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { peopleAPI } from '../lib/api';
import Sidebar from '../components/Sidebar';
import BottomTabBar from '../components/BottomTabBar';
import FloatingChatButton from '../components/FloatingChatButton';
import MemoryCard from '../components/MemoryCard';
import Avatar from '../components/ui/Avatar';
import { Plus, BookOpen, Calendar } from 'lucide-react';
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
    setPdfProgress('Crafting your memoir... (1/3) Gathering memories');
    setTimeout(() => setPdfProgress('(2/3) Arranging pages'), 1500);
    setTimeout(() => setPdfProgress('(3/3) Binding your book'), 3000);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Cover
      doc.setFillColor(124, 106, 94);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(36);
      doc.text(person?.name || 'Memoir', pageWidth / 2, pageHeight / 2 - 20, { align: 'center' });
      doc.setFontSize(14);
      doc.setTextColor(200, 200, 200);
      doc.text(`A Memoir by ${family?.name || 'Family'}`, pageWidth / 2, pageHeight / 2 + 20, { align: 'center' });
      doc.setFontSize(10);
      doc.setTextColor(180, 180, 180);
      doc.text(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth / 2, pageHeight / 2 + 40, { align: 'center' });

      // TOC
      doc.addPage();
      doc.setTextColor(124, 106, 94);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'italic');
      doc.text('Contents', pageWidth / 2, 30, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(26, 26, 26);
      memories.forEach((memory, i) => {
        const y = 60 + i * 10;
        doc.text(`${i + 1}. ${memory.title}`, 30, y);
      });

      // Memory pages
      for (const memory of memories) {
        doc.addPage();
        let yPos = 30;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(20);
        doc.setTextColor(124, 106, 94);
        const titleLines = doc.splitTextToSize(memory.title || 'Untitled', pageWidth - 40);
        doc.text(titleLines, 20, yPos);
        yPos += titleLines.length * 8 + 5;

        if (memory.memory_date) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(10);
          doc.setTextColor(107, 107, 107);
          doc.text(formatDate(memory.memory_date), 20, yPos);
          yPos += 10;
        }
        if (memory.contributor) {
          doc.setFontSize(9);
          doc.setTextColor(107, 107, 107);
          doc.text(`By ${memory.contributor.name}`, 20, yPos);
          yPos += 10;
        }
        if (memory.story_text) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(26, 26, 26);
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
      doc.setFillColor(124, 106, 94);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text('Created with Memoir', pageWidth / 2, pageHeight / 2, { align: 'center' });
      doc.setFontSize(10);
      doc.setTextColor(200, 200, 200);
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
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="var(--border)" strokeWidth="3" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-3xl mb-4">Person not found</h1>
          <Link to="/family" className="btn btn-primary">Go Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col md:flex-row">
      <Sidebar family={family} familyId={person.family_id} activePage="home" />

      <div className="flex-1 min-w-0" style={{ paddingBottom: 80 }}>
        {/* Hero */}
        <div className="relative h-[280px] md:h-[320px] overflow-hidden bg-[var(--bg)]">
          {person.photo_url ? (
            <img src={person.photo_url} alt="" className="w-full h-full object-cover" style={{ filter: 'brightness(0.75)' }} />
          ) : (
            <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #7C6A5E, #9B8B7E)' }} />
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)' }} />

          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
            <div className="flex items-end justify-between">
              <div className="flex items-center gap-5">
                <Avatar name={person.name} url={person.photo_url} size={72} className="border-[3px] border-white/80" />
                <div>
                  <h1 className="font-display text-3xl md:text-[40px] text-white">{person.name}</h1>
                  <div className="flex items-center gap-3 mt-1">
                    {person.relationship_tag && (
                      <span className="px-3 py-0.5 text-[12px] font-medium rounded-full bg-white/20 text-white backdrop-blur-sm">
                        {person.relationship_tag}
                      </span>
                    )}
                    {person.dob && (
                      <span className="text-sm text-white/80 flex items-center gap-1">
                        <Calendar size={14} />
                        Born {formatDate(person.dob)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Link to={`/people/${person_id}/add-memory`} className="btn btn-primary btn-sm">
                  <Plus size={16} />
                  <span className="hidden sm:inline">Add Memory</span>
                </Link>
                <button onClick={handleGeneratePDF} className="btn btn-secondary btn-sm">
                  <BookOpen size={16} />
                  <span className="hidden sm:inline">Memoir Book</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bio */}
        {person.bio && (
          <div className="px-6 py-5 border-b border-[var(--border)]">
            <p className="text-[var(--text-secondary)] leading-relaxed max-w-3xl mx-auto text-[14px] font-serif italic">{person.bio}</p>
          </div>
        )}

        {/* Memories */}
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-lg">Memories</h2>
            <Link to={`/people/${person_id}/add-memory`} className="btn btn-primary btn-sm">
              <Plus size={16} /> Add Memory
            </Link>
          </div>

          {memories.length === 0 ? (
            <div className="text-center py-16 animate-fade-in-up">
              <div className="w-16 h-16 mx-auto mb-4 rounded-[var(--radius-sm)] bg-[var(--bg)] flex items-center justify-center">
                <BookOpen size={28} className="text-[var(--text-muted)]" style={{ opacity: 0.5 }} />
              </div>
              <h3 className="font-display text-lg mb-2">No memories yet</h3>
              <p className="text-[var(--text-secondary)] mb-6">Add the first memory for {person.name}.</p>
              <Link to={`/people/${person_id}/add-memory`} className="btn btn-primary">
                <Plus size={16} /> Add Your First Memory
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-[var(--surface)] rounded-[var(--radius-lg)] p-8 shadow-[var(--shadow-lg)] max-w-sm w-full text-center animate-fade-in">
            <BookOpen size={36} className="mx-auto mb-4 text-[var(--accent)]" />
            <p className="text-[var(--text)] text-sm">{pdfProgress}</p>
            <div className="mt-6 h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--accent)] rounded-full animate-pulse" style={{
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
