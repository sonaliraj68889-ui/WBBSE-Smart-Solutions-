
import React, { useState, useEffect } from 'react';
import { CLASSES } from '../constants.ts';
import { Subject, Chapter, ExamQuestion } from '../types.ts';
import { translations } from '../translations.ts';
import { generatePracticeSet, ApiError } from '../services/geminiService.ts';
import MathText from './MathText.tsx';

interface PracticeModeProps {
  darkMode: boolean;
  lang: 'en' | 'hi';
  onQuotaExceeded: () => void;
  onHome: () => void;
}

const PracticeMode: React.FC<PracticeModeProps> = ({ darkMode, lang, onQuotaExceeded, onHome }) => {
  const t = translations[lang];
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  // Helper to get localized names
  const getLocalizedClassName = (id: string) => (t.classLabels as any)[id] || id;
  const getLocalizedSubjectName = (id: string, name: string) => (t.subjects as any)[id] || name;

  const handleStartPractice = async (chapter: Chapter) => {
    if (!selectedClassId || !selectedSubject) return;
    
    setSelectedChapter(chapter);
    setLoading(true);
    setError(null);
    setQuestions([]);
    setCurrentIndex(0);
    setScore(0);
    setIsFinished(false);
    
    try {
      const classLabel = getLocalizedClassName(selectedClassId);
      const subjectName = getLocalizedSubjectName(selectedSubject.id, selectedSubject.name);
      
      const generatedQuestions = await generatePracticeSet(subjectName, classLabel, chapter.title, lang);
      if (generatedQuestions.length === 0) throw new Error("No questions generated.");
      
      setQuestions(generatedQuestions);
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'QUOTA_EXCEEDED') {
        onQuotaExceeded();
      } else {
        setError(t.errorGeneric);
      }
      setSelectedChapter(null); // Go back to selection
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = (idx: number) => {
    if (showAnswer) return;
    setSelectedOption(idx);
  };

  const handleCheckAnswer = () => {
    if (selectedOption === null) return;
    setShowAnswer(true);
    if (selectedOption === questions[currentIndex].correctAnswer) {
      setScore(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setShowAnswer(false);
    } else {
      setIsFinished(true);
    }
  };

  const handleReset = () => {
     setSelectedClassId(null);
     setSelectedSubject(null);
     setSelectedChapter(null);
     setQuestions([]);
     setIsFinished(false);
  };

  // --- RENDERERS ---

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6 animate-fadeIn">
        <div className="relative">
           <div className="w-20 h-20 border-8 border-blue-600/10 border-t-blue-500 rounded-full animate-spin"></div>
           <div className="absolute inset-0 flex items-center justify-center">
              <i className="fa-solid fa-bullseye text-blue-500 animate-pulse text-3xl"></i>
           </div>
        </div>
        <p className="text-lg font-bold opacity-60 animate-pulse">{t.practiceLoading}</p>
      </div>
    );
  }

  // 4. Result View
  if (isFinished) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fadeIn space-y-8">
        <div className="w-24 h-24 rounded-full bg-emerald-500 text-white flex items-center justify-center text-5xl shadow-2xl mb-4">
           <i className="fa-solid fa-trophy"></i>
        </div>
        <h2 className="text-4xl font-black">{t.practiceComplete}</h2>
        <div className="text-6xl font-black text-blue-600">
           {score} <span className="text-3xl opacity-30">/</span> {questions.length}
        </div>
        <div className="flex space-x-4">
           <button onClick={handleReset} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-blue-700 shadow-lg transition-all">
             {t.mainMenu}
           </button>
           <button onClick={() => { 
             // Retry same chapter
             if(selectedChapter) handleStartPractice(selectedChapter);
           }} className="px-8 py-3 bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-200 rounded-xl font-bold uppercase tracking-widest hover:bg-gray-200 transition-all">
             Try Again
           </button>
        </div>
      </div>
    );
  }

  // 3. Quiz View
  if (selectedChapter && questions.length > 0) {
    const currentQ = questions[currentIndex];
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn pb-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
           <div>
              <h2 className="text-xl font-black">{selectedChapter.title}</h2>
              <p className="text-xs opacity-50 font-bold uppercase tracking-widest">{t.question} {currentIndex + 1} of {questions.length}</p>
           </div>
           <div className="text-right">
              <p className="text-xs opacity-50 font-bold uppercase tracking-widest">{t.score}</p>
              <p className="text-2xl font-black text-blue-600">{score}</p>
           </div>
        </div>

        {/* Question Card */}
        <div className={`p-8 md:p-10 rounded-[2rem] shadow-xl border relative transition-colors ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
           <h3 className="text-xl md:text-2xl font-bold mb-8 leading-snug">
             <MathText text={currentQ.question} />
           </h3>

           <div className="space-y-3">
             {currentQ.options.map((opt, idx) => {
               let optionClass = "";
               if (showAnswer) {
                 if (idx === currentQ.correctAnswer) optionClass = "bg-emerald-500 text-white border-emerald-500";
                 else if (idx === selectedOption && idx !== currentQ.correctAnswer) optionClass = "bg-red-500 text-white border-red-500";
                 else optionClass = darkMode ? "bg-slate-800 opacity-50" : "bg-gray-100 opacity-50";
               } else {
                 if (selectedOption === idx) optionClass = "bg-blue-600 text-white border-blue-600 shadow-lg scale-[1.02]";
                 else optionClass = darkMode ? "bg-slate-800 hover:bg-slate-700 border-slate-700" : "bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50";
               }

               return (
                 <button
                   key={idx}
                   onClick={() => handleOptionSelect(idx)}
                   disabled={showAnswer}
                   className={`w-full text-left p-4 md:p-5 rounded-xl border-2 transition-all flex items-center group ${optionClass}`}
                 >
                   <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm mr-4 transition-colors ${
                     selectedOption === idx || (showAnswer && idx === currentQ.correctAnswer) ? 'bg-white/20' : 'bg-gray-200 dark:bg-slate-700 text-gray-500'
                   }`}>
                     {String.fromCharCode(65 + idx)}
                   </div>
                   <span className="font-bold flex-1"><MathText text={opt} isInline /></span>
                   {showAnswer && idx === currentQ.correctAnswer && <i className="fa-solid fa-check-circle text-xl"></i>}
                   {showAnswer && idx === selectedOption && idx !== currentQ.correctAnswer && <i className="fa-solid fa-circle-xmark text-xl"></i>}
                 </button>
               );
             })}
           </div>

           {/* Feedback Area */}
           {showAnswer && (
             <div className="mt-8 pt-6 border-t border-dashed border-current/20 animate-fadeIn">
               <p className={`font-black uppercase tracking-widest text-xs mb-2 ${selectedOption === currentQ.correctAnswer ? 'text-emerald-500' : 'text-red-500'}`}>
                 {selectedOption === currentQ.correctAnswer ? t.correct : t.incorrect}
               </p>
               <div className="opacity-80 text-sm font-medium leading-relaxed">
                 <MathText text={currentQ.explanation} />
               </div>
             </div>
           )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4">
           <button onClick={handleReset} className="px-6 py-3 rounded-xl font-bold uppercase text-xs tracking-widest opacity-40 hover:opacity-100 transition-opacity">
              Exit
           </button>
           {!showAnswer ? (
             <button 
               onClick={handleCheckAnswer} 
               disabled={selectedOption === null}
               className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none"
             >
               {t.checkAnswer}
             </button>
           ) : (
             <button 
               onClick={handleNext}
               className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-blue-700 active:scale-95 transition-all"
             >
               {currentIndex < questions.length - 1 ? t.nextQuestion : t.finishPractice} <i className="fa-solid fa-arrow-right ml-2"></i>
             </button>
           )}
        </div>
      </div>
    );
  }

  // 1. & 2. Selection View (Class -> Subject -> Chapter)
  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      <div className="text-center space-y-2 mb-10">
        <h2 className={`text-3xl font-black ${darkMode ? 'text-white' : 'text-gray-900'}`}>{t.chapterPractice}</h2>
        <p className="opacity-60 font-medium max-w-lg mx-auto">{t.selectPracticeTopic}</p>
      </div>

      {/* Breadcrumbs for Selection */}
      <div className="flex items-center justify-center space-x-2 text-xs font-bold uppercase tracking-widest mb-8 opacity-60">
         <span className={selectedClassId ? 'text-blue-500 cursor-pointer' : ''} onClick={() => { setSelectedClassId(null); setSelectedSubject(null); }}>Class</span>
         <i className="fa-solid fa-chevron-right text-[10px]"></i>
         <span className={selectedSubject ? 'text-blue-500 cursor-pointer' : ''} onClick={() => setSelectedSubject(null)}>Subject</span>
         <i className="fa-solid fa-chevron-right text-[10px]"></i>
         <span>Chapter</span>
      </div>

      {!selectedClassId && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {CLASSES.map(cls => (
             <button 
               key={cls.id} 
               onClick={() => setSelectedClassId(cls.id)}
               className={`p-6 rounded-2xl border-2 transition-all hover:scale-105 ${darkMode ? 'bg-slate-900 border-slate-800 hover:border-blue-500' : 'bg-white border-gray-100 hover:border-blue-400 hover:shadow-xl'}`}
             >
               <h3 className="text-lg font-black">{getLocalizedClassName(cls.id)}</h3>
             </button>
          ))}
        </div>
      )}

      {selectedClassId && !selectedSubject && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-5xl mx-auto animate-fadeIn">
          {CLASSES.find(c => c.id === selectedClassId)?.subjects.map(sub => (
            <button
               key={sub.id}
               onClick={() => setSelectedSubject(sub)}
               className={`group p-6 rounded-3xl border transition-all text-left relative overflow-hidden ${darkMode ? 'bg-slate-900 border-slate-800 hover:border-blue-500' : 'bg-white border-gray-100 hover:shadow-xl hover:border-blue-200'}`}
            >
               <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl shadow-lg mb-4 ${sub.color}`}>
                  <i className={`fa-solid ${sub.icon}`}></i>
               </div>
               <h3 className="text-xl font-bold">{getLocalizedSubjectName(sub.id, sub.name)}</h3>
               <p className="text-xs opacity-50 mt-1">{sub.chapters.length} Chapters</p>
               <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500">
                  <i className="fa-solid fa-arrow-right"></i>
               </div>
            </button>
          ))}
        </div>
      )}

      {selectedClassId && selectedSubject && !selectedChapter && (
         <div className="max-w-3xl mx-auto animate-fadeIn space-y-4">
            {selectedSubject.chapters.map((chap, i) => (
               <button
                  key={chap.id}
                  onClick={() => handleStartPractice(chap)}
                  className={`w-full p-5 rounded-2xl border text-left flex items-center space-x-4 transition-all group ${darkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800' : 'bg-white border-gray-100 hover:bg-blue-50/50 hover:border-blue-200 shadow-sm'}`}
               >
                  <span className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black opacity-50 group-hover:bg-blue-600 group-hover:text-white group-hover:opacity-100 transition-all">{i + 1}</span>
                  <span className="font-bold text-base flex-1">{chap.title}</span>
                  <i className="fa-solid fa-play text-blue-500 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0"></i>
               </button>
            ))}
         </div>
      )}
    </div>
  );
};

export default PracticeMode;
