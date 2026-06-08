import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { memoriesAPI } from '../lib/api';
import { ArrowLeft, Image, Mic, Upload, X, Loader2, Check } from 'lucide-react';

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
    fetch(`/people/${person_id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('memoir_token')}` },
    })
      .then(r => r.json())
      .then(data => setPerson(data))
      .catch(() => {});
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
    if (invalid) {
      setError('Only JPG, PNG, and WebP images are allowed');
      return;
    }
    setError('');
    const newPhotos = [...photos, ...fileArray];
    setPhotos(newPhotos);
    
    // Create previews
    const newPreviews = fileArray.map(f => URL.createObjectURL(f));
    setPhotoPreviews([...photoPreviews, ...newPreviews]);
  };

  const removePhoto = (index) => {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotos(photos.filter((_, i) => i !== index));
    setPhotoPreviews(photoPreviews.filter((_, i) => i !== index));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handlePhotoAdd(e.dataTransfer.files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  // Voice Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setVoiceNote(new File([blob], 'voice_note.webm', { type: 'audio/webm' }));
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setRecording(true);
      setRecordingTimer(0);
      timerRef.current = setInterval(() => {
        setRecordingTimer(t => t + 1);
      }, 1000);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Use upload instead.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Use upload instead.');
      } else {
        setError('Recording unavailable. Use upload instead.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
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
      
      photos.forEach(photo => {
        formData.append('photos', photo);
      });
      
      if (voiceNote) {
        formData.append('voice_note', voiceNote);
      }
      
      await memoriesAPI.create(person_id, formData);
      navigate(`/people/${person_id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save memory');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[rgba(250,247,242,0.95)] backdrop-blur-sm border-b border-[rgba(184,151,90,0.15)] px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 text-[#8B7355] hover:text-[#2C1810]">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-display text-lg text-[#4A1C0A]">Add Memory</h1>
            {person && <p className="text-xs text-[#8B7355] font-body italic">For {person.name}</p>}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
            <X size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Title */}
          <div className="mb-6">
            <label className="block mb-1.5 text-xs font-ui tracking-wider uppercase text-[#8B7355]">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Give your memory a title..."
              required
              className="w-full px-4 py-3 rounded-lg bg-[#F5F0E8] border border-[rgba(184,151,90,0.3)] focus:border-[#B8975A] text-[#2C1810] font-display text-lg outline-none transition-all"
            />
          </div>

          {/* Story */}
          <div className="mb-6">
            <label className="block mb-1.5 text-xs font-ui tracking-wider uppercase text-[#8B7355]">Story</label>
            <textarea
              value={form.story_text}
              onChange={(e) => setForm({ ...form, story_text: e.target.value })}
              placeholder="Write your memory here..."
              rows={6}
              className="w-full px-4 py-3 rounded-lg bg-[#F5F0E8] border border-[rgba(184,151,90,0.3)] focus:border-[#B8975A] text-[#2C1810] font-body text-base outline-none transition-all resize-none"
              style={{ minHeight: '120px' }}
            />
          </div>

          {/* Date */}
          <div className="mb-6">
            <label className="block mb-1.5 text-xs font-ui tracking-wider uppercase text-[#8B7355]">Date</label>
            <input
              type="date"
              value={form.memory_date}
              onChange={(e) => setForm({ ...form, memory_date: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-[#F5F0E8] border border-[rgba(184,151,90,0.3)] focus:border-[#B8975A] text-[#2C1810] font-ui text-sm outline-none transition-all"
            />
          </div>

          {/* Photos */}
          <div className="mb-6">
            <label className="block mb-1.5 text-xs font-ui tracking-wider uppercase text-[#8B7355]">Photos</label>
            
            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragOver ? 'border-[#B8975A] bg-[rgba(184,151,90,0.05)]' : 'border-[rgba(184,151,90,0.3)] hover:border-[#B8975A]'
              }`}
            >
              <Image size={32} className="mx-auto mb-2 text-[#B8975A]" />
              <p className="text-sm text-[#8B7355]">Drop photos here or click to browse</p>
              <p className="text-xs text-[#8B7355] mt-1">JPG, PNG, WebP</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handlePhotoAdd(e.target.files)}
              />
            </div>

            {/* Photo Previews */}
            {photoPreviews.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {photoPreviews.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-[rgba(184,151,90,0.2)]" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Voice Note */}
          <div className="mb-8">
            <label className="block mb-1.5 text-xs font-ui tracking-wider uppercase text-[#8B7355]">Voice Note</label>
            <div className="flex gap-3">
              {/* Record */}
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-all ${
                  recording
                    ? 'bg-red-50 border-red-300 text-red-500 animate-pulse'
                    : 'bg-[#F5F0E8] border-[rgba(184,151,90,0.3)] text-[#2C1810] hover:border-[#B8975A]'
                }`}
              >
                <Mic size={18} className={recording ? 'text-red-500' : ''} />
                <span className="text-sm font-ui">
                  {recording ? `Recording ${formatTimer(recordingTimer)}` : 'Record'}
                </span>
              </button>

              {/* Upload */}
              <label className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#F5F0E8] border border-[rgba(184,151,90,0.3)] text-[#2C1810] hover:border-[#B8975A] transition-all cursor-pointer">
                <Upload size={18} />
                <span className="text-sm font-ui">Upload</span>
                <input
                  type="file"
                  accept=".mp3,.m4a,.webm,audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setVoiceNote(file);
                      setAudioUrl(URL.createObjectURL(file));
                    }
                  }}
                />
              </label>
            </div>

            {/* Audio playback */}
            {audioUrl && (
              <div className="mt-3 p-3 bg-[#F5F0E8] rounded-lg">
                <audio controls src={audioUrl} className="w-full h-10" />
                <button
                  type="button"
                  onClick={() => { setAudioUrl(''); setVoiceNote(null); }}
                  className="mt-1 text-xs text-red-500 hover:underline"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !form.title.trim()}
            className="w-full py-4 bg-[#C4857A] hover:brightness-110 text-white rounded-xl font-ui text-sm tracking-wider uppercase transition-all active:scale-[0.97] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 size={18} className="animate-spin" /> Saving your memory...</>
            ) : (
              <><Check size={18} /> Save Memory</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
