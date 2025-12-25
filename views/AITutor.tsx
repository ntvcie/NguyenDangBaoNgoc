
import React, { useState, useRef, useEffect } from 'react';
import { chatWithTutor } from '../services/geminiService';
import { ChatMessage } from '../types';

const AITutor: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', content: "Hello! I'm your EnglishPro AI Tutor. How can I help you improve your English today? You can ask me about grammar, help you with a sentence, or practice a conversation.", timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const response = await chatWithTutor(history, input);
      setMessages(prev => [...prev, { role: 'model', content: response, timestamp: Date.now() }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', content: "Sorry, I encountered an error. Please try again later.", timestamp: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-12rem)] flex flex-col bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-xl">🤖</div>
          <div>
            <h2 className="font-bold text-slate-800">EnglishPro Tutor</h2>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-xs text-slate-400 font-medium">Always online</span>
            </div>
          </div>
        </div>
        <button className="text-slate-400 hover:text-slate-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
        </button>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar"
      >
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl p-4 ${
              msg.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-br-none' 
                : 'bg-slate-100 text-slate-800 rounded-bl-none'
            }`}>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              <p className={`text-[10px] mt-2 opacity-60 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-2xl p-4 flex gap-1">
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></div>
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
        <input 
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your question here..."
          className="flex-1 px-5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-white"
        />
        <button 
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-6 h-6 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
        </button>
      </form>
    </div>
  );
};

export default AITutor;
