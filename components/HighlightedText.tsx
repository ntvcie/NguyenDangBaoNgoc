
import React, { useState, useEffect, useRef, useMemo } from 'react';

interface HighlightedTextProps {
  text: string;
  isPlaying: boolean;
  duration?: number;
}

interface WordSegment {
  original: string;
  display: string;
  isImportant: boolean;
}

const HighlightedText: React.FC<HighlightedTextProps> = ({ text, isPlaying, duration }) => {
  const [activeIndex, setActiveIndex] = useState(-1);
  const timerRef = useRef<number | null>(null);

  // Phân tích văn bản thành các phân đoạn từ, nhận diện dấu **...**
  const segments = useMemo(() => {
    const rawWords = text.split(/\s+/);
    return rawWords.map(word => {
      const isImportant = word.startsWith('**') && word.endsWith('**');
      return {
        original: word,
        display: isImportant ? word.slice(2, -2) : word,
        isImportant
      } as WordSegment;
    });
  }, [text]);

  useEffect(() => {
    if (isPlaying) {
      setActiveIndex(0);
      // Ước tính tốc độ đọc trung bình (chậm rãi cho học sinh lớp 5)
      const wordDelay = duration ? (duration * 1000) / segments.length : 400;
      
      let index = 0;
      timerRef.current = window.setInterval(() => {
        index++;
        if (index < segments.length) {
          setActiveIndex(index);
        } else {
          if (timerRef.current) clearInterval(timerRef.current);
        }
      }, wordDelay);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setActiveIndex(-1);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, segments, duration]);

  return (
    <div className="leading-relaxed inline">
      {segments.map((seg, i) => {
        const isCurrentlySpoken = i === activeIndex;
        const isPastSpoken = i < activeIndex;
        
        // CHỈ Highlight nếu là từ quan trọng
        // Nếu là từ quan trọng và đang được đọc đến: màu vàng đậm
        // Nếu là từ quan trọng đã đọc qua: giữ màu vàng nhạt/vết tích để Bông ghi nhớ
        let highlightClass = "";
        if (seg.isImportant) {
          if (isCurrentlySpoken) {
            highlightClass = "bg-yellow-300 text-slate-900 ring-2 ring-yellow-400 shadow-sm";
          } else if (isPastSpoken) {
            highlightClass = "bg-yellow-100 text-slate-900";
          }
        }

        return (
          <span 
            key={i} 
            className={`transition-all duration-300 px-1 mx-0.5 rounded-md inline-block ${highlightClass} ${
              !seg.isImportant && isCurrentlySpoken ? 'text-teal-600 font-bold' : ''
            }`}
          >
            {seg.display}
          </span>
        );
      })}
    </div>
  );
};

export default HighlightedText;
