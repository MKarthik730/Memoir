import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Archive, Upload, Image, FileText, Video, Trash2, X } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import BottomTabBar from '../components/BottomTabBar';
import { familyAPI, vaultAPI } from '../lib/api';

export default function VaultPage() {
  const navigate = useNavigate();
  const [familyId, setFamilyId] = useState(null);
  const [family, setFamily] = useState(null);
  const [items, setItems] = useState([]);
  const [folders, setFolders] = useState(['All']);
  const [activeFolder, setActiveFolder] = useState('All');
  const [activeType, setActiveType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadFolder, setUploadFolder] = useState('All');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    familyAPI.getMyFamilies().then(families => {
      if (Array.isArray(families) && families.length > 0) {
        const fid = families[0].id;
        setFamilyId(fid);
        setUploadFolder(families[0].name);
        familyAPI.get(fid).then(setFamily).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!familyId) return;
    fetchVault();
  }, [familyId, activeFolder, activeType]);

  const fetchVault = async () => {
    setLoading(true);
    try {
      const data = await vaultAPI.list(familyId, activeFolder, activeType);
      setItems(data.items || []);
      setFolders(data.folders || ['All']);
    } catch {} finally { setLoading(false); }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('family_id', familyId);
      formData.append('name', uploadName || uploadFile.name);
      formData.append('folder', uploadFolder);
      formData.append('file', uploadFile);
      await vaultAPI.upload(formData);
      setShowUpload(false);
      setUploadFile(null);
      setUploadName('');
      setPreviewUrl(null);
      fetchVault();
    } catch {} finally { setUploading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this item from the vault?')) return;
    try { await vaultAPI.delete(id); fetchVault(); } catch {}
  };

  const typeIcon = (type) => {
    switch (type) {
      case 'image': return <Image size={14} />;
      case 'document': return <FileText size={14} />;
      case 'video': return <Video size={14} />;
      default: return <FileText size={14} />;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--page)] flex flex-col md:flex-row">
      <Sidebar family={family} familyId={familyId} activePage="vault" />

      <div className="flex-1 min-w-0" style={{ paddingBottom: 80 }}>
        {/* Header */}
        <div className="sticky top-0 z-40 bg-[var(--vellum)] border-b border-[var(--border)] h-[56px]">
          <div className="max-w-4xl mx-auto px-4 h-full flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center rounded-[6px] text-[var(--ink-light)] hover:bg-[rgba(168,85,66,0.05)] transition-colors">
                <ArrowLeft size={18} />
              </button>
              <Archive size={20} className="text-[var(--seal)]" />
              <h1 className="text-[15px] font-medium text-[var(--ink)]">Family Vault</h1>
            </div>
            <button onClick={() => setShowUpload(true)} className="px-4 py-1.5 rounded-full bg-[var(--seal)] text-[var(--page)] text-[12px] font-medium hover:bg-[var(--seal-hover)] transition-colors flex items-center gap-1">
              <Upload size={14} />Upload
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
          {/* Folder chips */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
            {folders.map(f => (
              <button key={f} onClick={() => setActiveFolder(f)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-[12px] font-mono tracking-[0.03em] transition-all ${
                  activeFolder === f
                    ? 'bg-[var(--seal)] text-[var(--page)]'
                    : 'border border-[var(--border)] text-[var(--ink-light)] hover:border-[var(--seal)]'
                }`}>
                {f}
              </button>
            ))}
          </div>

          {/* Type filters */}
          <div className="flex gap-2 mb-6">
            {[
              { key: null, label: 'All' },
              { key: 'image', label: 'Photos' },
              { key: 'document', label: 'Documents' },
              { key: 'video', label: 'Videos' },
            ].map(t => (
              <button key={t.key || 'all'} onClick={() => setActiveType(t.key)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-mono transition-all ${
                  activeType === t.key
                    ? 'bg-[rgba(74,107,138,0.1)] text-[var(--postmark)]'
                    : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {[1,2,3,4,5,6].map(i => <div key={i} className="aspect-square bg-[var(--vellum)] border border-[var(--border)] rounded-[8px] animate-pulse" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-20 animate-fade-in">
              <Archive size={40} className="mx-auto mb-4 text-[var(--ink-muted)] opacity-30" />
              <div className="thread-divider max-w-[80px] mx-auto mb-6" />
              <h2 className="font-display text-xl mb-2">Nothing here yet</h2>
              <p className="text-[var(--ink-light)] text-sm max-w-sm mx-auto mb-6">Start preserving memories — upload photos, documents, and videos to your family vault.</p>
              <button onClick={() => setShowUpload(true)} className="px-6 py-3 rounded-full bg-[var(--seal)] text-[var(--page)] text-[14px] font-medium hover:bg-[var(--seal-hover)] transition-all shadow-[0_2px_8px_rgba(168,85,66,0.2)]">
                <Upload size={18} className="inline mr-2" />Upload to Vault
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {items.map((item, i) => (
                <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className="group relative bg-[var(--vellum)] border border-[var(--border)] rounded-[8px] overflow-hidden hover:shadow-[var(--shadow-md)] transition-shadow">
                  {item.file_type === 'image' ? (
                    <img src={item.file_url} alt={item.name} className="w-full h-[120px] object-cover cursor-pointer" onClick={() => setPreviewUrl(item.file_url)} />
                  ) : (
                    <div className="w-full h-[120px] flex items-center justify-center bg-[var(--page)]">
                      {typeIcon(item.file_type)}
                      <span className="text-[11px] text-[var(--ink-muted)] ml-1 font-mono">{item.file_type}</span>
                    </div>
                  )}
                  <div className="p-3">
                    <p className="text-[12px] text-[var(--ink)] truncate font-medium">{item.name}</p>
                    <p className="text-[10px] font-mono text-[var(--ink-muted)] mt-0.5">{item.uploaded_by}</p>
                  </div>
                  {item.is_admin && (
                    <button onClick={() => handleDelete(item.id)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[var(--ink)]/40 text-[var(--page)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Upload Modal */}
        {showUpload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(28,26,23,0.25)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowUpload(false)}>
            <div className="w-full max-w-[420px] bg-[var(--vellum)] rounded-[14px] shadow-[var(--shadow-lg)] animate-fade-in" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
                <h2 className="font-display text-lg">Upload to Vault</h2>
                <button onClick={() => setShowUpload(false)} className="w-8 h-8 flex items-center justify-center rounded-[6px] text-[var(--ink-muted)] hover:bg-[var(--page)] transition-colors"><X size={18} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="form-group">
                  <label>File</label>
                  <div onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-[var(--border)] rounded-[10px] p-6 text-center cursor-pointer hover:border-[var(--seal)] transition-colors">
                    {uploadFile ? (
                      <div className="flex items-center gap-2 justify-center">
                        {typeIcon(uploadFile.type.startsWith('image') ? 'image' : 'document')}
                        <span className="text-sm text-[var(--ink)]">{uploadFile.name}</span>
                      </div>
                    ) : (
                      <><Upload size={24} className="mx-auto mb-2 text-[var(--ink-muted)]" /><p className="text-sm text-[var(--ink-muted)]">Tap to choose a file</p></>
                    )}
                    <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files[0]; if (f) setUploadFile(f); }} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Name</label>
                  <input type="text" value={uploadName} onChange={e => setUploadName(e.target.value)} placeholder={uploadFile?.name || 'Item name'} />
                </div>
                <div className="form-group">
                  <label>Folder</label>
                  <input type="text" value={uploadFolder} onChange={e => setUploadFolder(e.target.value)} placeholder="Folder name" />
                </div>
                <button onClick={handleUpload} disabled={uploading || !uploadFile} className="btn btn-primary w-full">{uploading ? 'Uploading...' : 'Upload'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Lightbox */}
        {previewUrl && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(28,26,23,0.85)' }} onClick={() => setPreviewUrl(null)}>
            <img src={previewUrl} alt="" className="max-w-full max-h-[90vh] rounded-[6px] object-contain" />
          </div>
        )}

        <BottomTabBar activeTab="vault" familyId={familyId} />
      </div>
    </div>
  );
}
