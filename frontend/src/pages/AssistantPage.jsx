import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import BottomTabBar from '../components/BottomTabBar';
import { Send, Bot, User, X, Loader2 } from 'lucide-react';

export default function AssistantPage() {
  const { family_id } = useParams();
  const navigate = useNavigate();
  const [family, setFamily] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    fetch(`/family/${family_id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('memoir_token')}` },
    }).then(r => r.json()).then(data => setFamily(data)).catch(() => {});
  }, [family_id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (msg) => {
    const text = msg || input;
    if (!text.trim() || streaming) return;

    setInput('');
    setSuggestions([]);
    setError('');

    // Add user message
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);

    // Add placeholder assistant message
    const assistantId = Date.now();
    setMessages(prev => [...prev, { role: 'assistant', content: '', id: assistantId }]);
    setStreaming(true);

    try {
      const formData = new FormData();
      formData.append('message', text);
      formData.append('family_id', family_id);

      const res = await fetch('/home/assistant/chat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('memoir_token')}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Chat request failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'token') {
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === 'assistant') {
                    last.content += data.content;
                  }
                  return updated;
                });
              } else if (data.type === 'suggestions') {
                setSuggestions(data.content);
              } else if (data.type === 'done') {
                setStreaming(false);
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to get response');
      setStreaming(false);
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === 'assistant' && !last.content) {
          last.content = 'Sorry, I encountered an error. Please try again.';
        }
        return updated;
      });
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col md:flex-row">
      <Sidebar family={family} familyId={family_id} activePage="assistant" />

      <div className="flex-1 flex flex-col" style={{ paddingBottom: 80 }}>
        {/* Header */}
        <div className="sticky top-0 z-40 bg-[var(--surface)]/95 backdrop-blur-sm border-b border-[var(--border)]">
          <div className="px-6 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-[var(--radius-sm)] bg-[var(--accent)] flex items-center justify-center">
              <Bot size={18} className="text-white" />
            </div>
            <div>
              <h1 className="font-display text-lg">Memory Assistant</h1>
              <p className="text-xs text-[var(--text-muted)]">Ask about your family's memories</p>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-3xl mx-auto w-full">
          {messages.length === 0 && (
            <div className="text-center py-16 animate-fade-in">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--accent-light)] flex items-center justify-center">
                <Bot size={32} className="text-[var(--accent)]" />
              </div>
              <h2 className="font-display text-lg mb-2">Ask me anything about your family</h2>
              <p className="text-sm text-[var(--text-secondary)] mb-6">
                I can search memories, find connections, suggest resurfacing, and more.
              </p>
              <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
                {[
                  "Who have I been neglecting?",
                  "What happened on our trips?",
                  "Tell me about Mom",
                  "What memories are due for review?",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    className="px-4 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-full hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={msg.id || i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-[var(--accent-light)] flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot size={16} className="text-[var(--accent)]" />
                </div>
              )}
              <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                <div className={`px-4 py-3 rounded-[var(--radius-lg)] text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[var(--accent)] text-white rounded-tr-sm'
                    : 'bg-[var(--surface)] border border-[var(--border)] rounded-tl-sm'
                }`}>
                  {msg.content || (msg.role === 'assistant' && i === messages.length - 1 && streaming ? (
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  ) : '')}
                </div>
                {msg.role === 'user' && (
                  <p className="text-[11px] text-[var(--text-muted)] mt-1 text-right">You</p>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center flex-shrink-0 mt-1">
                  <User size={16} className="text-white" />
                </div>
              )}
            </div>
          ))}

          {/* Suggestions */}
          {suggestions.length > 0 && !streaming && (
            <div className="flex flex-wrap gap-2 pt-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="px-3 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-full hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="px-4 py-3 bg-[var(--danger-bg)] border border-[var(--danger)]/20 rounded-[var(--radius-sm)] text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="sticky bottom-0 bg-[var(--surface)]/95 backdrop-blur-sm border-t border-[var(--border)] p-4">
          <div className="max-w-3xl mx-auto flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask about your family memories..."
              disabled={streaming}
              className="flex-1 px-4 py-3 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--accent)] text-sm outline-none transition-all"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || streaming}
              className="btn btn-primary px-4"
            >
              {streaming ? (
                <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </div>
      </div>

      <BottomTabBar familyId={family_id} activeTab="search" />
    </div>
  );
}
