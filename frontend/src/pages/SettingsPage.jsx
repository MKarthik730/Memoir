import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
        setMessage(`${provider} key saved successfully`);
        setKey('');
        fetchKeys();
      } else {
        const err = await res.json();
        setMessage(`Failed: ${err.detail || 'Could not save key'}`);
      }
    } catch { setMessage('Network error'); }
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
        setMessage(`${prov} key removed`);
        fetchKeys();
      }
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[var(--page)]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[var(--vellum)] border-b border-[var(--border)] h-[56px]">
        <div className="max-w-2xl mx-auto px-4 h-full flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center rounded-[6px] text-[var(--ink-light)] hover:bg-[rgba(168,85,66,0.05)] transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-[17px] font-medium text-[var(--ink)]">Settings</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in-up space-y-6">
        {/* API Keys Section */}
        <div className="bg-[var(--vellum)] border border-[var(--border)] rounded-[10px] p-6">
          <div className="flex items-center gap-3 mb-4">
            <Key size={20} className="text-[var(--seal)]" />
            <h2 className="font-display text-lg">API Keys</h2>
          </div>
          <p className="text-sm text-[var(--ink-light)] mb-6">
            Add your LLM provider API keys for AI-powered features. Keys are encrypted at rest.
          </p>

          {message && (
            <div className="mb-4 px-4 py-3 bg-[var(--page)] rounded-[6px] text-sm font-mono text-xs border border-[var(--border)]">
              {message}
            </div>
          )}

          {/* Existing Keys */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="skeleton h-12 rounded-[6px]" />)}
            </div>
          ) : apiKeys.length > 0 ? (
            <div className="space-y-2 mb-6">
              <p className="font-mono text-[10px] text-[var(--ink-muted)] uppercase tracking-[0.08em]">Saved Keys</p>
              {apiKeys.map((ak) => (
                <div key={ak.provider} className="flex items-center justify-between px-4 py-3 bg-[var(--page)] rounded-[6px] border border-[var(--border)]">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium capitalize">{ak.provider}</span>
                    <span className="font-mono text-[11px] text-[var(--ink-muted)]">{ak.masked_key}</span>
                  </div>
                  <button onClick={() => handleDelete(ak.provider)}
                    className="px-3 py-1.5 rounded-full bg-transparent text-[var(--danger)] border border-[var(--danger)] text-[11px] font-medium hover:bg-[var(--danger-bg)] transition-colors">
                    <Trash2 size={14} className="inline mr-1" />Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--ink-muted)] mb-6 italic">No API keys saved yet.</p>
          )}

          {/* Add Key Form */}
          <form onSubmit={handleSave} className="border-t border-[var(--border)] pt-4">
            <div className="mb-4">
              <label className="block text-[12px] font-medium text-[var(--ink-light)] mb-[6px]">Provider</label>
              <select value={provider} onChange={(e) => setProvider(e.target.value)}
                className="w-full px-3 py-3 bg-[var(--vellum)] border border-[var(--border)] rounded-[6px] text-[14px] outline-none focus:border-[var(--seal)] transition-colors">
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="groq">Groq</option>
              </select>
            </div>
            <div className="mb-5">
              <label className="block text-[12px] font-medium text-[var(--ink-light)] mb-[6px]">API Key</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder={`Enter your ${provider} API key`}
                  className="w-full px-3 py-3 bg-[var(--vellum)] border border-[var(--border)] rounded-[6px] text-[14px] outline-none focus:border-[var(--seal)] transition-colors pr-10"
                />
                <button type="button" onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] hover:text-[var(--ink)]">
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={saving || !key.trim()} className="px-5 py-2 rounded-full bg-[var(--seal)] text-[var(--page)] text-[13px] font-medium hover:bg-[var(--seal-hover)] disabled:opacity-45 transition-colors inline-flex items-center gap-1">
              {saving ? 'Saving...' : <><Check size={16} /> Save Key</>}
            </button>
          </form>
        </div>

        {/* Info */}
        <div className="p-[14px] border rounded-[8px] flex items-start gap-3" style={{ background: 'rgba(74,107,138,0.06)', borderColor: 'rgba(74,107,138,0.15)' }}>
          <Key size={16} className="text-[var(--postmark)] flex-shrink-0 mt-[2px]" />
          <div>
            <h3 className="text-[13px] font-medium text-[var(--ink)] mb-1">About API Keys</h3>
            <ul className="text-[12px] text-[var(--ink-light)] space-y-1 leading-relaxed">
              <li>Your keys are encrypted at rest using Fernet (AES-128-CBC)</li>
              <li>The server never stores your full key in plain text</li>
              <li>Keys are fetched per-request and never cached in logs</li>
              <li>Supported: OpenAI, Anthropic (Claude), or Groq</li>
              <li>No API key? You can still search and explore your family tree</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
