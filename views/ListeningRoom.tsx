
import React, { useState, useRef, useEffect } from 'react';
import { generateListeningLab, decodeBase64, decodeAudioData, getSpeech } from '../services/geminiService';
import { ListeningSession } from '../types';
import HighlightedText from '../components/HighlightedText';

const ListeningRoom: React.FC = () => {
  // Persistence
  const [session, setSession] = useState<ListeningSession | null>(() => {
    const saved = localStorage.getItem('bong_listening_session');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState('Cuộc trò chuyện tại sân bay');
  const [isPlaying, setIsPlaying] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('bong_listening_answers');
    return saved ? JSON.parse(saved) : {};
  });
  const [showResults, setShowResults] = useState(() => {
    return localStorage.getItem('bong_listening_show_results') === 'true';
  });

  const [speakingHint, setSpeakingHint] = useState<Record<string, boolean>>({});
  const [activeHintId, setActiveHintId] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  // Persistence logic
  useEffect(() => {
    if (session) {
      localStorage.setItem('bong_listening_session', JSON.stringify(session));
      // Pre-load audio if session exists
      const loadAudio = async () => {
        if (!audioContextRef.current) audioContextRef.current = new AudioContext({ sampleRate: 24000 });
        const raw = decodeBase64(session.audioBase64);
        audioBufferRef.current = await decodeAudioData(raw, audioContextRef.current);
      };
      loadAudio();
    } else {
      localStorage.removeItem('bong_listening_session');
    }
    localStorage.setItem('bong_listening_answers', JSON.stringify(userAnswers));
    localStorage.setItem('bong_listening_show_results', showResults.toString());
  }, [session, userAnswers, showResults]);

  const startSession = async () => {
    setLoading(true);
    setShowResults(false);
    setUserAnswers({});
    try {
      const data = await generateListeningLab(topic);
      setSession(data);
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const raw = decodeBase64(data.audioBase64);
      audioBufferRef.current = await decodeAudioData(raw, audioContextRef.current);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const togglePlayback = () => {
    if (!audioContextRef.current || !audioBufferRef.current) return;
    if (isPlaying) {
      sourceNodeRef.current?.stop();
      setIsPlaying(false);
    } else {
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBufferRef.current;
      source.connect(audioContextRef.current.destination);
      source.onended = () => setIsPlaying(false);
      source.start(0);
      sourceNodeRef.current = source;
      setIsPlaying(true);
    }
  };

  const handlePlayHint = async (qId: string, text: string) => {
    if (activeHintId) return;
    setActiveHintId(qId);
    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      const audioBase64 = await getSpeech(text);
      const raw = decodeBase64(audioBase64);
      const buffer = await decodeAudioData(raw, audioContextRef.current);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => setActiveHintId(null);
      source.start(0);
    } catch (err) { console.error(err); setActiveHintId(null); }
  };

  const handleAnswer = (qId: string, opt: string, correct: string) => {
    setUserAnswers(prev => ({ ...prev, [qId]: opt }));
    if (opt !== correct) {
      // Vòng lặp Học-Hỏi-Sửa
      const question = session?.questions.find(q => q.id === qId);
      if (question) handlePlayHint(qId, question.hint);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
      <p className="text-xl font-bold text-slate-800">Đang chuẩn bị âm thanh & kịch bản...</p>
    </div>
  );

  if (session) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
        <div className="flex justify-between items-center">
          <button onClick={() => { setSession(null); localStorage.removeItem('bong_listening_session'); }} className="text-slate-400 hover:text-slate-600 font-bold">← Đổi chủ đề</button>
          <div className="font-bold text-indigo-600 bg-indigo-50 px-4 py-1 rounded-full">Phòng Luyện Nghe ✨</div>
        </div>
        <div className="bg-white rounded-[3rem] p-10 shadow-xl border border-slate-100">
          <div className="flex items-center gap-6 mb-8">
            <button onClick={togglePlayback} className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl transition-all shadow-2xl ${isPlaying ? 'bg-red-500 text-white animate-pulse' : 'bg-indigo-600 text-white hover:scale-110'}`}>
              {isPlaying ? '⏹' : '▶'}
            </button>
            <div>
              <h2 className="text-3xl font-black text-slate-800">{session.title}</h2>
              <p className="text-slate-500 font-medium">Bấm nút để Cô giáo đọc cho Bông nghe nhé!</p>
            </div>
          </div>
          <div className="bg-slate-50 p-8 rounded-[2rem] mb-10 border border-slate-100 shadow-inner">
            <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Kịch bản bài nghe</h4>
            <p className="text-xl leading-relaxed text-slate-700 font-medium italic">"{session.script}"</p>
          </div>
          <div className="space-y-12">
            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
               <span className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">✍️</span>
               Kiểm tra mức độ hiểu của Bông
            </h3>
            {session.questions.map((q, idx) => {
              const currentAns = userAnswers[q.id];
              const isCorrect = currentAns === q.correctAnswer;
              const isWrong = !!currentAns && !isCorrect;

              return (
                <div key={q.id} className="space-y-4 animate-slideIn">
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-slate-800 text-lg">{idx + 1}. {q.text}</p>
                    {isWrong && !showResults && (
                      <button onClick={() => handlePlayHint(q.id, q.hint)} className="text-pink-500 font-black text-xs bg-pink-50 px-3 py-1 rounded-full animate-bounce">
                         💡 Cô gợi ý cho Bông
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {q.options?.map(opt => {
                      const isSelected = currentAns === opt;
                      let style = "bg-white border-slate-100 hover:border-indigo-300";
                      if (isSelected) {
                        if (showResults || isCorrect) style = "bg-green-50 border-green-500 text-green-700 ring-4 ring-green-100";
                        else style = "bg-red-50 border-red-500 text-red-700 ring-4 ring-red-100";
                      } else if (showResults && opt === q.correctAnswer) {
                        style = "bg-green-50 border-green-500 text-green-700";
                      }

                      return (
                        <button 
                          key={opt} 
                          disabled={showResults || isCorrect} 
                          onClick={() => handleAnswer(q.id, opt, q.correctAnswer)} 
                          className={`p-5 rounded-2xl border-2 text-left transition-all font-bold text-lg shadow-sm ${style}`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {isWrong && !showResults && activeHintId === q.id && (
                    <div className="p-4 bg-pink-50 rounded-xl border-l-4 border-pink-400 text-pink-900 italic text-sm animate-slideIn">
                       {q.hint}
                    </div>
                  )}
                  {showResults && (
                    <div className="p-4 bg-teal-50 rounded-xl border-l-4 border-teal-500 text-teal-900 text-sm italic">
                       {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
            
            {!showResults ? (
               <button onClick={() => setShowResults(true)} className="w-full bg-slate-800 text-white py-5 rounded-2xl font-black text-xl hover:bg-black transition-colors shadow-xl">Kiểm tra kết quả tổng thể 🏁</button>
            ) : (
              <button onClick={() => { setSession(null); localStorage.removeItem('bong_listening_session'); }} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-xl hover:bg-indigo-700 transition-colors shadow-xl">Hoàn thành & Thử chủ đề khác ✨</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-12">
      <div className="text-center">
        <h2 className="text-5xl font-black text-slate-800 mb-4">Lab Luyện Nghe</h2>
        <p className="text-slate-500 text-xl">Rèn luyện đôi tai với Cô giáo thông thái AI 🎧</p>
      </div>
      <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 space-y-8">
        <div>
          <label className="block text-sm font-black text-slate-700 mb-4 uppercase tracking-widest">Chủ đề Bông muốn nghe:</label>
          <input 
            type="text" 
            value={topic} 
            onChange={(e) => setTopic(e.target.value)} 
            className="w-full p-5 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 focus:outline-none text-lg font-medium bg-slate-50 shadow-inner" 
            placeholder="Ví dụ: Doraemon ở trường, Chuyến đi picnic..." 
          />
        </div>
        <button onClick={startSession} className="w-full bg-indigo-600 text-white py-6 rounded-3xl font-black text-2xl hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-indigo-100">Bắt đầu Luyện Nghe 🚀</button>
      </div>
    </div>
  );
};

export default ListeningRoom;
