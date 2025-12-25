
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import GlobalTutor from './GlobalTutor';
import { useTask } from '../context/TaskContext';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { requestAutoExplain } = useTask();
  const [isTutorOpen, setIsTutorOpen] = useState(false);
  const [tutorWidth, setTutorWidth] = useState(384);
  const [isResizing, setIsResizing] = useState(false);

  const navItems = [
    { path: '/', label: 'Tổng quan', icon: '🏠' },
    { path: '/practice', label: 'Ngữ pháp', icon: '📝' },
    { path: '/vocabulary', label: 'Từ vựng', icon: '📚' },
    { path: '/listening', label: 'Luyện nghe', icon: '🎧' },
    { path: '/documents', label: 'Tài liệu của Bông', icon: '📁' },
  ];

  const getTitle = (path: string) => {
    switch (path) {
      case '/': return 'Bảng điều khiển';
      case '/practice': return 'Luyện tập Ngữ pháp';
      case '/vocabulary': return 'Kho Từ vựng';
      case '/listening': return 'Lab Luyện nghe';
      case '/documents': return 'Kệ sách của Bông';
      default: return 'EnglishPro';
    }
  };

  // Phát hiện bôi đen văn bản
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection) return;

    const selectedText = selection.toString().trim();
    if (selectedText.length < 2) return; // Chỉ xử lý nếu bôi đen từ 2 ký tự trở lên

    // Tránh bôi đen trong chính bảng chat hoặc các nút bấm
    const anchorNode = selection.anchorNode;
    if (anchorNode && anchorNode.parentElement) {
      const parent = anchorNode.parentElement;
      if (parent.closest('.global-tutor-container') || parent.closest('button') || parent.closest('input')) {
        return;
      }

      // Tìm câu chứa đoạn text được chọn
      const fullText = parent.textContent || "";
      // Một cách đơn giản để tìm câu: dùng dấu chấm, hỏi, cảm để phân tách
      const sentences = fullText.split(/(?<=[.!?])\s+/);
      const contextSentence = sentences.find(s => s.includes(selectedText)) || fullText;

      requestAutoExplain(selectedText, contextSentence);
      setIsTutorOpen(true); // Tự động mở bảng chat
    }
  }, [requestAutoExplain]);

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  return (
    <div className="flex h-screen bg-slate-50 relative overflow-hidden">
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-2xl font-bold text-teal-600 flex items-center gap-2">
            <span className="bg-teal-600 text-white p-1 rounded shadow-sm">EP</span>
            EnglishPro
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                location.pathname === item.path
                  ? 'bg-teal-50 text-teal-700 font-bold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <button 
          onClick={() => setIsTutorOpen(true)}
          className="m-4 p-4 bg-purple-50 text-purple-700 rounded-2xl flex items-center gap-3 font-bold hover:bg-purple-100 transition-all border border-purple-100 shadow-sm"
        >
          <span>👩‍🏫</span> Cô giáo thông thái
        </button>
      </aside>

      <main 
        className="flex-1 overflow-y-auto relative"
        style={{ 
          marginRight: isTutorOpen ? `${tutorWidth}px` : '0px',
          transition: isResizing ? 'none' : 'margin-right 300ms ease-in-out'
        }}
      >
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex justify-between items-center">
          <h2 className="text-xl font-black text-slate-700">
            {getTitle(location.pathname)}
          </h2>
          <button 
            onClick={() => setIsTutorOpen(true)}
            className="md:hidden p-2 bg-purple-600 text-white rounded-full shadow-lg"
          >
            👩‍🏫
          </button>
        </header>
        <div className="p-8 pb-24">
          {children}
        </div>
      </main>

      <GlobalTutor 
        isOpen={isTutorOpen} 
        onClose={() => setIsTutorOpen(false)} 
        onWidthChange={setTutorWidth}
        onResizingChange={setIsResizing}
      />

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-around z-40 shadow-2xl">
        {navItems.map((item) => (
          <Link key={item.path} to={item.path} className={`p-2 ${location.pathname === item.path ? 'text-teal-600' : 'text-slate-400'}`}>
            <span className="text-2xl">{item.icon}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default Layout;
