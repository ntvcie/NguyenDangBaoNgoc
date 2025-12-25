
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { chatWithTutor, getSpeech } from '../services/geminiService';
import { ChatMessage } from '../types';
import { useTask } from '../context/TaskContext';

// Manual implementation of encode for raw PCM data
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Manual implementation of decode for raw PCM data
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Manual implementation of decodeAudioData as per guidelines
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

interface GlobalTutorProps {
  isOpen: boolean;
  onClose: () => void;
  onWidthChange: (width: number) => void;
  onResizingChange: (isResizing: boolean) => void;
}

const GlobalTutor: React.FC<GlobalTutorProps> = ({ isOpen, onClose, onWidthChange, onResizingChange }) => {
  const { currentTask, autoExplainRequest, referenceDocs, removeReferenceDoc } = useTask();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', content: "Chào Bông! Cô là cô giáo thông thái của con đây. Con có chỗ nào chưa hiểu không? Đặc biệt con có thể dán (Paste) ảnh bài tập vào đây để cô giải thích, hoặc nhấn nút Micro phía dưới để nói chuyện trực tiếp với cô nhé!", timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [pastedImage, setPastedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [playingMessageIndex, setPlayingMessageIndex] = useState<number | null>(null);
  
  // Resize logic states
  const [width, setWidth] = useState(384); 
  const [isResizing, setIsResizing] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const lastProcessedTimestamp = useRef<number>(0);

  // Constants for resizing
  const MIN_WIDTH = 320;
  const MAX_WIDTH = 800;
  const MIN_FONT_SIZE = 13;
  const MAX_FONT_SIZE = 22;

  // Calculate dynamic font size based on width
  const fontSize = MIN_FONT_SIZE + (width - MIN_WIDTH) / (MAX_WIDTH - MIN_WIDTH) * (MAX_FONT_SIZE - MIN_FONT_SIZE);

  // Tự động xử lý yêu cầu giải thích từ việc bôi đen
  useEffect(() => {
    if (autoExplainRequest && autoExplainRequest.timestamp > lastProcessedTimestamp.current) {
      lastProcessedTimestamp.current = autoExplainRequest.timestamp;
      
      const autoPrompt = `Bông vừa chọn đoạn văn bản này: "${autoExplainRequest.selectedText}". 
      Nó nằm trong câu ngữ cảnh: "${autoExplainRequest.contextText}". 
      Cô hãy giải thích ý nghĩa, cấu trúc ngữ pháp hoặc cách phát âm liên quan đến phần này giúp Bông nhé. Hãy tham khảo các bí kíp lý thuyết nếu cần.`;
      
      handleAutoMessage(autoPrompt, autoExplainRequest.selectedText);
    }
  }, [autoExplainRequest]);

  const handleAutoMessage = async (prompt: string, displayLabel: string) => {
    if (loading) return;

    const userMsg: ChatMessage = { 
      role: 'user', 
      content: `[Cô ơi, giải thích giúp con: "${displayLabel}"]`, 
      timestamp: Date.now() 
    };
    
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const response = await chatWithTutor(
        history, 
        prompt, 
        undefined,
        currentTask || undefined,
        referenceDocs
      );
      setMessages(prev => [...prev, { role: 'model', content: response, timestamp: Date.now() }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', content: "Cô xin lỗi, hệ thống của cô đang gặp chút trục trặc. Bông thử lại sau nhé!", timestamp: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    onResizingChange(true);
  }, [onResizingChange]);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    onResizingChange(false);
  }, [onResizingChange]);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setWidth(newWidth);
        onWidthChange(newWidth);
      }
    }
  }, [isResizing, onWidthChange]);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isOpen]);

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              setPastedImage(event.target.result as string);
            }
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const handlePlaySpeech = async (text: string, index: number) => {
    if (playingMessageIndex !== null) return;
    setPlayingMessageIndex(index);
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      const base64Audio = await getSpeech(text);
      if (base64Audio) {
        const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => setPlayingMessageIndex(null);
        source.start(0);
      } else {
        setPlayingMessageIndex(null);
      }
    } catch (err) {
      console.error("Lỗi phát âm thanh:", err);
      setPlayingMessageIndex(null);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !pastedImage) || loading) return;

    const currentImage = pastedImage;
    const userMsg: ChatMessage = { 
      role: 'user', 
      content: input || (currentImage ? "[Đã gửi một hình ảnh]" : ""), 
      timestamp: Date.now() 
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setPastedImage(null);
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const response = await chatWithTutor(
        history, 
        input || "Hãy xem hình ảnh này và giúp con giải thích nhé.", 
        currentImage || undefined,
        currentTask || undefined,
        referenceDocs
      );
      setMessages(prev => [...prev, { role: 'model', content: response, timestamp: Date.now() }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', content: "Cô xin lỗi, hệ thống của cô đang gặp chút trục trặc. Bông thử lại sau nhé!", timestamp: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  const startVoiceMode = async () => {
    if (isVoiceMode) {
      stopVoiceMode();
      return;
    }
    setIsVoiceMode(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    audioContextRef.current = outputAudioContext;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let systemInstruction = `Bạn là Cô giáo thông thái của Bông. Xưng là Cô, gọi học sinh là Bông. 
      GIỌNG NÓI YÊU CẦU: Hãy luôn trả lời bằng GIỌNG NỮ MIỀN BẮC, truyền cảm, nhẹ nhàng và ấm áp.
      Nguyên tắc phát âm cốt lõi (CHỈ SỬ DỤNG KHI CẦN): "Vô thanh đi với vô thanh, hữu thanh đi với hữu thanh" (Ngưu tầm ngưu, mã tầm mã).
      - Phát âm S/ES: /s/ sau vô thanh (thời phong kiến phương tây), /iz/ sau âm rít (sáu sung sướng...), /z/ sau hữu thanh.
      - Phát âm ED: /id/ sau t, d (tiêu dùng), /t/ sau vô thanh (chính phủ Pháp không thích xem sổ sách.), /d/ sau hữu thanh.
      Chỉ đem kiến thức phát âm ra giảng khi bài tập hoặc câu hỏi của Bông có liên quan đến âm đuôi S-ES-ED.
      TUYỆT ĐỐI KHÔNG đưa ra đáp án trực tiếp trừ khi Bông yêu cầu chính xác.`;
      
      if (currentTask) {
        systemInstruction += `\n\nBối cảnh: Bông đang làm bài "${currentTask.quizTitle}". Câu hỏi: "${currentTask.questionText}". Đáp án đúng (KHÔNG TIẾT LỘ): "${currentTask.correctAnswer}".`;
      }

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            const source = inputAudioContext.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
              const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContext.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              const ctx = outputAudioContext;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => sourcesRef.current.delete(source);
            }
          },
          onclose: () => setIsVoiceMode(false),
          onerror: (e) => { console.error(e); setIsVoiceMode(false); }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          systemInstruction
        }
      });
      sessionRef.current = sessionPromise;
    } catch (err) {
      console.error(err);
      setIsVoiceMode(false);
    }
  };

  const stopVoiceMode = () => {
    setIsVoiceMode(false);
    if (sessionRef.current) sessionRef.current.then((s: any) => s.close());
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
  };

  return (
    <div 
      className={`fixed inset-y-0 right-0 bg-white shadow-2xl z-50 transform border-l-4 border-purple-200 flex flex-col global-tutor-container ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      style={{ 
        width: `${width}px`, 
        maxWidth: '100vw',
        transition: isResizing ? 'none' : 'transform 300ms ease-in-out, width 300ms ease-in-out'
      }}
    >
      {/* Resize handle */}
      <div 
        onMouseDown={startResizing}
        className={`absolute inset-y-0 -left-1 w-3 cursor-ew-resize hover:bg-purple-400/20 transition-colors z-[60] flex items-center justify-center ${isResizing ? 'bg-purple-500/10' : ''}`}
        title="Kéo sang trái để mở rộng bảng chat"
      >
        <div className={`w-1 h-16 bg-purple-300 rounded-full transition-all ${isResizing ? 'scale-x-150 bg-purple-500' : ''}`}></div>
      </div>

      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-lg shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-3xl animate-bounce">👩‍🏫</span>
          <div className="overflow-hidden">
            <h3 className="font-bold text-lg leading-tight truncate">Cô giáo thông thái</h3>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full whitespace-nowrap">AI Tutor ✨</span>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors shrink-0 ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Reference Docs List */}
      {referenceDocs.length > 0 && (
        <div className="bg-white border-b border-purple-100 p-3 shrink-0 flex gap-2 overflow-x-auto custom-scrollbar items-center">
          <span className="text-[10px] font-black text-purple-500 uppercase shrink-0">📖 Bí kíp của Bông:</span>
          {referenceDocs.map(doc => (
            <div key={doc.id} className="relative group shrink-0">
              <div className="w-10 h-10 rounded-lg border border-purple-200 overflow-hidden shadow-sm bg-purple-50 flex items-center justify-center">
                {doc.mimeType.startsWith('image/') ? (
                  <img src={doc.imageBase64} className="w-full h-full object-cover" alt={doc.name} />
                ) : (
                  <span className="text-xl">📄</span>
                )}
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); removeReferenceDoc(doc.id); }}
                className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full text-[10px] flex items-center justify-center shadow-2xl border border-white z-20 hover:scale-110 active:scale-95 transition-all"
                title="Cô không xem tài liệu này nữa"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Context Badge */}
      <div className="bg-purple-100/50 p-2 text-[10px] text-purple-700 font-black border-b border-purple-100 flex items-center gap-2 overflow-hidden shrink-0">
        <span className="animate-pulse shrink-0">●</span>
        <span className="truncate uppercase tracking-tight">{currentTask ? `Bối cảnh: ${currentTask.quizTitle}` : "Cô luôn lắng nghe Bông!"}</span>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-purple-50/20"
        style={{ fontSize: `${fontSize}px` }}
      >
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn items-end gap-2`}>
            {msg.role === 'model' && (
              <button 
                onClick={() => handlePlaySpeech(msg.content, i)}
                className={`p-2 rounded-full bg-white shadow-sm border border-slate-100 hover:scale-110 transition-transform mb-1 ${playingMessageIndex === i ? 'animate-pulse text-pink-500 ring-2 ring-pink-200' : 'text-slate-400'}`}
                title="Cô giáo đọc cho con nghe"
              >
                {playingMessageIndex === i ? '🔊' : '🔈'}
              </button>
            )}
            <div 
              className={`max-w-[85%] p-4 rounded-3xl shadow-sm border ${msg.role === 'user' ? 'bg-purple-600 text-white rounded-tr-none border-purple-500' : 'bg-white text-slate-800 rounded-tl-none border-slate-100'}`}
              style={{ lineHeight: '1.6' }}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && <div className="text-purple-400 text-xs animate-pulse italic flex items-center gap-2 px-2">
          <span className="w-2 h-2 bg-purple-400 rounded-full animate-ping shrink-0"></span>
          Cô đang viết...
        </div>}
      </div>

      {/* Voice Mode */}
      {isVoiceMode && (
        <div className="absolute inset-0 bg-purple-600/95 flex flex-col items-center justify-center text-white p-8 z-10 animate-fadeIn text-center">
          <div className="w-32 h-32 rounded-full border-8 border-white/20 flex items-center justify-center relative">
             <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center animate-pulse">
                <span className="text-5xl text-purple-600">🎙️</span>
             </div>
             <div className="absolute inset-0 rounded-full border-4 border-white animate-ping opacity-20"></div>
          </div>
          <h4 className="text-2xl font-bold mt-8 mb-2">Bông nói đi, Cô đang nghe!</h4>
          <p className="text-white/60 text-sm mb-12">Cô sẽ trả lời Bông tự nhiên và dễ nghe nhất.</p>
          <button onClick={stopVoiceMode} className="bg-pink-500 hover:bg-pink-600 text-white px-10 py-4 rounded-full font-black shadow-2xl transition-all active:scale-95">Dừng trò chuyện</button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 bg-white border-t-2 border-slate-100 flex flex-col gap-3 relative shrink-0">
        {pastedImage && (
          <div className="absolute bottom-full left-4 mb-2 animate-slideIn">
            <div className="relative p-1 bg-white border-2 border-teal-500 rounded-2xl shadow-xl">
              <img src={pastedImage} alt="Preview" className="w-24 h-24 object-cover rounded-xl" />
              <button type="button" onClick={() => setPastedImage(null)} className="absolute -top-3 -right-3 w-7 h-7 bg-pink-500 text-white rounded-full flex items-center justify-center shadow-lg">✕</button>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            onPaste={handlePaste}
            placeholder="Bông muốn hỏi gì cô..." 
            className="flex-1 p-3 rounded-2xl border-2 border-slate-100 focus:outline-none focus:border-purple-500 text-sm shadow-inner" 
            style={{ fontSize: `${Math.max(14, fontSize * 0.85)}px` }}
          />
          <button type="submit" disabled={loading} className="bg-purple-600 text-white p-3 rounded-2xl shadow-lg hover:bg-purple-700 transition-colors disabled:opacity-50 shrink-0">
            <svg className="w-5 h-5 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </div>
        <button type="button" onClick={startVoiceMode} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-2xl font-black shadow-lg flex items-center justify-center gap-2 hover:brightness-110 transition-all text-sm">
          <span>🎙️</span> Chat giọng nói với Cô
        </button>
      </form>
    </div>
  );
};

export default GlobalTutor;
