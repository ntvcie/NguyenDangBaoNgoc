
import React from 'react';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const modules = [
    { title: 'Ngữ pháp', desc: '12 chuyên đề Bigtree Land.', path: '/practice', icon: '📝', color: 'bg-teal-600' },
    { title: 'Từ vựng', desc: 'Mở rộng vốn từ lớp 5.', path: '/vocabulary', icon: '📚', color: 'bg-pink-500' },
    { title: 'Luyện nghe', desc: 'Hội thoại & hiểu nội dung.', path: '/listening', icon: '🎧', color: 'bg-purple-500' },
    { title: 'Kệ sách của Bông', desc: 'Học từ tài liệu riêng của con.', path: '/documents', icon: '📁', color: 'bg-teal-500' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-12 relative">
      <div className="sticker top-0 -left-10 text-5xl">⭐</div>
      <div className="sticker bottom-20 -right-10 text-5xl" style={{animationDelay: '1s'}}>🚀</div>

      <section className="bg-gradient-to-br from-purple-600 via-purple-500 to-teal-600 rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl border-4 border-white">
        <div className="relative z-10">
          <div className="inline-block px-4 py-1 bg-white/20 rounded-full text-xs font-bold mb-4 backdrop-blur-md">
            HÔM NAY CỦA BÔNG THẾ NÀO? ✨
          </div>
          <h2 className="text-6xl font-black mb-4 tracking-tight">Chào Bông! 👋</h2>
          <p className="text-teal-50 text-xl max-w-xl mb-10 leading-relaxed">
            Hôm nay Bông muốn học gì? Bông có thể tự tải ảnh tài liệu của con lên để Cô giáo thông thái giúp con làm bài tập nhé!
          </p>
          <div className="flex gap-4">
            <Link to="/documents" className="bg-white text-teal-600 px-10 py-5 rounded-[2rem] font-black text-xl hover:shadow-2xl hover:scale-105 transition-all inline-block shadow-lg">
              Tải tài liệu lên ngay 📁
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="flex justify-between items-end mb-8">
          <div>
            <h3 className="text-3xl font-black text-slate-800 flex items-center gap-3">
              Khu vườn học tập của Bông 🌿
            </h3>
            <p className="text-slate-400 font-medium">Chọn một module để bắt đầu khám phá kiến thức nhé!</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {modules.map((m, i) => (
            <Link 
              key={i} 
              to={m.path}
              className="group bg-white p-8 rounded-[2.5rem] border-2 border-transparent shadow-md hover:shadow-2xl hover:border-teal-400 hover:translate-y-[-8px] transition-all relative overflow-hidden"
            >
              <div className={`w-16 h-16 ${m.color} rounded-2xl flex items-center justify-center text-3xl mb-6 text-white group-hover:scale-110 group-hover:rotate-6 transition-all shadow-lg`}>
                {m.icon}
              </div>
              <h4 className="text-2xl font-black text-slate-800 mb-2">{m.title}</h4>
              <p className="text-slate-500 font-medium text-sm leading-relaxed">{m.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;