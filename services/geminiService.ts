
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Quiz, Difficulty, VocabSet, ListeningSession, UserDocument } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const decodeBase64 = (base64: string) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
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

export const generateQuiz = async (topic: string, difficulty: Difficulty): Promise<Quiz> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Tạo bài tập tiếng Anh Bigtree Land nâng cao cho Bông về chủ đề: ${topic}.
    YÊU CẦU ĐẶC BIỆT CHO TRƯỜNG 'hint' và 'explanation':
    - PHẢI sử dụng dấu **...** để đánh dấu các từ khóa quan trọng (ví dụ: **keyword**, **câu thần chú**, **quy tắc**).
    - Giải thích logic ngữ pháp hoặc dấu hiệu nhận biết.
    - Tuyệt đối không được cho đáp án trực tiếp trong hint.
    - Xưng Cô gọi Bông, giọng điệu thông thái và khích lệ.
    - Trả về JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          category: { type: Type.STRING },
          difficulty: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                type: { type: Type.STRING, description: "multiple-choice hoặc text-input" },
                text: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.STRING },
                explanation: { type: Type.STRING },
                hint: { type: Type.STRING }
              },
              required: ["id", "type", "text", "correctAnswer", "explanation", "hint"]
            }
          }
        },
        required: ["id", "title", "description", "category", "difficulty", "questions"]
      }
    }
  });
  return JSON.parse(response.text);
};

export const generateQuizFromDocument = async (base64Data: string, mimeType: string): Promise<Quiz[]> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        text: `NHIỆM VỤ TỐI QUAN TRỌNG: Quét toàn bộ tài liệu được gửi kèm. 
        Hãy tìm mọi tiêu đề (Heading), mọi phần bài tập (Section) và TẤT CẢ các câu hỏi có trong tài liệu (ảnh, pdf). 
        
        QUY TẮC TRÍCH XUẤT:
        1. Phân loại theo chuyên đề: Nếu tài liệu có nhiều phần, hãy tạo mỗi phần là một đối tượng 'Quiz' riêng biệt.
        2. Gợi ý & Giải thích: PHẢI dùng dấu **...** để bao quanh các từ khóa tiếng Anh, câu thần chú Bigtree Land hoặc quy tắc cốt lõi (ví dụ: **Vô thanh**, **Hữu thanh**, **Thời phong kiến phương tây**). Việc này giúp Bông tập trung vào trọng tâm bài học.
        3. Ngôn ngữ: Toàn bộ câu hỏi (text) dùng TIẾNG ANH. Giải thích và Gợi ý dùng TIẾNG VIỆT, xưng Cô gọi Bông.
        
        Trả về mảng các Quiz JSON.`
      },
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Data.split(',')[1] || base64Data
        }
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            category: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  type: { type: Type.STRING, description: "multiple-choice hoặc text-input" },
                  text: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswer: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                  hint: { type: Type.STRING }
                },
                required: ["id", "type", "text", "correctAnswer", "explanation", "hint"]
              }
            }
          },
          required: ["id", "title", "description", "category", "difficulty", "questions"]
        }
      }
    }
  });
  return JSON.parse(response.text);
};

export const getExplanation = async (question: string, userAnswer: string, correctAnswer: string, answerImage?: string): Promise<string> => {
  const contents: any[] = [{ text: `Giải thích tại sao "${correctAnswer}" đúng. Bông trả lời là: "${userAnswer}". 
  HƯỚNG DẪN: PHẢI đánh dấu các từ khóa/quy tắc quan trọng bằng dấu **...** (Ví dụ: **quy tắc**, **books**, **Present Simple**).
  Xưng Cô gọi Bông.` }];
  
  if (answerImage) {
    contents.push({
      inlineData: {
        mimeType: 'image/png',
        data: answerImage.split(',')[1] || answerImage
      }
    });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: contents,
    config: { systemInstruction: "Cô giáo tiếng Anh thông thái giải thích chi tiết, sử dụng dấu **...** để đánh dấu trọng tâm kiến thức." }
  });
  return response.text;
};

export const getSpeech = async (text: string): Promise<string> => {
  // Loại bỏ các ký tự đánh dấu ** trước khi đưa vào TTS để tránh AI đọc cả chữ "star"
  const cleanText = text.replace(/\*\*/g, '');
  
  // Prompt đặc biệt để yêu cầu giọng nữ miền Bắc truyền cảm
  const promptText = `Hãy đọc đoạn văn bản sau bằng tiếng Việt với giọng NỮ MIỀN BẮC, truyền cảm, nhẹ nhàng, ấm áp như một cô giáo đang giảng bài cho học sinh. Các từ tiếng Anh xuất hiện trong câu phải được phát âm rõ ràng, chuẩn xác nhưng vẫn tự nhiên. Tốc độ vừa phải cho học sinh lớp 5: ${cleanText}`;
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: promptText }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
      }
    }
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
};

