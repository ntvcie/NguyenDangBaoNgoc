
import React, { useState, useRef, useEffect } from 'react';
import { generateQuiz, getExplanation, getSpeech, decodeBase64, decodeAudioData } from '../services/geminiService';
import { Quiz, Difficulty } from '../types';
import HighlightedText from '../components/HighlightedText';
import { useTask } from '../context/TaskContext';

const bongCurriculum = [
  { id: 'p1', name: 'Phần 1: Phát âm ED/ES', prompt: 'Pronunciation with ED/ES, including finding the different pronunciation' },
  { id: 'p2', name: 'Phần 2: Các Thì (Tenses)', prompt: 'Present Simple, Past Simple, Present Continuous, Present Perfect, Past Continuous - Verb Forms' },
  { id: 'p3', name: 'Phần 3: V-ing & To V-inf', prompt: 'Verb forms: Gerund (V-ing) and To-Infinitive (To V)' },
  { id: 'p4', name: 'Phần 4: Câu bị động', prompt: 'Passive Voice transformation for Grade 5 advanced. Include text-input questions for rewrite.' },
  { id: 'p5', name: 'Phần 5: Đại từ quan hệ', prompt: 'Relative Pronouns: WHICH, WHO, WHOM, WHY, THAT, WHOSE' },
  { id: 'p6', name: 'Phần 6: Cấu trúc Take/Spend', prompt: 'Rewrite sentences using It takes/took and Spend/Spent + time + V-ing. Include text-input questions.' },
  { id: 'p7', name: 'Phần 7: Câu so sánh', prompt: 'Comparative and Superlative adjectives' },
  { id: 'p8', name: 'Phần 8: Câu điều kiện', prompt: '1st Conditional Sentences (If clause)' },
  { id: 'p9', name: 'Phần 9: Cấu trúc Too/Enough', prompt: 'Combine sentences using TOO and ENOUGH. Include text-input questions.' },
  { id: 'p10', name: 'Phần 10: Cấu trúc So/Such', prompt: 'Combine sentences using SO and SUCH. Include text-input questions.' },
  { id: 'p11', name: 'Phần 11: Câu hỏi đuôi', prompt: 'Tag Questions for all tenses' },
  { id: 'p12', name: 'Phần 12: Tổng ôn CLC NC', prompt: 'Comprehensive review Grade 5 advanced. Mixed question types.' }
];

