import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageCircle, Send, ArrowLeft, Loader2 } from 'lucide-react';

export default function AssistantPage() {
  const { family_id } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  const handleSend = async () => {
    if (!message.trim() || streaming) return;
    const userMessage = message;
    setMessage('');
    setConversation(prev => [...prev, { role: 'user', content: userMessage }]);
    setStreaming(true);
    setSuggestions([]);

    try {
      const formData = new FormData();
      formData.append('message', userMessage);
      formData.append('family_id', family_id);

      const response = await fetch('/home/assistant/chat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('memoir_token')}` },
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to get response');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      setConversation(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'token') {
                assistantMessage += data.content;
                setConversation(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: assistantMessage };
                  return updated;
                });
              } else if (data.type === 'suggestions') {
                setSuggestions(data.content || []);
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      setConversation(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I had trouble connecting. Please try again.',
      }]);
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen bg-[var(--page)] flex flex-col">
      {/* Header */}
      <div className="bg-[var(--vellum)] border-b border-[var(--border)] h-[56px] flex items-center px-4 gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center rounded-[6px] text-[var(--ink-light)] hover:bg-[rgba(168,85,66,0.05)] transition-colors flex-shrink-0">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[var(--seal)] flex items-center justify-center flex-shrink-0">
            <MessageCircle size={16} className="text-[var(--vellum)]" />
          </div>
          <div>
            <h1 className="text-[15px] font-medium text-[var(--ink)]">Memory Assistant</h1>
            <p className="text-[11px] font-mono text-[var(--ink-muted)]">Ask about your family archive</p>
          </div>
        </div>
        <button className="px-3 py-1.5 rounded-full bg-transparent text-[var(--ink-muted)] text-[11px] font-mono hover:bg-[rgba(168,85,66,0.05)] hover:text-[var(--ink)] transition-colors">
          Clear chat
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 112px)' }}>
        <div className="flex-1 overflow-y-auto px-4 py-8" style={{ scrollBehavior: 'smooth' }}>
          <div className="max-w-2xl mx-auto">
            {conversation.length === 0 && !streaming && (
              <div className="flex flex-col items-center justify-center min-h-[400px] animate-fade-in">
                <div className="w-11 h-11 rounded-full border-[1.5px] border-[var(--seal)] flex items-center justify-center mb-5">
                  <MessageCircle size={20} className="text-[var(--seal)]" />
                </div>
                <h2 className="font-display text-[20px] text-[var(--ink)] mb-2">Ask about your family</h2>
                <p className="text-[13px] text-[var(--ink-light)] max-w-[280px] text-center mb-6 leading-relaxed">
                  I can search your memories, find connections, and surface stories you might have forgotten.
                </p>
                <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                  {[
                    "Who have I been neglecting?",
                    "What memories are due for review?",
                    "Tell me about a trip",
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => setMessage(s)}
                      className="px-4 py-2 rounded-full border border-[var(--border)] text-[12px] text-[var(--ink-light)] bg-[var(--vellum)] hover:bg-[rgba(168,85,66,0.06)] hover:text-[var(--seal)] transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4">
              {conversation.map((msg, i) => (
                <div
                  key={i}
                  style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
                  className="animate-fade-in"
                >
                  {msg.role === 'assistant' && (
                    <div className="flex-shrink-0 mr-3" style={{ minWidth: 32 }}>
                      <div className="w-8 h-8 rounded-full bg-[var(--seal)] flex items-center justify-center">
                        <MessageCircle size={14} className="text-[var(--page)]" />
                      </div>
                    </div>
                  )}
                  <div>
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[11px] text-[var(--seal)] font-medium">Memoir</span>
                      </div>
                    )}
                    <div
                      className={`px-4 py-[10px] text-[13px] leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-[var(--seal)] text-[var(--page)]'
                          : 'bg-[var(--vellum)] border border-[var(--border)] text-[var(--ink)]'
                      }`}
                      style={{
                        borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        maxWidth: '75%',
                      }}
                    >
                      {msg.content}
                      {msg.role === 'assistant' && i === conversation.length - 1 && streaming && (
                        <span className="inline-block" style={{ width: 2, height: 13, background: 'var(--seal)', borderRadius: 1, marginLeft: 2, verticalAlign: 'middle', animation: 'blink 1s infinite' }} />
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {suggestions.length > 0 && !streaming && (
                <div className="flex flex-wrap gap-2 animate-fade-in" style={{ marginLeft: 40 }}>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setMessage(s)}
                      className="px-4 py-2 rounded-full border border-[var(--border)] text-[12px] text-[var(--ink-light)] bg-[var(--vellum)] hover:bg-[rgba(168,85,66,0.06)] hover:text-[var(--seal)] transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* Input bar */}
        <div className="bg-[var(--vellum)] border-t border-[var(--border)]" style={{ height: 60, padding: '0 16px', display: 'flex', alignItems: 'center' }}>
          <div className="max-w-2xl mx-auto relative" style={{ width: '100%' }}>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your memories..."
              disabled={streaming}
              style={{
                width: '100%', height: 40, borderRadius: 999, border: '1px solid var(--border)',
                background: 'var(--page)', padding: '0 48px 0 16px',
                fontSize: 13, color: 'var(--ink)', outline: 'none',
              }}
              className="focus:border-[var(--seal)] transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!message.trim() || streaming}
              style={{
                position: 'absolute', right: 3, top: '50%', transform: 'translateY(-50%)',
                width: 34, height: 34, borderRadius: '50%', background: 'var(--seal)',
                color: 'var(--page)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              className="disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--seal-hover)]"
            >
              {streaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
