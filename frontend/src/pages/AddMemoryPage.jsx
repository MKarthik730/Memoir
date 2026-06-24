import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { memoriesAPI, peopleAPI } from '../lib/api';
import { ArrowLeft, Image, Mic, Upload, X, Check } from 'lucide-react';

export default function AddMemoryPage() {
  const { person_id } = useParams();
  const navigate = useNavigate();
  const [person, setPerson] = useState(null);
  const [form, setForm] = useState({ title: '', story_text: '', memory_date: '' });
  const [photos, setPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [voiceNote, setVoiceNote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordingTimer, setRecordingTimer] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    peopleAPI.get(person_id).then(data => setPerson(data)).catch(() => {});
  }, [person_id]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const handlePhotoAdd = (files) => {
    const fileArray = Array.from(files);
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const invalid = fileArray.find(f => !validTypes.includes(f.type));
    if (invalid) { setError('Only JPG, PNG, and WebP images are allowed'); return; }
    setError('');
    setPhotos([...photos, ...fileArray]);
    setPhotoPreviews([...photoPreviews, ...fileArray.map(f => URL.createObjectURL(f))]);
  };

  const removePhoto = (index) => {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotos(photos.filter((_, i) => i !== index));
    setPhotoPreviews(photoPreviews.filter((_, i) => i !== index));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioUrl(URL.createObjectURL(blob));
        setVoiceNote(new File([blob], 'voice_note.webm', { type: 'audio/webm' }));
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setRecording(true);
      setRecordingTimer(0);
      timerRef.current = setInterval(() => setRecordingTimer(t => t + 1), 1000);
    } catch (err) {
      if (err.name === 'NotAllowedError') setError('Microphone access denied.');
      else if (err.name === 'NotFoundError') setError('No microphone found.');
      else setError('Recording unavailable.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('title', form.title);
      if (form.story_text) formData.append('story_text', form.story_text);
      if (form.memory_date) formData.append('memory_date', form.memory_date);
      photos.forEach(photo => formData.append('photos', photo));
      if (voiceNote) formData.append('voice_note', voiceNote);
      await memoriesAPI.create(person_id, formData);
      navigate(`/people/${person_id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save memory');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--page)]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[var(--vellum)] border-b border-[var(--border)] h-[56px]">
        <div className="max-w-2xl mx-auto px-4 h-full flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center rounded-[6px] text-[var(--ink-light)] hover:bg-[rgba(168,85,66,0.05)] transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-[17px] font-medium text-[var(--ink)]">Write a New Entry</h1>
            {person && <p className="text-[13px] text-[var(--ink-muted)] italic">For {person.name}</p>}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in-up">
        {error && (
          <div className="mb-6 px-4 py-3 bg-[var(--danger-bg)] border border-[var(--danger)]/20 rounded-[6px] text-[var(--danger)] text-[13px] flex items-center gap-2 font-mono text-xs">
            <X size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Title — handwritten feel */}
          <div className="mb-6">
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Give this letter a title..."
              required
              className="w-full font-display text-[20px] text-[var(--ink)] placeholder:text-[var(--ink-muted)] bg-transparent border-0 border-b-[1.5px] border-[var(--border)] outline-none pb-2 focus:border-[var(--seal)] transition-colors"
              style={{ borderRadius: 0 }}
            />
          </div>

          {/* Letter textarea */}
          <div className="mb-6">
            <textarea
              value={form.story_text}
              onChange={(e) => setForm({ ...form, story_text: e.target.value })}
              placeholder="Write your memory here..."
              rows={8}
              className="w-full min-h-[180px] text-[14px] text-[var(--ink)] leading-[1.8] border border-[var(--border)] rounded-[6px] p-[14px] outline-none resize-y focus:border-[var(--seal)] transition-colors placeholder:text-[var(--ink-muted)]"
            />
          </div>

          {/* Thread divider */}
          <div className="thread-line mb-6" />

          {/* Date */}
          <div className="mb-6">
            <label className="block text-[12px] font-medium text-[var(--ink-light)] mb-[6px]">Date</label>
            <input
              type="date"
              value={form.memory_date}
              onChange={(e) => setForm({ ...form, memory_date: e.target.value })}
              className="postmark-input w-auto"
            />
          </div>

          {/* Photos */}
          <div className="mb-6">
            <label className="block text-[12px] font-medium text-[var(--ink-light)] mb-[6px]">Photos</label>
            <div
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handlePhotoAdd(e.dataTransfer.files); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-[10px] h-[100px] flex flex-col items-center justify-center cursor-pointer transition-all ${
                dragOver ? 'border-[var(--seal)] bg-[rgba(168,85,66,0.04)]' : 'border-[var(--border)] hover:border-[var(--seal)]'
              }`}
            >
              <Image size={24} className="mb-1 text-[var(--ink-muted)]" />
              <p className="text-[13px] text-[var(--ink-muted)]">Add photos</p>
              <p className="text-[11px] text-[var(--ink-muted)] mt-1">JPG, PNG, WebP</p>
              <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={(e) => handlePhotoAdd(e.target.files)} />
            </div>

            {photoPreviews.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {photoPreviews.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt="" className="w-[72px] h-[72px] object-cover rounded-[6px] border border-[var(--border)]" />
                    <button type="button" onClick={() => removePhoto(i)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-[var(--danger)] text-[var(--page)] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Voice Note */}
          <div className="mb-8">
            <label className="block text-[12px] font-medium text-[var(--ink-light)] mb-[6px]">Voice Note</label>
            <div className="flex gap-3 items-center">
              <button type="button" onClick={recording ? stopRecording : startRecording}
                className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all ${
                  recording ? 'border-[var(--danger)] bg-[var(--danger-bg)] shadow-[0_0_0_4px_rgba(184,69,58,0.2)]' : 'border-[var(--seal)] text-[var(--seal)] hover:bg-[var(--seal-light)]'
                }`}>
                <Mic size={20} className={recording ? 'animate-pulse text-[var(--danger)]' : ''} />
              </button>
              {recording && (
                <div className="flex items-center gap-2 font-mono text-[13px] text-[var(--ink-muted)]">
                  <span className="w-2 h-2 rounded-full bg-[var(--danger)] animate-pulse" />
                  Recording {formatTimer(recordingTimer)}
                </div>
              )}
              <label className="flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--border)] text-[var(--ink-light)] hover:border-[var(--seal)] transition-all cursor-pointer bg-[var(--vellum)] text-[13px]">
                <Upload size={16} />
                Upload
                <input type="file" accept=".mp3,.m4a,.webm,audio/*" className="hidden"
                  onChange={(e) => { const file = e.target.files[0]; if (file) { setVoiceNote(file); setAudioUrl(URL.createObjectURL(file)); } }} />
              </label>
            </div>
            {audioUrl && (
              <div className="mt-3 p-3 bg-[var(--page)] rounded-[6px] border border-[var(--postmark)]/20">
                <audio controls src={audioUrl} className="w-full h-10" />
                <button type="button" onClick={() => { setAudioUrl(''); setVoiceNote(null); }}
                  className="mt-1 text-xs text-[var(--danger)] hover:underline">Remove</button>
              </div>
            )}
          </div>

          {/* Thread divider */}
          <div className="thread-divider mb-6">
            <span className="thread-divider-dot" />
          </div>

          <button type="submit" disabled={loading || !form.title.trim()}
            className="w-full h-[48px] rounded-full bg-[var(--seal)] text-[var(--page)] text-[14px] font-medium hover:bg-[var(--seal-hover)] disabled:opacity-45 transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(168,85,66,0.2)]">
            {loading ? (
              <><svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg> Saving your letter...</>
            ) : (
              <><Check size={18} /> Save Letter</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