export const generateVocabSet = async (topic: string): Promise<VocabSet> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Tạo từ vựng chủ đề: ${topic}. Trả về JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                ipa: { type: Type.STRING },
                definition: { type: Type.STRING },
                example: { type: Type.STRING }
              },
              required: ["word", "ipa", "definition", "example"]
            }
          }
        },
        required: ["topic", "items"]
      }
    }
  });
  return JSON.parse(response.text);
};

export const chatWithTutor = async (
  history: { role: 'user' | 'model', content: string }[], 
  message: string, 
  imageBase64?: string, 
  context?: any,
  referenceDocs?: UserDocument[]
) => {
  const formattedHistory = history.map(h => ({
    role: h.role,
    parts: [{ text: h.content }]
  }));
  
  let systemInstruction = `Bạn là Cô giáo thông thái của Bông. Xưng là Cô, gọi học sinh là Bông. Giọng điệu dịu dàng, thông thái, khích lệ.

QUY TẮC ĐÁNH DẤU TRỌNG TÂM: 
Luôn sử dụng dấu **...** (hai dấu sao) bao quanh các từ khóa quan trọng nhất trong câu trả lời (Ví dụ: **Present Simple**, **Thời phong kiến phương tây**, **Vô thanh**). Việc này cực kỳ quan trọng để hệ thống highlight đúng trọng tâm cho Bông.

QUY TẮC PHÁT ÂM CỐT LÕI (CHỈ SỬ DỤNG KHI BỐI CẢNH LIÊN QUAN ĐẾN PHÁT ÂM S, ES, ED): 
Nguyên tắc "Ngưu tầm ngưu, mã tầm mã": **Vô thanh đi với vô thanh**, **hữu thanh đi với hữu thanh**.

1. Vô thanh:
   - Đuôi S/ES phát âm là /s/ khi từ kết thúc bằng {th, f, k, p, t} (Thần chú: **"Thời phong kiến phương tây"**).
   - Đuôi ED phát âm là /t/ khi từ kết thúc bằng {ch, f, p, k, th, x, s, sh} (Thần chú: **"Chính phủ Pháp không thích xem sổ sách"**).
2. Hữu thanh:
   - Đuôi S/ES phát âm là /z/.
   - Đuôi ED phát âm là /d/.
3. Trường hợp đặc biệt (Tách vần):
   - Đuôi ED phát âm /id/ khi kết thúc bằng {t, d} (Thần chú: **"Tiêu dùng"**).
   - Đuôi S/ES phát âm /iz/ khi kết thúc bằng âm rít {s, ss, ch, x, sh, z, ge, ce} (Thần chú: **"Sáu sung sướng chạy xe SH zởm ghê"**).

QUY TẮC BẢO MẬT: TUYỆT ĐỐI KHÔNG đưa ra đáp án trực tiếp trừ khi được yêu cầu khẩn thiết.`;
  
  if (context) {
    systemInstruction += `\n\nBối cảnh hiện tại: Bông đang làm bài tập "${context.quizTitle}".
    Câu hỏi Bông đang xem: "${context.questionText}".
    Gợi ý của câu này: "${context.hint}".
    Đáp án đúng: "${context.correctAnswer}".
    ${context.userAnswer ? `Bông đã trả lời: "${context.userAnswer}".` : "Bông chưa trả lời câu này."}`;
  }

  const userParts: any[] = [{ text: message }];
  if (imageBase64) {
    userParts.push({
      inlineData: {
        mimeType: 'image/png',
        data: imageBase64.split(',')[1] || imageBase64
      }
    });
  }

  const contents = [...formattedHistory, { role: 'user', parts: userParts }];
  
  if (referenceDocs && referenceDocs.length > 0) {
    const referenceText = "Dưới đây là các tài liệu lý thuyết Bông đã gửi cho Cô để tham khảo:";
    const refParts: any[] = [{ text: referenceText }];
    referenceDocs.forEach(doc => {
      refParts.push({
        inlineData: {
          mimeType: doc.mimeType,
          data: doc.imageBase64.split(',')[1] || doc.imageBase64
        }
      });
    });
    contents.unshift({ role: 'user', parts: refParts });
  }
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: contents,
    config: { systemInstruction }
  });
  return response.text;
};

export const generateListeningLab = async (topic: string): Promise<ListeningSession> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Tạo một bài luyện nghe tiếng Anh dành cho học sinh lớp 5 nâng cao về chủ đề: ${topic}.
    Trong phần 'explanation' và 'hint', hãy sử dụng dấu **...** để đánh dấu các từ khóa trọng tâm.
    Trả về JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          script: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                type: { type: Type.STRING },
                text: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.STRING },
                explanation: { type: Type.STRING },
                hint: { type: Type.STRING }
              },
              required: ["id", "type", "text", "options", "correctAnswer", "explanation", "hint"]
            }
          }
        },
        required: ["title", "script", "questions"]
      }
    }
  });
  const sessionData = JSON.parse(response.text);
  const audioBase64 = await getSpeech(sessionData.script);
  return { ...sessionData, audioBase64 };
};
