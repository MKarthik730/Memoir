import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import BottomTabBar from '../components/BottomTabBar';
import { MessageCircle, Send, ArrowLeft, Loader2 } from 'lucide-react';

export default function AssistantPage() {
  const { family_id } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [family, setFamily] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetch(`/family/${family_id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('memoir_token')}` },
    }).then(r => r.json()).then(data => setFamily(data)).catch(() => {});
  }, [family_id]);

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

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

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
    <div className="min-h-screen bg-[var(--page)] flex flex-col md:flex-row">
      <Sidebar family={family} familyId={family_id} activePage="assistant" />

      <div className="flex-1 flex flex-col min-w-0" style={{ paddingBottom: 80 }}>
        {/* Header */}
        <div className="sticky top-0 z-40 bg-[var(--page)]/95 backdrop-blur-sm border-b border-[var(--border)]">
          <div className="px-6 py-5 max-w-3xl mx-auto flex items-center gap-3">
            <button onClick={() => navigate(`/family/${family_id}`)} className="btn-icon">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="font-display text-lg">Memory Assistant</h1>
              <p className="font-mono text-[11px] text-[var(--ink-muted)] tracking-[0.03em]">Ask about your archive</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-2xl mx-auto space-y-6">
            {conversation.length === 0 && !streaming && (
              <div className="text-center py-16 animate-fade-in">
                <div className="w-16 h-16 mx-auto mb-5 rounded-full border-2 border-[var(--seal)] flex items-center justify-center">
                  <MessageCircle size={28} className="text-[var(--seal)]" />
                </div>
                <h2 className="font-display text-xl mb-2">Ask about your family</h2>
                <p className="text-[var(--ink-light)] text-sm max-w-sm mx-auto leading-relaxed">
                  I can search your memories, find connections between family members, and surface stories you might have forgotten.
                </p>
                <div className="thread-divider max-w-[80px] mx-auto my-6" />

                {/* Suggestions */}
                <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
                  {[
                    "Who have I been neglecting?",
                    "What memories are due for review?",
                    "Tell me about a trip",
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => { setMessage(s); }}
                      className="px-4 py-2 rounded-full border border-[var(--border)] text-[13px] text-[var(--ink-light)] hover:border-[var(--seal)] hover:text-[var(--seal)] transition-colors bg-[var(--vellum)]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {conversation.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-[var(--seal)] flex items-center justify-center flex-shrink-0 mr-3 mt-1">
                    <MessageCircle size={14} className="text-[var(--page)]" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] px-5 py-3 rounded-[var(--radius-md)] ${
                    msg.role === 'user'
                      ? 'bg-[var(--seal)] text-[var(--page)] rounded-br-[4px]'
                      : 'bg-[var(--vellum)] border border-[var(--border)] text-[var(--ink)] rounded-bl-[4px]'
                  }`}
                >
                  <p className="text-[14px] leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                    {msg.role === 'assistant' && i === conversation.length - 1 && streaming && (
                      <span className="inline-block w-2 h-4 bg-[var(--seal)] ml-1 animate-pulse" style={{ verticalAlign: 'middle' }} />
                    )}
                  </p>
                </div>
              </div>
            ))}

            {/* Suggestions after response */}
            {suggestions.length > 0 && !streaming && (
              <div className="animate-fade-in">
                <div className="thread-divider max-w-[60px] mb-4" />
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setMessage(s); }}
                      className="px-4 py-2 rounded-full border border-[var(--border)] text-[13px] text-[var(--ink-light)] hover:border-[var(--seal)] hover:text-[var(--seal)] transition-colors bg-[var(--vellum)]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="sticky bottom-0 bg-[var(--page)]/95 backdrop-blur-sm border-t border-[var(--border)] px-6 py-4">
          <div className="max-w-2xl mx-auto flex gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your memories..."
                disabled={streaming}
                className="w-full px-5 py-3 rounded-full bg-[var(--vellum)] border border-[var(--border)] focus:border-[var(--seal)] text-[var(--ink)] font-body text-sm outline-none transition-all"
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!message.trim() || streaming}
              className="w-11 h-11 rounded-full bg-[var(--seal)] text-[var(--page)] hover:bg-[var(--seal-hover)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95 flex-shrink-0"
            >
              {streaming ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </div>
      </div>

      <BottomTabBar familyId={family_id} activeTab="assistant" />
    </div>
  );
}
