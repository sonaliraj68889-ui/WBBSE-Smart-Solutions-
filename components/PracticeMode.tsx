
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
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [textAnswer, setTextAnswer] = useState<string>("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [selfGraded, setSelfGraded] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [userAnswers, setUserAnswers] = useState<any[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);

  // Helper to get localized names
  const getLocalizedClassName = (id: string) => (t.classLabels as any)[id] || id;
  const getLocalizedSubjectName = (id: string, name: string) => (t.subjects as any)[id] || name;

  const toggleExpand = (id: string) => {
    setExpandedChapters(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleStartPractice = async (chapter: Chapter) => {
    if (!selectedClassId || !selectedSubject) return;
    
    setSelectedChapter(chapter);
    setLoading(true);
    setError(null);
    setQuestions([]);
    setCurrentIndex(0);
    setScore(0);
    setIsFinished(false);
    setUserAnswers([]);
    setIsReviewing(false);
    
    try {
      const classLabel = getLocalizedClassName(selectedClassId);
      const subjectName = getLocalizedSubjectName(selectedSubject.id, selectedSubject.name);
      
      const generatedQuestions = await generatePracticeSet(subjectName, classLabel, chapter.title, lang, difficulty);
      if (generatedQuestions.length === 0) throw new Error("No questions generated.");
      
      const normalizedQuestions = generatedQuestions.map(q => {
        if (q.type === 'mcq') {
          let ca: any = q.correctAnswer;
          if (typeof ca === 'string') {
            const upper = ca.trim().toUpperCase();
            if (upper === 'A') ca = 0;
            else if (upper === 'B') ca = 1;
            else if (upper === 'C') ca = 2;
            else if (upper === 'D') ca = 3;
            else ca = Number(ca);
          }
          if (typeof ca === 'number' && ca >= 1 && ca <= 4 && q.options?.length === 4) {
             // If model mistakenly used 1-indexed (1,2,3,4) instead of 0-indexed (0,1,2,3)
             // We can't be 100% sure if 1 means B or A, but if it's 4, it definitely means D.
             // Let's just subtract 1 if we detect it's 1-indexed (e.g., if it returns 4, or if we assume all are 1-indexed).
             // Actually, the prompt says 0-3. If it returns 4, it's 1-indexed.
             if (ca === 4) ca = 3;
          }
          
          if (typeof ca !== 'number' || isNaN(ca) || ca < 0 || ca >= (q.options?.length || 4)) {
             ca = 0; // Fallback
          }
          return { ...q, correctAnswer: ca };
        }
        return q;
      });
      
      setQuestions(normalizedQuestions);
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'QUOTA_EXCEEDED') {
        onQuotaExceeded();
      } else if (err instanceof ApiError) {
        switch (err.code) {
          case 'SAFETY_BLOCKED': setError(t.errorSafety); break;
          case 'SERVER_ERROR': setError(t.errorServer); break;
          case 'NETWORK_ERROR': setError("Network error. Please check your internet connection."); break;
          case 'PARSE_ERROR': setError("Failed to generate a complete practice set. Please try again."); break;
          case 'UNKNOWN': setError(err.message || t.errorGeneric); break;
          default: setError(err.message || t.errorGeneric); break;
        }
      } else {
        setError(err instanceof Error ? err.message : t.errorGeneric);
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
    const currentQ = questions[currentIndex];
    
    if (currentQ.type === 'mcq') {
      if (selectedOption === null) return;
      setShowAnswer(true);
      
      const isCorrect = selectedOption === currentQ.correctAnswer;
      setUserAnswers(prev => {
        const newAnswers = [...prev];
        newAnswers[currentIndex] = { type: 'mcq', selectedOption, isCorrect };
        return newAnswers;
      });

      if (isCorrect) {
        setScore(prev => prev + 1);
      }
    } else {
      if (!textAnswer.trim()) return;
      setShowAnswer(true);
    }
  };

  const handleSelfGrade = (isCorrect: boolean) => {
    setSelfGraded(isCorrect);
    setUserAnswers(prev => {
      const newAnswers = [...prev];
      newAnswers[currentIndex] = { type: questions[currentIndex].type, textAnswer, isCorrect };
      return newAnswers;
    });
    if (isCorrect) {
      setScore(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setTextAnswer("");
      setShowAnswer(false);
      setSelfGraded(null);
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
     setUserAnswers([]);
     setIsReviewing(false);
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
    if (isReviewing) {
      return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn pb-20">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black">Review Answers</h2>
            <button onClick={() => setIsReviewing(false)} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-blue-700 transition-all">
              Back to Results
            </button>
          </div>
          <div className="space-y-8">
            {questions.map((q, idx) => {
              const ans = userAnswers[idx];
              const isCorrect = ans?.isCorrect;
              return (
                <div key={idx} className={`p-6 md:p-8 rounded-[2rem] border transition-all ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100 shadow-lg'}`}>
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex-shrink-0 flex items-center justify-center font-black text-xs shadow-md">Q{idx + 1}</span>
                      <span className="px-2 py-1 bg-gray-100 dark:bg-slate-800 rounded text-[10px] font-bold uppercase tracking-widest opacity-60">
                        {q.type === 'mcq' ? 'MCQ' : q.type === 'short' ? 'Short Answer' : 'Long Answer'}
                      </span>
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border ${isCorrect ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : 'text-red-500 bg-red-500/10 border-red-500/20'}`}>
                      {isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>
                  <h5 className="text-lg md:text-xl font-bold leading-snug mb-6"><MathText text={q.question} /></h5>
                  
                  {q.type === 'mcq' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div className={`p-4 rounded-xl border-2 ${isCorrect ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                        <span className="opacity-40 block text-[10px] font-black uppercase mb-2 tracking-widest">Your Answer</span>
                        <span className={`font-bold ${isCorrect ? 'text-emerald-500' : 'text-red-500'}`}>
                          {ans?.selectedOption !== null && ans?.selectedOption !== undefined ? <MathText text={(q.options || [])[ans.selectedOption] || ''} isInline /> : 'Not Answered'}
                        </span>
                      </div>
                      <div className="p-4 rounded-xl border-2 border-emerald-500/20 bg-emerald-500/10">
                        <span className="opacity-40 block text-[10px] font-black uppercase mb-2 tracking-widest text-emerald-600">Correct Answer</span>
                        <span className="text-emerald-600 font-bold">
                          <MathText text={(q.options || [])[q.correctAnswer!] || ''} isInline />
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div className={`p-4 rounded-xl border-2 ${isCorrect ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                        <span className="opacity-40 block text-[10px] font-black uppercase mb-2 tracking-widest">Your Answer</span>
                        <div className={`font-medium text-sm ${isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {ans?.textAnswer ? <MathText text={ans.textAnswer} /> : 'Not Answered'}
                        </div>
                      </div>
                      <div className="p-4 rounded-xl border-2 border-emerald-500/20 bg-emerald-500/10">
                        <span className="opacity-40 block text-[10px] font-black uppercase mb-2 tracking-widest text-emerald-600">Ideal Answer</span>
                        <div className="text-emerald-600 dark:text-emerald-400 font-medium text-sm">
                          <MathText text={q.idealAnswer || ''} />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-gray-50'} border border-current/5`}>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">Explanation</p>
                    <div className="text-sm font-medium leading-relaxed opacity-80"><MathText text={q.explanation} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fadeIn space-y-8">
        <div className="w-24 h-24 rounded-full bg-emerald-500 text-white flex items-center justify-center text-5xl shadow-2xl mb-4">
           <i className="fa-solid fa-trophy"></i>
        </div>
        <h2 className="text-4xl font-black">{t.practiceComplete}</h2>
        <div className="text-6xl font-black text-blue-600">
           {score} <span className="text-3xl opacity-30">/</span> {questions.length}
        </div>
        <div className="text-sm font-bold uppercase tracking-widest opacity-50">
           {lang === 'hi' ? (difficulty === 'Easy' ? 'सरल' : difficulty === 'Medium' ? 'मध्यम' : 'कठिन') : difficulty} {lang === 'hi' ? 'स्तर' : 'Level'}
        </div>
        <div className="flex flex-wrap justify-center gap-4">
           <button onClick={() => setIsReviewing(true)} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-indigo-700 shadow-lg transition-all">
             Review Answers
           </button>
           <button onClick={() => { 
             // Retry same chapter
             if(selectedChapter) handleStartPractice(selectedChapter);
           }} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-blue-700 shadow-lg transition-all">
             Try Again
           </button>
           <button onClick={handleReset} className="px-8 py-3 bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-200 rounded-xl font-bold uppercase tracking-widest hover:bg-gray-200 transition-all">
             {t.mainMenu}
           </button>
        </div>
        <div className="mt-8">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30">Developed by</p>
          <p className="text-xs font-black uppercase tracking-widest text-blue-500 opacity-60 mt-1">Ritik Roushan Sah</p>
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
              <p className="text-xs opacity-50 font-bold uppercase tracking-widest">{t.question} {currentIndex + 1} of {questions.length} • {lang === 'hi' ? (difficulty === 'Easy' ? 'सरल' : difficulty === 'Medium' ? 'मध्यम' : 'कठिन') : difficulty}</p>
           </div>
           <div className="text-right">
              <p className="text-xs opacity-50 font-bold uppercase tracking-widest">{t.score}</p>
              <p className="text-2xl font-black text-blue-600">{score}</p>
           </div>
        </div>

        {/* Question Card */}
        <div className={`p-8 md:p-10 rounded-[2rem] shadow-xl border relative transition-colors ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
           <div className="flex items-center space-x-3 mb-6">
             <span className="px-3 py-1 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg text-xs font-bold uppercase tracking-widest">
               {currentQ.type === 'mcq' ? 'Multiple Choice' : currentQ.type === 'short' ? 'Short Answer' : 'Long Answer'}
             </span>
           </div>
           <h3 className="text-xl md:text-2xl font-bold mb-8 leading-snug">
             <MathText text={currentQ.question} />
           </h3>

           {currentQ.type === 'mcq' ? (
             <div className="space-y-3">
               {currentQ.options?.map((opt, idx) => {
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
           ) : (
             <div className="space-y-4">
               <textarea
                 value={textAnswer}
                 onChange={(e) => setTextAnswer(e.target.value)}
                 disabled={showAnswer}
                 placeholder="Type your answer here..."
                 className={`w-full p-4 rounded-xl border-2 transition-all min-h-[120px] resize-y ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20`}
               />
             </div>
           )}

           {/* Feedback Area */}
           {showAnswer && (
             <div className="mt-8 pt-6 border-t border-dashed border-current/20 animate-fadeIn">
               {currentQ.type === 'mcq' ? (
                 <>
                   <p className={`font-black uppercase tracking-widest text-xs mb-2 ${selectedOption === currentQ.correctAnswer ? 'text-emerald-500' : 'text-red-500'}`}>
                     {selectedOption === currentQ.correctAnswer ? t.correct : t.incorrect}
                   </p>
                   <div className="opacity-80 text-sm font-medium leading-relaxed">
                     <MathText text={currentQ.explanation} />
                   </div>
                 </>
               ) : (
                 <div className="space-y-6">
                   <div>
                     <p className="font-black uppercase tracking-widest text-xs mb-2 text-blue-500">Ideal Answer</p>
                     <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50">
                       <MathText text={currentQ.idealAnswer || ''} />
                     </div>
                   </div>
                   <div>
                     <p className="font-black uppercase tracking-widest text-xs mb-2 opacity-50">Explanation</p>
                     <div className="opacity-80 text-sm font-medium leading-relaxed">
                       <MathText text={currentQ.explanation} />
                     </div>
                   </div>
                   
                   {selfGraded === null ? (
                     <div className="pt-4 flex flex-col items-center space-y-3">
                       <p className="font-bold text-sm">Did you get it right?</p>
                       <div className="flex space-x-4">
                         <button onClick={() => handleSelfGrade(true)} className="px-6 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all flex items-center space-x-2">
                           <i className="fa-solid fa-check"></i> <span>Yes, I got it</span>
                         </button>
                         <button onClick={() => handleSelfGrade(false)} className="px-6 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all flex items-center space-x-2">
                           <i className="fa-solid fa-xmark"></i> <span>No, I missed it</span>
                         </button>
                       </div>
                     </div>
                   ) : (
                     <div className={`p-3 rounded-xl text-center font-bold ${selfGraded ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                       {selfGraded ? 'Marked as Correct' : 'Marked as Incorrect'}
                     </div>
                   )}
                 </div>
               )}
             </div>
           )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4">
           <button onClick={onHome} className="px-6 py-3 rounded-xl font-bold uppercase text-xs tracking-widest opacity-40 hover:opacity-100 transition-opacity flex items-center space-x-2">
              <i className="fa-solid fa-house"></i>
              <span>{t.mainMenu}</span>
           </button>
           {!showAnswer ? (
             <button 
               onClick={handleCheckAnswer} 
               disabled={(currentQ.type === 'mcq' && selectedOption === null) || (currentQ.type !== 'mcq' && !textAnswer.trim())}
               className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none"
             >
               {t.checkAnswer}
             </button>
           ) : (
             <button 
               onClick={handleNext}
               disabled={currentQ.type !== 'mcq' && selfGraded === null}
               className={`px-10 py-4 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all ${currentQ.type !== 'mcq' && selfGraded === null ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}
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
      <div className="flex justify-between items-center mb-10">
        <div className="space-y-2">
          <h2 className={`text-3xl font-black ${darkMode ? 'text-white' : 'text-gray-900'}`}>{t.chapterPractice}</h2>
          <p className="opacity-60 font-medium max-w-lg">{t.selectPracticeTopic}</p>
        </div>
        <div className="flex items-center space-x-3">
          {(selectedClassId || selectedSubject) && (
            <button onClick={() => {
              if (selectedSubject) setSelectedSubject(null);
              else if (selectedClassId) setSelectedClassId(null);
            }} className={`px-4 py-2 rounded-xl flex items-center space-x-2 font-black text-[10px] uppercase tracking-widest shadow-md transition-all hover:bg-opacity-80 ${darkMode ? 'bg-slate-800 text-slate-200' : 'bg-white text-gray-700 border border-gray-100'}`}>
              <i className="fa-solid fa-arrow-left"></i>
              <span className="hidden sm:inline">{t.back}</span>
            </button>
          )}
          <button onClick={onHome} className={`px-4 py-2 rounded-xl flex items-center space-x-2 font-black text-[10px] uppercase tracking-widest shadow-md transition-all hover:bg-opacity-80 ${darkMode ? 'bg-slate-800 text-slate-200' : 'bg-white text-gray-700 border border-gray-100'}`}>
            <i className="fa-solid fa-house"></i>
            <span className="hidden sm:inline">{t.mainMenu}</span>
          </button>
        </div>
      </div>

      {/* Breadcrumbs for Selection */}
      <div className="flex items-center justify-center space-x-2 text-xs font-bold uppercase tracking-widest mb-8 opacity-60">
         <span className={selectedClassId ? 'text-blue-500 cursor-pointer' : ''} onClick={() => { setSelectedClassId(null); setSelectedSubject(null); setError(null); }}>Class</span>
         <i className="fa-solid fa-chevron-right text-[10px]"></i>
         <span className={selectedSubject ? 'text-blue-500 cursor-pointer' : ''} onClick={() => { setSelectedSubject(null); setError(null); }}>Subject</span>
         <i className="fa-solid fa-chevron-right text-[10px]"></i>
         <span>Chapter</span>
      </div>

      {/* Difficulty Selector */}
      {!selectedChapter && (
        <div className="flex justify-center mb-8">
          <div className={`flex items-center p-1 rounded-xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-gray-100 border-gray-200'}`}>
            {(['Easy', 'Medium', 'Hard'] as const).map(level => (
              <button
                key={level}
                onClick={() => setDifficulty(level)}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                  difficulty === level 
                    ? (darkMode ? 'bg-slate-700 text-white shadow-sm' : 'bg-white text-gray-900 shadow-sm') 
                    : (darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700')
                }`}
              >
                {lang === 'hi' ? (level === 'Easy' ? 'सरल' : level === 'Medium' ? 'मध्यम' : 'कठिन') : level}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="max-w-3xl mx-auto p-6 bg-red-100 text-red-700 rounded-2xl flex items-center space-x-4 mb-8">
          <i className="fa-solid fa-triangle-exclamation text-2xl"></i>
          <div>
            <h4 className="font-bold">Error Generating Practice Set</h4>
            <p className="text-sm opacity-80">{error}</p>
          </div>
        </div>
      )}

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
            {selectedSubject.chapters.map((chap, i) => {
              const hasParts = chap.parts && chap.parts.length > 0;
              const isExpanded = expandedChapters[chap.id];
              return (
                <div key={chap.id} className="space-y-2">
                  <button
                    onClick={() => {
                      if (hasParts) {
                        toggleExpand(chap.id);
                      } else {
                        handleStartPractice(chap);
                      }
                    }}
                    className={`w-full p-5 rounded-2xl border text-left flex items-center space-x-4 transition-all group ${darkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800' : 'bg-white border-gray-100 hover:bg-blue-50/50 hover:border-blue-200 shadow-sm'} ${hasParts ? 'cursor-pointer' : ''}`}
                  >
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black transition-all ${hasParts ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 dark:bg-slate-800 opacity-50 group-hover:bg-blue-600 group-hover:text-white group-hover:opacity-100'}`}>{i + 1}</span>
                    <span className="font-bold text-base flex-1">{chap.title}</span>
                    {hasParts ? (
                      <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-gray-400`}></i>
                    ) : (
                      <i className="fa-solid fa-play text-blue-500 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0"></i>
                    )}
                  </button>
                  {hasParts && isExpanded && (
                    <div className="pl-12 pr-2 space-y-2 mt-2">
                      {chap.parts?.map(part => {
                        const hasSubParts = part.parts && part.parts.length > 0;
                        const isPartExpanded = expandedChapters[part.id];
                        return (
                          <div key={part.id} className="space-y-2">
                            <button
                              onClick={() => {
                                if (hasSubParts) {
                                  toggleExpand(part.id);
                                } else {
                                  handleStartPractice(part);
                                }
                              }}
                              className={`w-full p-4 rounded-xl border text-left flex items-center space-x-3 transition-all group ${darkMode ? 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800' : 'bg-gray-50/50 border-gray-100 hover:bg-blue-50/50 hover:border-blue-200 shadow-sm'} ${hasSubParts ? 'cursor-pointer' : ''}`}
                            >
                              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasSubParts ? 'bg-blue-400' : 'bg-gray-300 dark:bg-slate-600'}`}></div>
                              <span className="font-semibold text-sm flex-1">{part.title}</span>
                              {hasSubParts ? (
                                <i className={`fa-solid fa-chevron-${isPartExpanded ? 'up' : 'down'} text-gray-400 text-xs`}></i>
                              ) : (
                                <i className="fa-solid fa-play text-blue-400 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-5px] group-hover:translate-x-0 text-xs"></i>
                              )}
                            </button>
                            {hasSubParts && isPartExpanded && (
                              <div className="pl-8 pr-2 space-y-2 mt-2">
                                {part.parts?.map(subPart => (
                                  <button
                                    key={subPart.id}
                                    onClick={() => handleStartPractice(subPart)}
                                    className={`w-full p-3 rounded-lg border text-left flex items-center space-x-3 transition-all group ${darkMode ? 'bg-slate-800/30 border-slate-700/30 hover:bg-slate-800/80' : 'bg-gray-50/30 border-gray-100 hover:bg-blue-50/30 hover:border-blue-100 shadow-sm'}`}
                                  >
                                    <div className="w-1 h-1 rounded-full bg-gray-300 dark:bg-slate-600 shrink-0 group-hover:bg-blue-400 transition-colors"></div>
                                    <span className="font-medium text-xs flex-1">{subPart.title}</span>
                                    <i className="fa-solid fa-play text-blue-400 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-5px] group-hover:translate-x-0 text-[10px]"></i>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
         </div>
      )}

      <div className="mt-12 text-center pb-8">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30">Developed by</p>
        <p className="text-xs font-black uppercase tracking-widest text-blue-500 opacity-60 mt-1">Ritik Roushan Sah</p>
      </div>
    </div>
  );
};

export default PracticeMode;
