import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Key, Trash2, Check, Eye, EyeOff } from 'lucide-react';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState('openai');
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => { fetchKeys(); }, []);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const res = await fetch('/home/settings/api-key', {
        headers: { Authorization: `Bearer ${localStorage.getItem('memoir_token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data);
      }
    } catch {} finally { setLoading(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!key.trim()) return;
    setSaving(true);
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('provider', provider);
      formData.append('key', key);
      const res = await fetch('/home/settings/api-key', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('memoir_token')}` },
        body: formData,
      });
      if (res.ok) {
        setMessage(`✅ ${provider} key saved successfully`);
        setKey('');
        fetchKeys();
      } else {
        const err = await res.json();
        setMessage(`❌ ${err.detail || 'Failed to save key'}`);
      }
    } catch { setMessage('❌ Network error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (prov) => {
    if (!confirm(`Remove your ${prov} API key?`)) return;
    try {
      const res = await fetch(`/home/settings/api-key?provider=${prov}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('memoir_token')}` },
      });
      if (res.ok) {
        setMessage(`✅ ${prov} key removed`);
        fetchKeys();
      }
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="max-w-2xl mx-auto px-6 py-8 animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate(-1)} className="btn-icon">
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-display text-xl">Settings</h1>
        </div>

        {/* API Keys Section */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Key size={20} className="text-[var(--accent)]" />
            <h2 className="font-display text-lg">API Keys</h2>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            Add your LLM provider API keys for AI-powered features.
            Keys are encrypted at rest and never stored in plain text.
          </p>

          {message && (
            <div className="mb-4 px-4 py-3 bg-[var(--bg)] rounded-[var(--radius-sm)] text-sm">
              {message}
            </div>
          )}

          {/* Existing Keys */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="skeleton h-12 rounded-[var(--radius-sm)]" />)}
            </div>
          ) : apiKeys.length > 0 ? (
            <div className="space-y-2 mb-6">
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Saved Keys</p>
              {apiKeys.map((ak) => (
                <div key={ak.provider} className="flex items-center justify-between px-4 py-3 bg-[var(--bg)] rounded-[var(--radius-sm)]">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium capitalize">{ak.provider}</span>
                    <span className="text-xs text-[var(--text-muted)] font-mono">{ak.masked_key}</span>
                  </div>
                  <button onClick={() => handleDelete(ak.provider)}
                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)] mb-6 italic">No API keys saved yet.</p>
          )}

          {/* Add Key Form */}
          <form onSubmit={handleSave} className="border-t border-[var(--border)] pt-4">
            <div className="flex gap-3 mb-3">
              <div className="flex-1">
                <label>Provider</label>
                <select value={provider} onChange={(e) => setProvider(e.target.value)}>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="groq">Groq</option>
                </select>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>API Key</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder={`Enter your ${provider} API key`}
                />
                <button type="button" onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]">
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={saving || !key.trim()} className="btn btn-primary btn-sm">
              {saving ? 'Saving...' : <><Check size={16} /> Save Key</>}
            </button>
          </form>
        </div>

        {/* Info */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6">
          <h3 className="font-display text-base mb-2">About API Keys</h3>
          <ul className="text-sm text-[var(--text-secondary)] space-y-2">
            <li>• Your keys are encrypted at rest using Fernet (AES-128-CBC)</li>
            <li>• The server never stores your full key in plain text</li>
            <li>• Keys are fetched per-request and never cached in logs</li>
            <li>• Supported: OpenAI, Anthropic (Claude), or Groq</li>
            <li>• No API key? You can still search and explore your family tree</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