const PracticeRoom: React.FC = () => {
  const { setCurrentTask } = useTask();
  
  const [quiz, setQuiz] = useState<Quiz | null>(() => {
    const saved = localStorage.getItem('bong_practice_quiz');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(() => {
    return parseInt(localStorage.getItem('bong_practice_index') || '0');
  });
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('bong_practice_answers');
    return saved ? JSON.parse(saved) : {};
  });
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  const [textInput, setTextInput] = useState('');
  const [answerImage, setAnswerImage] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speakingHint, setSpeakingHint] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [hintDuration, setHintDuration] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setIsAutoSaving(true);
    if (quiz) localStorage.setItem('bong_practice_quiz', JSON.stringify(quiz));
    else localStorage.removeItem('bong_practice_quiz');
    localStorage.setItem('bong_practice_index', currentQuestionIndex.toString());
    localStorage.setItem('bong_practice_answers', JSON.stringify(userAnswers));
    const timer = setTimeout(() => setIsAutoSaving(false), 500);
    return () => clearTimeout(timer);
  }, [quiz, currentQuestionIndex, userAnswers]);

  useEffect(() => {
    if (quiz && quiz.questions[currentQuestionIndex]) {
      const q = quiz.questions[currentQuestionIndex];
      setCurrentTask({
        quizTitle: quiz.title,
        questionText: q.text,
        hint: q.hint,
        correctAnswer: q.correctAnswer,
        userAnswer: userAnswers[q.id]
      });
    } else {
      setCurrentTask(null);
    }
  }, [quiz, currentQuestionIndex, userAnswers, setCurrentTask]);

  const startTopic = async (topicName: string, prompt: string) => {
    setLoading(true);
    try {
      const generatedQuiz = await generateQuiz(`Bigtree Land Lớp 5 CLC NC: ${prompt}`, Difficulty.INTERMEDIATE);
      setQuiz(generatedQuiz);
      setCurrentQuestionIndex(0);
      setUserAnswers({});
      setTextInput('');
      setAnswerImage(null);
      setShowResult(false);
      setExplanation(null);
      setShowHint(false);
    } catch (error) {
      console.error("Lỗi tạo bài tập", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (questionId: string, answer: string) => {
    if (!quiz) return;
    const q = quiz.questions[currentQuestionIndex];
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
    if (!quiz) return;
    const q = quiz.questions[currentQuestionIndex];
    handleAnswerSelect(q.id, textInput || (answerImage ? "[Bông nộp bài ảnh]" : ""));
  };

  const handleExplain = async () => {
    if (!quiz || !quiz.questions[currentQuestionIndex]) return;
    const q = quiz.questions[currentQuestionIndex];
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

  const handleNextQuestion = () => {
    if (quiz && currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setExplanation(null);
      setShowHint(false);
      setTextInput('');
      setAnswerImage(null);
    } else {
      setShowResult(true);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-20 h-20 border-8 border-teal-100 border-t-teal-600 rounded-full animate-spin mb-8"></div>
      <h2 className="text-3xl font-black text-slate-800">Cô giáo đang biên soạn bài tập...</h2>
    </div>
  );

  if (quiz && quiz.questions[currentQuestionIndex]) {
    const q = quiz.questions[currentQuestionIndex];
    const currentUserAnswer = userAnswers[q.id];
    const isAnswered = !!currentUserAnswer;
    const isCorrect = isAnswered && (
      q.type === 'multiple-choice'
        ? currentUserAnswer === q.correctAnswer
        : currentUserAnswer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase() || (currentUserAnswer === "[Bông nộp bài ảnh]" && !!answerImage)
    );

    if (showResult) {
      return (
        <div className="max-w-2xl mx-auto bg-white rounded-[3rem] p-12 shadow-2xl border border-slate-100 text-center animate-scaleIn">
          <div className="text-8xl mb-6">🏆</div>
          <h2 className="text-4xl font-black text-slate-800 mb-2">Tuyệt vời quá Bông ơi!</h2>
          <p className="text-slate-500 text-lg mb-10">Con đã hoàn thành lộ trình: <span className="font-bold text-teal-600">{quiz.title}</span></p>
          <button onClick={() => { setQuiz(null); setCurrentTask(null); localStorage.removeItem('bong_practice_quiz'); }} className="w-full bg-teal-600 text-white py-5 rounded-[1.5rem] font-black text-xl hover:bg-teal-700 shadow-xl transition-all">Luyện thêm chuyên đề khác</button>
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <button onClick={() => { setQuiz(null); setCurrentTask(null); }} className="text-slate-500 font-bold hover:text-teal-600 transition-colors">← Quay lại lộ trình</button>
          <div className="flex items-center gap-4">
             <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${isAutoSaving ? 'bg-orange-400 animate-pulse' : 'bg-green-400'}`}></span>
                {isAutoSaving ? 'Đang lưu...' : 'Đã lưu'}
             </div>
             <div className="px-4 py-1 bg-teal-100 text-teal-700 rounded-full font-bold text-sm">Câu {currentQuestionIndex + 1} / {quiz.questions.length}</div>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100 min-h-[500px] flex flex-col relative overflow-hidden">
          <div className="mb-8">
            <div className="flex justify-between items-start mb-4">
              <span className="text-teal-600 font-black uppercase tracking-widest text-xs">
                 {q.type === 'multiple-choice' ? 'Dạng 1: Chọn đáp án đúng' : 'Dạng 2: Bông tự viết câu'}
              </span>
              <button onClick={() => { setShowHint(!showHint); if (!showHint) handlePlayAudio(q.hint, true); }} className="text-pink-600 font-black text-sm bg-pink-50 px-5 py-2 rounded-full hover:bg-pink-100 transition-all flex items-center gap-2">
                <span>💡</span> Gợi ý của Cô
              </button>
            </div>
            <h3 className="text-3xl font-bold text-slate-800 leading-tight">{q.text}</h3>
            {showHint && (
              <div className="mt-4 p-6 bg-gradient-to-r from-pink-50 to-white rounded-[2rem] border-l-8 border-pink-400 text-pink-900 flex justify-between items-center animate-slideIn shadow-md">
                <div className="flex-1">
                  <span className="text-[10px] font-black text-pink-500 uppercase mb-1 block">Cô giáo hướng dẫn tư duy:</span>
                  <div className="text-lg italic">
                    <HighlightedText text={q.hint} isPlaying={speakingHint} duration={hintDuration} />
                  </div>
                </div>
                <button onClick={() => handlePlayAudio(q.hint, true)} className={`text-2xl p-3 bg-white rounded-full shadow-sm hover:scale-110 transition-transform ml-4 ${speakingHint ? 'animate-pulse ring-2 ring-pink-300' : ''}`}>🔊</button>
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
                    style = isCorrect 
                      ? "bg-green-50 border-green-500 text-green-700 ring-4 ring-green-100" 
                      : "bg-red-50 border-red-500 text-red-700 ring-4 ring-red-100 animate-shake";
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
                  <textarea disabled={isCorrect} onPaste={handleAnswerPaste} value={isCorrect ? currentUserAnswer : textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="Bông gõ câu trả lời vào đây..." className={`w-full p-8 text-xl font-bold rounded-[2rem] border-4 min-h-[120px] focus:outline-none transition-all ${isAnswered ? isCorrect ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700' : 'border-slate-100 focus:border-teal-500 bg-slate-50 shadow-inner'}`} />
                  {answerImage && (
                    <div className="mt-4 p-2 bg-white border-2 border-slate-100 rounded-2xl relative inline-block animate-scaleIn shadow-lg">
                       <img src={answerImage} alt="Preview" className="max-w-[250px] rounded-xl" />
                       {!isCorrect && <button type="button" onClick={() => setAnswerImage(null)} className="absolute -top-3 -right-3 bg-red-500 text-white w-8 h-8 rounded-full shadow-lg">✕</button>}
                    </div>
                  )}
                </div>
                {!isCorrect && <button type="submit" className="bg-teal-600 text-white px-12 py-5 rounded-[2rem] font-black text-xl hover:bg-teal-700 shadow-xl active:scale-95 transition-all">Nộp bài ✨</button>}
              </form>
            )}
          </div>

          {isCorrect && (
            <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col md:flex-row gap-4 animate-slideIn">
              {!explanation ? (
                <button onClick={handleExplain} disabled={explaining} className="px-8 py-4 rounded-2xl border-2 border-teal-100 text-teal-600 font-black">
                  {explaining ? 'Đang hỏi Cô...' : 'Cô giảng giải cho Bông!'}
                </button>
              ) : (
                <div className="flex-1 bg-purple-50 p-6 rounded-2xl border border-purple-100 flex justify-between items-start">
                   <div className="text-purple-900 font-medium leading-relaxed">
                      <HighlightedText text={explanation} isPlaying={speaking} duration={audioDuration} />
                   </div>
                   <button onClick={() => handlePlayAudio(explanation)} className={`text-3xl p-3 hover:scale-110 transition-transform ${speaking ? 'animate-pulse' : ''}`}>🔊</button>
                </div>
              )}
              <button onClick={handleNextQuestion} className="bg-teal-600 text-white px-10 py-4 rounded-2xl font-black text-xl hover:scale-105 transition-all shadow-lg">
                 {currentQuestionIndex === quiz.questions.length - 1 ? 'Xem kết quả' : 'Câu tiếp theo ➜'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-fadeIn">
      <div className="text-center">
        <h2 className="text-5xl font-black text-slate-800 tracking-tight">Lộ trình Ngữ pháp Bigtree Land</h2>
        <p className="text-slate-500 text-xl mt-4">Bông hãy chọn một chuyên đề để bắt đầu nhé!</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {bongCurriculum.map((item) => (
          <button key={item.id} onClick={() => startTopic(item.name, item.prompt)} className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:border-teal-400 transition-all text-left group">
            <div className="text-4xl mb-4 group-hover:scale-110 group-hover:rotate-6 transition-transform inline-block">🔖</div>
            <h3 className="text-2xl font-black text-slate-800 mb-2 group-hover:text-teal-600">{item.name}</h3>
            <p className="text-slate-400 text-sm">Bộ câu hỏi luyện tập chuyên sâu cho Bông.</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default PracticeRoom;
