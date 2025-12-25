
export enum Difficulty {
  BEGINNER = 'Beginner',
  INTERMEDIATE = 'Intermediate',
  ADVANCED = 'Advanced'
}

export interface Question {
  id: string;
  type: 'multiple-choice' | 'text-input';
  text: string;
  options?: string[]; // Chỉ dùng cho multiple-choice
  correctAnswer: string;
  explanation: string;
  hint: string;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  category: string;
  questions: Question[];
}

export interface VocabItem {
  word: string;
  ipa: string;
  definition: string;
  example: string;
}

export interface VocabSet {
  topic: string;
  items: VocabItem[];
}

export interface ListeningSession {
  title: string;
  script: string;
  audioBase64: string;
  questions: Question[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export interface UserDocument {
  id: string;
  name: string;
  imageBase64: string;
  mimeType: string;
  timestamp: number;
}
