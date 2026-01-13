export interface Chapter {
  id: string;
  title: string;
  description?: string;
}

export interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
  chapters: Chapter[];
}

export interface ClassLevel {
  id: string;
  label: string;
  subjects: Subject[];
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  grounding?: any[];
  imageUrl?: string;
  isSpeaking?: boolean;
  translatedText?: string;
  showTranslated?: boolean;
  isTranslating?: boolean;
}

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: Date;
}

export interface ExamQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface ExamResult {
  score: number;
  total: number;
  feedback: string;
  detailedResults: {
    question: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    explanation: string;
  }[];
}

export interface UploadedFile {
  id: string;
  name: string;
  size: string;
  type: string;
  status: 'success' | 'error' | 'uploading';
  timestamp: Date;
  content?: string;
  mimeType: string;
}

export type ExamTerm = 'Summative 1' | 'Summative 2' | 'Summative 3' | 'Madhyamik Selection';

export interface SamplePaper {
  title: string;
  subject: string;
  classLabel: string;
  term: ExamTerm;
  fullMarks: number;
  timeAllowed: string;
  sections: {
    title: string;
    instructions: string;
    passage?: string;
    questions: {
      id: string;
      text: string;
      marks: number;
      options?: string[];
      answer?: string;
    }[];
  }[];
}