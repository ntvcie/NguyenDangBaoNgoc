
import React, { useState, useEffect } from 'react';
import { generateVocabSet } from '../services/geminiService';
import { VocabSet, VocabItem } from '../types';

const VocabularyRoom: React.FC = () => {
  // Persistence
  const [vocabSet, setVocabSet] = useState<VocabSet | null>(() => {
    const saved = localStorage.getItem('bong_vocab_set');
    return saved ? JSON.parse(saved) : null;
  });
  const [currentIndex, setCurrentIndex] = useState(() => {
    return parseInt(localStorage.getItem('bong_vocab_index') || '0');
  });

  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (vocabSet) {
      localStorage.setItem('bong_vocab_set', JSON.stringify(vocabSet));
    } else {
      localStorage.removeItem('bong_vocab_set');
    }
    localStorage.setItem('bong_vocab_index', currentIndex.toString());
  }, [vocabSet, currentIndex]);

  const topics = [
    { name: 'Du lịch', key: 'Travel', icon: '✈️' },
    { name: 'Công việc', key: 'Business', icon: '💼' },
    { name: 'Công nghệ', key: 'Technology', icon: '💻' },
    { name: 'Đời sống', key: 'Daily Life', icon: '🏡' },
    { name: 'Ẩm thực', key: 'Food & Dining', icon: '🍕' }
  ];

  const handleGenerate = async (t: string) => {
    setLoading(true);
    try {
      const set = await generateVocabSet(t);
      setVocabSet(set);
      setCurrentIndex(0);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <div className="w-16 h-16 border-8 border-pink-100 border-t-pink-500 rounded-full animate-spin mb-6"></div>
      <p className="font-black text-slate-700 text-xl tracking-tight">Cô đang chuẩn bị thẻ từ vựng cho Bông...</p>
    </div>
  );

  if (vocabSet) {
    const item = vocabSet.items[currentIndex];
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-pink-50 shadow-sm">
          <button onClick={() => { setVocabSet(null); localStorage.removeItem('bong_vocab_set'); }} className="text-slate-400 hover:text-pink-600 flex items-center gap-2 font-bold transition-colors">
            ← Đổi chủ đề
          </button>
          <div className="font-black text-pink-600 bg-pink-50 px-6 py-2 rounded-full shadow-sm">Chủ đề: {vocabSet.topic}</div>
        </div>

        <div className="bg-white rounded-[3.5rem] p-12 shadow-2xl border border-pink-100 flex flex-col md:flex-row gap-12 min-h-[450px] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-pink-50 rounded-bl-[5rem] -z-0 opacity-50"></div>
          
          <div className="flex-1 flex flex-col justify-center relative z-10">
            <span className="text-xs font-black text-pink-500 uppercase tracking-widest mb-4 bg-pink-50 w-fit px-3 py-1 rounded-full">
               Thẻ số {currentIndex + 1} / {vocabSet.items.length}
            </span>
            <h2 className="text-7xl font-black text-slate-800 mb-2 tracking-tight">{item.word}</h2>
            <p className="text-2xl text-slate-400 italic font-medium mb-8 bg-slate-50 w-fit px-4 py-1 rounded-xl shadow-inner">{item.ipa}</p>
            
            <div className="space-y-6">
              <div className="p-6 bg-teal-50 rounded-[2rem] border-l-8 border-teal-500 shadow-sm">
                <h4 className="font-black text-teal-700 text-xs mb-2 uppercase tracking-widest">Ý nghĩa</h4>
                <p className="text-slate-800 text-xl font-bold">{item.definition}</p>
              </div>
              <div className="p-6 bg-pink-50 rounded-[2rem] border-l-8 border-pink-500 shadow-sm">
                <h4 className="font-black text-pink-700 text-xs mb-2 uppercase tracking-widest">Ví dụ thực tế</h4>
                <p className="text-pink-900 italic text-lg leading-relaxed font-medium">"{item.example}"</p>
              </div>
            </div>
          </div>

          <div className="w-full md:w-72 flex flex-col justify-center gap-4 relative z-10">
             <button onClick={() => setCurrentIndex(prev => (prev + 1) % vocabSet.items.length)} className="w-full bg-pink-500 text-white py-6 rounded-3xl font-black text-xl shadow-xl shadow-pink-100 hover:scale-105 active:scale-95 transition-all">Tiếp theo ➜</button>
             <button onClick={() => setCurrentIndex(prev => (prev - 1 + vocabSet.items.length) % vocabSet.items.length)} className="w-full bg-slate-100 text-slate-500 py-6 rounded-3xl font-black text-xl hover:bg-slate-200 transition-all">Quay lại</button>
             <div className="mt-4 p-4 text-center">
                <span className="text-8xl">🎓</span>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-12 animate-fadeIn">
      <div className="text-center">
        <h2 className="text-6xl font-black text-slate-800 tracking-tight">Kho Từ Vựng 📚</h2>
        <p className="text-slate-500 text-2xl mt-4 font-medium">Mở rộng vốn từ cùng Cô giáo thông thái mỗi ngày!</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {topics.map(t => (
          <button key={t.key} onClick={() => handleGenerate(t.key)} className="p-10 bg-white rounded-[3rem] border-2 border-slate-50 shadow-sm hover:border-pink-500 hover:shadow-2xl hover:translate-y-[-8px] transition-all text-left group">
            <div className="text-5xl mb-6 bg-pink-50 w-20 h-20 rounded-[1.5rem] flex items-center justify-center group-hover:scale-110 group-hover:rotate-12 transition-all">{t.icon}</div>
            <h3 className="text-2xl font-black text-slate-800 group-hover:text-pink-600 mb-2">{t.name}</h3>
            <p className="text-slate-400 font-medium">Học 8 từ vựng quan trọng & ví dụ hay.</p>
          </button>
        ))}
      </div>

      <div className="bg-gradient-to-br from-pink-500 via-pink-400 to-purple-600 p-12 rounded-[4rem] text-white shadow-2xl relative overflow-hidden border-4 border-white">
        <div className="relative z-10">
          <h3 className="text-3xl font-black mb-6 flex items-center gap-3">
             <span className="animate-bounce">✨</span> Bông muốn học chủ đề đặc biệt nào?
          </h3>
          <div className="flex flex-col md:flex-row gap-4">
            <input 
              type="text" 
              value={topic} 
              onChange={(e) => setTopic(e.target.value)} 
              placeholder="Ví dụ: Pokemon, Barbie, Vũ trụ bao la..." 
              className="flex-1 p-6 rounded-[2rem] text-slate-800 focus:outline-none text-xl font-bold shadow-inner" 
            />
            <button onClick={() => handleGenerate(topic)} className="bg-white text-pink-600 px-12 py-6 rounded-[2rem] font-black text-2xl hover:scale-105 active:scale-95 transition-all shadow-xl">Bắt đầu ngay!</button>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
      </div>
    </div>
  );
};

export default VocabularyRoom;
