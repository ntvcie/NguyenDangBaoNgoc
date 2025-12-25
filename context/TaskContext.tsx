
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { UserDocument } from '../types';

interface CurrentTask {
  quizTitle: string;
  questionText: string;
  hint: string;
  correctAnswer: string;
  userAnswer?: string;
}

interface AutoExplainRequest {
  selectedText: string;
  contextText: string;
  timestamp: number;
}

interface TaskContextType {
  currentTask: CurrentTask | null;
  setCurrentTask: (task: CurrentTask | null) => void;
  autoExplainRequest: AutoExplainRequest | null;
  requestAutoExplain: (selected: string, context: string) => void;
  referenceDocs: UserDocument[];
  addReferenceDoc: (doc: UserDocument) => void;
  removeReferenceDoc: (id: string) => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentTask, setCurrentTask] = useState<CurrentTask | null>(null);
  const [autoExplainRequest, setAutoExplainRequest] = useState<AutoExplainRequest | null>(null);
  const [referenceDocs, setReferenceDocs] = useState<UserDocument[]>(() => {
    const saved = localStorage.getItem('bong_reference_docs');
    return saved ? JSON.parse(saved) : [];
  });

  const requestAutoExplain = (selected: string, context: string) => {
    setAutoExplainRequest({
      selectedText: selected,
      contextText: context,
      timestamp: Date.now()
    });
  };

  const addReferenceDoc = (doc: UserDocument) => {
    setReferenceDocs(prev => {
      if (prev.find(d => d.id === doc.id)) return prev;
      const next = [...prev, doc];
      localStorage.setItem('bong_reference_docs', JSON.stringify(next));
      return next;
    });
  };

  const removeReferenceDoc = (id: string) => {
    setReferenceDocs(prev => {
      const next = prev.filter(d => d.id !== id);
      localStorage.setItem('bong_reference_docs', JSON.stringify(next));
      return next;
    });
  };

  return (
    <TaskContext.Provider value={{ 
      currentTask, setCurrentTask, 
      autoExplainRequest, requestAutoExplain,
      referenceDocs, addReferenceDoc, removeReferenceDoc
    }}>
      {children}
    </TaskContext.Provider>
  );
};

export const useTask = () => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTask must be used within a TaskProvider');
  }
  return context;
};
