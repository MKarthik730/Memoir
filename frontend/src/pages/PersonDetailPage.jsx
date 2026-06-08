import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { peopleAPI, memoriesAPI } from '../lib/api';
import Sidebar from '../components/Sidebar';
import BottomTabBar from '../components/BottomTabBar';
import MemoryCard from '../components/MemoryCard';
import { Plus, BookOpen, Loader2, ArrowLeft, Calendar, Camera } from 'lucide-react';
import { formatDate } from '../lib/api';

export default function PersonDetailPage() {
  const { person_id } = useParams();
  const navigate = useNavigate();
  const [person, setPerson] = useState(null);
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [family, setFamily] = useState(null);
  const [pdfProgress, setPdfProgress] = useState(null);

  useEffect(() => {
    fetchPersonData();
  }, [person_id]);

  const fetchPersonData = async () => {
    setLoading(true);
    try {
      const personData = await peopleAPI.get(person_id);
      setPerson(personData);
      setMemories(personData.memories || []);
      
      // Get family info
      try {
        const familyData = await fetch(`/family/${personData.family_id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('memoir_token')}` },
        }).then(r => r.json());
        setFamily(familyData);
      } catch {}
    } catch (err) {
      console.error('Failed to fetch person:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePDF = async () => {
    setPdfProgress('Crafting your memoir... (1/3) Gathering memories');
    
    // Simulate progress steps
    setTimeout(() => setPdfProgress('(2/3) Arranging pages'), 1500);
    setTimeout(() => setPdfProgress('(3/3) Binding your book'), 3000);
    
    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;
      
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Cover page
      doc.setFillColor(74, 28, 10);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      
      doc.setTextColor(250, 247, 242);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(36);
      doc.text(person?.name || 'Memoir', pageWidth / 2, pageHeight / 2 - 20, { align: 'center' });
      
      doc.setFontSize(14);
      doc.setTextColor(184, 151, 90);
      doc.text(`A Memoir by ${family?.name || 'Family'}`, pageWidth / 2, pageHeight / 2 + 20, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setTextColor(139, 115, 85);
      doc.text(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth / 2, pageHeight / 2 + 40, { align: 'center' });
      
      doc.addPage();
      
      // Table of Contents
      doc.setTextColor(74, 28, 10);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'italic');
      doc.text('Contents', pageWidth / 2, 30, { align: 'center' });
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(44, 24, 16);
      
      memories.forEach((memory, i) => {
        const y = 60 + i * 10;
        if (y > pageHeight - 30) {
          doc.addPage();
          // Reset y on new page
        }
        doc.text(`${i + 1}. ${memory.title}`, 30, y + (i >= 15 ? 40 : 0));
      });
      
      // Memory pages
      for (const memory of memories) {
        doc.addPage();
        
        let yPos = 30;
        
        // Title
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(20);
        doc.setTextColor(74, 28, 10);
        const titleLines = doc.splitTextToSize(memory.title || 'Untitled', pageWidth - 40);
        doc.text(titleLines, 20, yPos);
        yPos += titleLines.length * 8 + 5;
        
        // Date
        if (memory.memory_date) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(10);
          doc.setTextColor(139, 115, 85);
          doc.text(formatDate(memory.memory_date), 20, yPos);
          yPos += 10;
        }
        
        // Contributor
        if (memory.contributor) {
          doc.setFontSize(9);
          doc.setTextColor(139, 115, 85);
          doc.text(`By ${memory.contributor.name}`, 20, yPos);
          yPos += 10;
        }
        
        // Story
        if (memory.story_text) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(44, 24, 16);
          const storyLines = doc.splitTextToSize(memory.story_text, pageWidth - 40);
          // Check if we need a new page
          if (yPos + storyLines.length * 5 > pageHeight - 40) {
            doc.addPage();
            yPos = 30;
          }
          doc.text(storyLines, 20, yPos);
          yPos += storyLines.length * 5 + 10;
        }
        
        // Photos (max 2)
        const photos = memory.photos || [];
        for (let i = 0; i < Math.min(photos.length, 2); i++) {
          if (photos[i]?.photo_url && photos[i].photo_url.startsWith('http')) {
            try {
              const imgCanvas = await html2canvas(document.createElement('div'), {
                backgroundColor: '#FAF7F2',
              });
              // Use a placeholder since we can't load external images in jsPDF easily
              // For real photos, we'd need to load them via fetch and convert to base64
            } catch {}
          }
        }
      }
      
      // Back page
      doc.addPage();
      doc.setFillColor(74, 28, 10);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(16);
      doc.setTextColor(250, 247, 242);
      doc.text('Created with Memoir', pageWidth / 2, pageHeight / 2, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setTextColor(184, 151, 90);
      const memberNames = family?.members?.map(m => m.name).join(', ') || 'Family';
      doc.text(memberNames, pageWidth / 2, pageHeight / 2 + 20, { align: 'center' });
      
      // Save
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
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#B8975A]" />
      </div>
    );
  }

  if (!person) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-3xl text-[#4A1C0A] mb-4">Person not found</h1>
          <Link to="/family" className="btn-primary">Go Home</Link>
        </div>
      </div>
    );
  }

  const personName = person.name || 'Unknown';
  const hasPhoto = person.photo_url;

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col md:flex-row">
      <Sidebar family={family} familyId={person.family_id} activePage="home" />
      
      <div className="flex-1 pb-20 md:pb-0">
        {/* Hero Section */}
        <div className="relative h-[320px] md:h-[320px] max-md:h-[240px] overflow-hidden">
          {/* Background */}
          {hasPhoto ? (
            <img
              src={person.photo_url}
              alt=""
              className="w-full h-full object-cover"
              style={{ filter: 'sepia(0.4) brightness(0.85)' }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#B8975A] to-[#C4857A]" />
          )}
          
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#4A1C0A]" />
          
          {/* Content */}
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
            <div className="flex items-end justify-between">
              <div>
                <h1 className="font-display text-3xl md:text-[48px] text-white mb-2">{personName}</h1>
                {person.relationship_tag && (
                  <span className="inline-block px-3 py-1 rounded-full border border-[#B8975A] text-white text-sm font-ui">
                    {person.relationship_tag}
                  </span>
                )}
                {person.dob && (
                  <p className="mt-1 text-sm text-white/80 font-body italic flex items-center gap-1">
                    <Calendar size={14} />
                    Born {formatDate(person.dob)}
                  </p>
                )}
              </div>
              
              <div className="flex gap-2">
                <Link
                  to={`/people/${person_id}/add-memory`}
                  className="px-4 py-2.5 bg-[#C4857A] text-white rounded-lg font-ui text-sm hover:brightness-110 transition-all flex items-center gap-1.5"
                >
                  <Plus size={16} />
                  <span className="hidden sm:inline">Add Memory</span>
                </Link>
                <button
                  onClick={handleGeneratePDF}
                  className="px-4 py-2.5 bg-transparent border border-[#B8975A] text-[#B8975A] rounded-lg font-ui text-sm hover:brightness-110 transition-all flex items-center gap-1.5"
                >
                  <BookOpen size={16} />
                  <span className="hidden sm:inline">Memoir Book</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bio */}
        {person.bio && (
          <div className="px-6 py-6 border-b border-[rgba(184,151,90,0.15)]">
            <p className="text-[#8B7355] leading-relaxed max-w-3xl mx-auto">{person.bio}</p>
          </div>
        )}

        {/* Memories Timeline */}
        <div className="max-w-3xl mx-auto p-6">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-display text-xl text-[#2C1810]">Memories</h2>
            <Link
              to={`/people/${person_id}/add-memory`}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#C4857A] text-white rounded-lg font-ui text-sm hover:brightness-110 transition-all"
            >
              <Plus size={16} />
              Add Memory
            </Link>
          </div>

          {memories.length === 0 ? (
            <div className="text-center py-16">
              <div className="mb-6">
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="mx-auto text-[#B8975A]">
                  <rect x="10" y="15" width="60" height="50" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
                  <circle cx="28" cy="35" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
                  <path d="M18 55l12-15 8 10 10-12 14 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                </svg>
              </div>
              <h3 className="font-display text-xl text-[#2C1810] mb-2">No memories yet</h3>
              <p className="text-[#8B7355] mb-6">Add the first one.</p>
              <Link to={`/people/${person_id}/add-memory`} className="btn-primary">
                Add Your First Memory
              </Link>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-[#B8975A] hidden md:block" />
              
              <div className="space-y-6">
                {memories.map((memory, index) => (
                  <div key={memory.id} className="relative md:pl-12">
                    {/* Timeline node */}
                    <div className="hidden md:flex absolute left-0 top-6 w-10 h-10 rounded-full bg-[#B8975A] border-4 border-[#FAF7F2] items-center justify-center text-white text-xs font-ui shadow-md">
                      {index + 1}
                    </div>
                    
                    {/* Memory Card */}
                    <MemoryCard memory={memory} personName={personName} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PDF Progress Modal */}
      {pdfProgress && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#FAF7F2] rounded-xl p-8 shadow-xl border border-[rgba(184,151,90,0.2)] max-w-sm w-full mx-4 text-center">
            <BookOpen size={40} className="mx-auto mb-4 text-[#B8975A]" />
            <p className="font-body italic text-[#4A1C0A]">{pdfProgress}</p>
            <div className="mt-6 h-2 bg-[#F5F0E8] rounded-full overflow-hidden">
              <div className="h-full bg-[#B8975A] rounded-full animate-pulse" style={{ width: pdfProgress.includes('3/3') ? '90%' : pdfProgress.includes('2/3') ? '60%' : '30%' }} />
            </div>
          </div>
        </div>
      )}

      <BottomTabBar familyId={person.family_id} activeTab="home" />
    </div>
  );
}
