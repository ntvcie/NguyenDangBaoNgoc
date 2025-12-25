
import React, { useState, useRef, useEffect } from 'react';
import { generateQuizFromDocument, getExplanation, getSpeech, decodeBase64, decodeAudioData } from '../services/geminiService';
import { Quiz, UserDocument } from '../types';
import HighlightedText from '../components/HighlightedText';
import { useTask } from '../context/TaskContext';

const DocumentLibrary: React.FC = () => {
  const { setCurrentTask, addReferenceDoc, referenceDocs, removeReferenceDoc } = useTask();
  
  const [documents, setDocuments] = useState<UserDocument[]>(() => {
    const saved = localStorage.getItem('bong_documents');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [extractedQuizzesMap, setExtractedQuizzesMap] = useState<Record<string, Quiz[]>>(() => {
    const saved = localStorage.getItem('bong_quizzes_map');
    return saved ? JSON.parse(saved) : {};
  });

  const [activeDocId, setActiveDocId] = useState<string | null>(() => localStorage.getItem('bong_active_doc_id'));
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(() => {
    const saved = localStorage.getItem('bong_selected_quiz');
    return saved ? JSON.parse(saved) : null;
  });

  const [loading, setLoading] = useState(false);
  const [reviewQuizzes, setReviewQuizzes] = useState<{ docId: string, quizzes: Quiz[] } | null>(null);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(() => {
    const saved = localStorage.getItem('bong_quiz_index');
    return saved ? parseInt(saved) : 0;
  });
  
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('bong_user_answers');
    return saved ? JSON.parse(saved) : {};
  });

  const [textInput, setTextInput] = useState('');
  const [answerImage, setAnswerImage] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speakingHint, setSpeakingHint] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [hintDuration, setHintDuration] = useState(0);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setIsAutoSaving(true);
    localStorage.setItem('bong_documents', JSON.stringify(documents));
    localStorage.setItem('bong_quizzes_map', JSON.stringify(extractedQuizzesMap));
    localStorage.setItem('bong_user_answers', JSON.stringify(userAnswers));
    localStorage.setItem('bong_quiz_index', currentQuestionIndex.toString());
    if (activeDocId) localStorage.setItem('bong_active_doc_id', activeDocId);
    if (selectedQuiz) localStorage.setItem('bong_selected_quiz', JSON.stringify(selectedQuiz));
    const timer = setTimeout(() => setIsAutoSaving(false), 800);
    return () => clearTimeout(timer);
  }, [documents, extractedQuizzesMap, userAnswers, currentQuestionIndex, selectedQuiz, activeDocId]);

  useEffect(() => {
    if (selectedQuiz && selectedQuiz.questions[currentQuestionIndex]) {
      const q = selectedQuiz.questions[currentQuestionIndex];
      setCurrentTask({
        quizTitle: selectedQuiz.title,
        questionText: q.text,
        hint: q.hint,
        correctAnswer: q.correctAnswer,
        userAnswer: userAnswers[q.id]
      });
    } else {
      setCurrentTask(null);
    }
  }, [selectedQuiz, currentQuestionIndex, userAnswers, setCurrentTask]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const newDoc: UserDocument = {
            id: Date.now().toString(),
            name: file.name,
            imageBase64: event.target.result as string,
            mimeType: file.type,
            timestamp: Date.now()
          };
          setDocuments(prev => [newDoc, ...prev]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProcessDocument = async (doc: UserDocument) => {
    if (extractedQuizzesMap[doc.id]) { setActiveDocId(doc.id); return; }
    setLoading(true);
    try {
      const quizzes = await generateQuizFromDocument(doc.imageBase64, doc.mimeType);
      // Thay vì lưu ngay, ta chuyển sang chế độ review
      setReviewQuizzes({ docId: doc.id, quizzes });
    } catch (error) {
      console.error(error);
      alert("Cô giáo xin lỗi, cô không trích xuất được bài tập. Bông hãy thử lại nhé!");
    } finally { setLoading(false); }
  };

  const confirmQuizzes = () => {
    if (reviewQuizzes) {
      setExtractedQuizzesMap(prev => ({ ...prev, [reviewQuizzes.docId]: reviewQuizzes.quizzes }));
      setActiveDocId(reviewQuizzes.docId);
      setReviewQuizzes(null);
    }
  };

  const startQuiz = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setCurrentQuestionIndex(0);
    setExplanation(null);
    setShowHint(false);
    setTextInput('');
    setAnswerImage(null);
  };

  const handleAnswerSelect = (questionId: string, answer: string) => {
    if (!selectedQuiz) return;
    const q = selectedQuiz.questions[currentQuestionIndex];
    const isCorrect = q.type === 'multiple-choice' 
      ? answer === q.correctAnswer
      : answer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();

    setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
    if (!isCorrect) {
      setShowHint(true);
      handlePlayAudio(q.hint, true);
    } else {
      setShowHint(false);
    }
  };

  const handleAnswerPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) setAnswerImage(event.target.result as string);
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuiz) return;
    const q = selectedQuiz.questions[currentQuestionIndex];
    handleAnswerSelect(q.id, textInput || (answerImage ? "[Bông đã nộp bằng ảnh]" : ""));
  };

  const handleExplain = async () => {
    if (!selectedQuiz) return;
    const q = selectedQuiz.questions[currentQuestionIndex];
    setExplaining(true);
    try {
      const exp = await getExplanation(q.text, userAnswers[q.id] || "Bông chưa trả lời", q.correctAnswer, answerImage || undefined);
      setExplanation(exp);
      handlePlayAudio(exp, false);
    } catch (err) { console.error(err); } finally { setExplaining(false); }
  };

  const handlePlayAudio = async (text: string, isHint: boolean = false) => {
    if (speaking || speakingHint) return;
    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      const audioBase64 = await getSpeech(text);
      const raw = decodeBase64(audioBase64);
      const audioBuffer = await decodeAudioData(raw, audioContextRef.current);
      if (isHint) { setHintDuration(audioBuffer.duration); setSpeakingHint(true); } 
      else { setAudioDuration(audioBuffer.duration); setSpeaking(true); }
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => { setSpeaking(false); setSpeakingHint(false); };
      source.start(0);
    } catch (err) { console.error(err); setSpeaking(false); setSpeakingHint(false); }
  };

  const deleteDocument = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Ngăn chặn sự kiện click lan ra ngoài làm mở tài liệu
    
    if (window.confirm("Bông có chắc chắn muốn xóa tài liệu này không?")) {
      removeReferenceDoc(id);
      setDocuments(prev => prev.filter(d => d.id !== id));
      setExtractedQuizzesMap(prev => {
        const newMap = { ...prev };
        delete newMap[id];
        return newMap;
      });
      if (activeDocId === id) {
        setActiveDocId(null);
        setSelectedQuiz(null);
      }
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-24 h-24 border-8 border-teal-100 border-t-teal-600 rounded-full animate-spin mb-8"></div>
      <h2 className="text-3xl font-black text-slate-800 text-center">Cô giáo đang soát bài cực kỹ cho Bông...</h2>
      <p className="text-slate-400 mt-4 italic">Đừng nóng lòng nhé, Cô đang tìm mọi ngóc ngách đấy!</p>
    </div>
  );

  if (reviewQuizzes) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-4 border-teal-500">
          <div className="flex items-center gap-4 mb-8">
            <span className="text-5xl">🔎</span>
            <div>
               <h2 className="text-3xl font-black text-slate-800">Kết quả soát bài của Cô</h2>
               <p className="text-slate-500 font-medium">Cô đã tìm thấy {reviewQuizzes.quizzes.length} chuyên đề bài tập trong tài liệu.</p>
            </div>
          </div>
          <div className="space-y-4 mb-10">
            {reviewQuizzes.quizzes.map((q, idx) => (
              <div key={idx} className="bg-teal-50 p-6 rounded-3xl border border-teal-100 flex justify-between items-center">
                 <div>
                    <h4 className="font-black text-teal-800 text-lg">{q.title}</h4>
                    <p className="text-teal-600 text-sm font-medium">{q.questions.length} câu hỏi được trích xuất.</p>
                 </div>
                 <span className="text-2xl">✅</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4">
             <button onClick={() => setReviewQuizzes(null)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black text-xl hover:bg-slate-200 transition-all">Hủy bỏ</button>
             <button onClick={confirmQuizzes} className="flex-1 py-5 bg-teal-600 text-white rounded-2xl font-black text-xl hover:bg-teal-700 shadow-xl shadow-teal-100 transition-all">Lưu vào Kệ sách ngay ✨</button>
          </div>
        </div>
      </div>
    );
  }

  if (activeDocId && extractedQuizzesMap[activeDocId] && !selectedQuiz) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
           <button onClick={() => setActiveDocId(null)} className="text-slate-500 font-bold hover:text-teal-600 transition-colors">← Quay lại kệ sách</button>
           <h3 className="font-black text-teal-600 text-xl">Bài tập trích xuất từ: {documents.find(d => d.id === activeDocId)?.name}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {extractedQuizzesMap[activeDocId].map((quiz, i) => (
            <button key={quiz.id || i} onClick={() => startQuiz(quiz)} className="bg-white p-8 rounded-[2.5rem] border-2 border-transparent hover:border-teal-400 shadow-md transition-all text-left group">
              <h4 className="text-xl font-black text-slate-800 mb-2 group-hover:text-teal-600">{quiz.title}</h4>
              <p className="text-slate-500 text-sm mb-4 line-clamp-2">{quiz.description}</p>
              <div className="flex justify-between items-center">
                <span className="text-teal-600 font-bold">{quiz.questions.length} câu hỏi</span>
                <span className="bg-teal-50 text-teal-700 px-4 py-1 rounded-full text-xs font-bold">Làm bài ➜</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (selectedQuiz) {
    const q = selectedQuiz.questions[currentQuestionIndex];
    const currentUserAnswer = userAnswers[q.id];
    const isAnswered = !!currentUserAnswer;
    const isCorrect = isAnswered && (
      q.type === 'multiple-choice' 
        ? currentUserAnswer === q.correctAnswer
        : currentUserAnswer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase() || !!answerImage
    );

    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 flex justify-between items-center shadow-sm">
           <button onClick={() => { setSelectedQuiz(null); setCurrentTask(null); }} className="text-slate-500 font-bold hover:text-teal-600 transition-colors">← Đổi phần bài tập</button>
           <div className="flex flex-col items-center">
              <div className="font-black text-teal-600">{selectedQuiz.title}</div>
              <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${isAutoSaving ? 'bg-orange-400 animate-pulse' : 'bg-green-400'}`}></span>
                {isAutoSaving ? 'Đang lưu...' : 'Đã lưu'}
              </div>
           </div>
           <div className="text-slate-400 font-bold">{currentQuestionIndex + 1}/{selectedQuiz.questions.length}</div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100 min-h-[500px] flex flex-col relative overflow-hidden">
          <div className="mb-8">
            <div className="flex justify-between items-start mb-4">
              <span className="text-teal-600 font-black uppercase tracking-widest text-xs">{q.type === 'multiple-choice' ? 'Dạng 1: Trắc nghiệm' : 'Dạng 2: Tự luận'}</span>
              <button onClick={() => { setShowHint(!showHint); if (!showHint) handlePlayAudio(q.hint, true); }} className="text-pink-500 font-bold text-sm bg-pink-50 px-4 py-1 rounded-full hover:bg-pink-100 transition-all flex items-center gap-2">
                <span>💡</span> Gợi ý của Cô
              </button>
            </div>
            <h3 className="text-3xl font-bold text-slate-800 leading-tight">{q.text}</h3>
            {showHint && (
              <div className="mt-4 p-6 bg-gradient-to-br from-pink-50 to-white rounded-[2rem] border-l-8 border-pink-400 text-pink-900 flex justify-between items-center shadow-md animate-slideIn">
                <div className="flex-1">
                  <span className="block text-[10px] font-black text-pink-500 uppercase tracking-widest mb-2">Cô giáo hướng dẫn:</span>
                  <div className="text-lg italic leading-relaxed">
                    <HighlightedText text={q.hint} isPlaying={speakingHint} duration={hintDuration} />
                  </div>
                </div>
                <button onClick={() => handlePlayAudio(q.hint, true)} className={`text-3xl p-3 bg-white rounded-full shadow-sm hover:scale-110 transition-transform ml-4 ${speakingHint ? 'animate-pulse' : ''}`}>🔊</button>
              </div>
            )}
          </div>

          <div className="flex-1">
            {q.type === 'multiple-choice' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {q.options?.map((opt, i) => {
                  const isSelected = currentUserAnswer === opt;
                  let style = "bg-slate-50 border-slate-100 hover:border-teal-300";
                  if (isSelected) {
                    style = isCorrect ? "bg-green-50 border-green-500 text-green-700 ring-4 ring-green-100" : "bg-red-50 border-red-500 text-red-700 ring-4 ring-red-100 animate-shake";
                  } else if (isCorrect && opt === q.correctAnswer) {
                    style = "bg-green-50 border-green-500 text-green-700";
                  }
                  return (
                    <button key={i} disabled={isCorrect} onClick={() => handleAnswerSelect(q.id, opt)} className={`w-full text-left px-8 py-5 rounded-[1.5rem] border-2 transition-all font-bold text-lg flex justify-between items-center ${style}`}>
                      <span>{opt}</span>
                      {isSelected && <span>{isCorrect ? '🌟' : '❌'}</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <form onSubmit={handleTextSubmit} className="space-y-6">
                <div className="relative">
                  <textarea disabled={isCorrect} onPaste={handleAnswerPaste} value={isCorrect ? currentUserAnswer : textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="Bông gõ câu trả lời vào đây..." className={`w-full p-8 text-xl font-bold rounded-[2rem] border-4 focus:outline-none transition-all min-h-[150px] shadow-inner ${isAnswered ? isCorrect ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700' : 'border-slate-100 focus:border-teal-500 bg-slate-50'}`} />
                  {answerImage && (
                    <div className="mt-4 relative inline-block">
                       <div className="relative rounded-2xl overflow-hidden border-4 border-white shadow-xl max-w-[300px]">
                          <img src={answerImage} alt="Bông nộp bài" className="w-full object-contain" />
                          {!isCorrect && <button type="button" onClick={() => setAnswerImage(null)} className="absolute top-2 right-2 bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-lg">✕</button>}
                       </div>
                    </div>
                  )}
                </div>
                {!isCorrect && <button type="submit" className="bg-teal-600 text-white px-12 py-5 rounded-[2rem] font-black text-xl hover:bg-teal-700 transition-all shadow-xl shadow-teal-100 active:scale-95">Nộp bài cho Cô ✨</button>}
              </form>
            )}
          </div>

          {isCorrect && (
            <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col md:flex-row gap-4 animate-slideIn">
              {!explanation ? (
                <button onClick={handleExplain} disabled={explaining} className="px-8 py-4 rounded-2xl border-2 border-teal-100 text-teal-600 font-black">
                  {explaining ? 'Đang hỏi Cô...' : 'Cô ơi giải thích cho Bông!'}
                </button>
              ) : (
                <div className="flex-1 bg-purple-50 p-6 rounded-2xl border border-purple-100 flex justify-between items-start">
                   <div className="text-purple-900 font-medium leading-relaxed">
                      <HighlightedText text={explanation} isPlaying={speaking} duration={audioDuration} />
                   </div>
                   <button onClick={() => handlePlayAudio(explanation)} className={`text-3xl p-3 hover:scale-110 transition-transform ${speaking ? 'animate-pulse' : ''}`}>🔊</button>
                </div>
              )}
              {currentQuestionIndex < selectedQuiz.questions.length - 1 ? (
                <button onClick={() => {setCurrentQuestionIndex(prev => prev + 1); setExplanation(null); setTextInput(''); setAnswerImage(null);}} className="bg-teal-600 text-white px-10 py-4 rounded-2xl font-black text-xl hover:scale-105 transition-all shadow-lg shadow-teal-100">Câu tiếp theo ➜</button>
              ) : (
                <button onClick={() => { setSelectedQuiz(null); setCurrentTask(null); }} className="bg-pink-600 text-white px-10 py-4 rounded-2xl font-black text-xl hover:scale-105 transition-all shadow-lg">Xong rồi! Bông giỏi quá 🏆</button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-5xl font-black text-slate-800 tracking-tight">Kệ sách của Bông 📁</h2>
          <p className="text-slate-500 text-xl font-medium mt-2">Tải tài liệu lên để Cô giáo trích xuất bài tập hoặc làm tài liệu tham khảo cho Cô nhé!</p>
        </div>
        <label className="bg-teal-600 text-white px-10 py-5 rounded-[2.5rem] font-black text-xl shadow-xl hover:bg-teal-700 transition-all cursor-pointer">
          Tải tài liệu mới ✚
          <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {documents.length === 0 ? (
          <div className="col-span-full py-24 bg-white rounded-[4rem] border-4 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
            <span className="text-9xl mb-6">📚</span>
            <p className="text-3xl font-black text-slate-400 mb-2">Kệ sách đang trống...</p>
          </div>
        ) : (
          documents.map(doc => {
            const isReference = !!referenceDocs.find(rd => rd.id === doc.id);
            return (
              <div key={doc.id} className={`bg-white rounded-[3rem] border-2 shadow-md overflow-hidden hover:shadow-2xl transition-all group relative ${isReference ? 'border-purple-400 ring-4 ring-purple-100' : 'border-slate-100'}`}>
                <button 
                  onClick={(e) => deleteDocument(doc.id, e)} 
                  className="absolute top-4 right-4 z-50 w-12 h-12 bg-white/90 text-red-500 hover:bg-red-500 hover:text-white rounded-full shadow-2xl flex items-center justify-center transition-all border-2 border-red-100 font-black text-xl"
                  title="Xóa tài liệu này"
                >
                  ✕
                </button>
                
                {isReference && <div className="absolute top-4 left-4 z-10 bg-purple-600 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-lg animate-bounce">ĐANG THAM KHẢO 📖</div>}
                
                <div className="h-56 bg-slate-50 flex items-center justify-center overflow-hidden relative cursor-pointer" onClick={() => handleProcessDocument(doc)}>
                  {doc.mimeType === 'application/pdf' ? <span className="text-8xl">📄</span> : <img src={doc.imageBase64} alt={doc.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />}
                </div>
                <div className="p-8 space-y-3">
                  <h4 className="text-xl font-black text-slate-800 truncate">{doc.name}</h4>
                  <button onClick={() => handleProcessDocument(doc)} className={`w-full py-4 rounded-[1.5rem] font-black transition-all shadow-sm flex items-center justify-center gap-2 ${extractedQuizzesMap[doc.id] ? 'bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white' : 'bg-teal-50 text-teal-700 hover:bg-teal-600 hover:text-white'}`}>
                    <span>📝</span> {extractedQuizzesMap[doc.id] ? 'Làm bài tiếp' : 'Trích xuất bài tập'}
                  </button>
                  <button 
                    onClick={() => addReferenceDoc(doc)} 
                    disabled={isReference}
                    className={`w-full py-4 rounded-[1.5rem] font-black transition-all shadow-sm flex items-center justify-center gap-2 ${isReference ? 'bg-slate-100 text-slate-400 cursor-default' : 'bg-pink-50 text-pink-700 hover:bg-pink-500 hover:text-white'}`}
                  >
                    <span>📖</span> {isReference ? 'Cô đã nhớ bài này' : 'Gửi bí kíp cho Cô'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DocumentLibrary;
