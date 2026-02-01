

import React, { useState, useEffect } from 'react';
import { Subject, Chapter } from '../types.ts';
import { summarizeChapter, fetchChapterQuestions, ApiError } from '../services/geminiService.ts';
import { translations } from '../translations.ts';

interface ChapterViewerProps {
  subject: Subject;
  classId: string;
  onBack: () => void;
  onHome: () => void;
  darkMode: boolean;
  lang: 'en' | 'hi';
  initialChapterId?: string;
  onQuotaExceeded: () => void; // New prop for global quota error handling
}

type SummaryLength = 'short' | 'medium' | 'long';
type ContentMode = 'summary' | 'qa';

interface SolutionState {
  question: string;
  answer: string;
}

const ChapterViewer: React.FC<ChapterViewerProps> = ({ 
  subject, 
  classId, 
  onBack, 
  onHome, 
  darkMode, 
  lang, 
  initialChapterId,
  onQuotaExceeded // Destructure new prop
}) => {
  const t = translations[lang];
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [activeMode, setActiveMode] = useState<ContentMode>('summary');
  
  const [summary, setSummary] = useState<string | null>(null);
  const [qaSolutions, setQaSolutions] = useState<SolutionState[]>([]);
  
  const [summaryLength, setSummaryLength] = useState<SummaryLength>('medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [visibleAnswers, setVisibleAnswers] = useState<Record<string, boolean>>({});

  const getLocalizedSubjectName = () => t.subjects[subject.id as keyof typeof t.subjects] || subject.name;
  const getLocalizedClassName = () => (t.classLabels as any)[classId] || classId;

  const handleApiError = (err: any) => {
    if (err instanceof ApiError) {
      switch (err.code) {
        case 'QUOTA_EXCEEDED':
          onQuotaExceeded(); // Trigger global prompt
          setError(null); // Clear local error if global prompt takes over
          setErrorDetails(null);
          break;
        case 'SAFETY_BLOCKED': setError(t.errorSafety); break;
        case 'SERVER_ERROR': setError(t.errorServer); break;
        default: setError(t.errorGeneric); break;
      }
      if (err.code !== 'QUOTA_EXCEEDED') { // Only set local details if not quota error
        setErrorDetails(err.message);
      }
    } else {
      setError(t.errorGeneric);
    }
  };

  const loadSummary = async (chapter: Chapter, length: SummaryLength = 'medium') => {
    setLoading(true);
    setError(null);
    setErrorDetails(null);
    setSelectedChapter(chapter);
    setActiveMode('summary');
    try {
      const result = await summarizeChapter(chapter.title, getLocalizedSubjectName(), length, subject.id);
      setSummary(result);
    } catch (e) { 
      handleApiError(e);
    } finally { 
      setLoading(false); 
    }
  };

  const handleModeSwitch = async (mode: ContentMode) => {
    if (!selectedChapter || loading) return;
    setActiveMode(mode);
    setError(null);
    setErrorDetails(null);
    
    if (mode === 'summary' && !summary) {
      loadSummary(selectedChapter, summaryLength);
    } else if (mode === 'qa' && qaSolutions.length === 0) {
      setLoading(true);
      try {
        const questions = await fetchChapterQuestions(selectedChapter.title, getLocalizedSubjectName(), summary || "", subject.id);
        setQaSolutions(questions);
      } catch (err) { 
        handleApiError(err);
      } finally { 
        setLoading(false); 
      }
    }
  };

  const toggleAnswer = (key: string) => setVisibleAnswers(prev => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    if (initialChapterId) {
      const chapter = subject.chapters.find(c => c.id === initialChapterId);
      if (chapter) loadSummary(chapter, summaryLength);
    }
  }, [initialChapterId]);

  return (
    <div className="animate-fadeIn space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className={`w-10 h-10 flex items-center justify-center rounded-full shadow-md transition-all hover:scale-110 active:scale-95 ${darkMode ? 'bg-slate-800 text-slate-100' : 'bg-white text-gray-600'}`}>
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <div>
            <h2 className={`text-2xl font-bold ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>{getLocalizedSubjectName()}</h2>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-40">{getLocalizedClassName()}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={onHome} className={`px-4 py-2 rounded-xl flex items-center space-x-2 font-black text-[10px] uppercase tracking-widest shadow-md transition-all hover:bg-opacity-80 ${darkMode ? 'bg-slate-800 text-slate-200' : 'bg-white text-gray-700 border border-gray-100'}`}>
            <i className="fa-solid fa-house"></i>
            <span>{t.mainMenu}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-4">
          <div className={`p-6 rounded-[2rem] border shadow-sm ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
            <h3 className="font-black mb-4 uppercase text-[11px] tracking-widest opacity-40">Chapter Index</h3>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
              {subject.chapters.map((chapter, idx) => (
                <button
                  key={chapter.id}
                  onClick={() => loadSummary(chapter)}
                  className={`w-full text-left p-4 rounded-2xl transition-all border flex items-center space-x-3 group ${
                    selectedChapter?.id === chapter.id 
                      ? (darkMode ? 'bg-blue-600 border-blue-500 text-white shadow-lg translate-x-1' : 'bg-blue-600 border-blue-500 text-white shadow-lg translate-x-1')
                      : (darkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-blue-500 hover:text-slate-200' : 'bg-white border-gray-100 text-gray-700 hover:border-blue-300 hover:bg-blue-50/50')
                  }`}
                >
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${selectedChapter?.id === chapter.id ? 'bg-white/20' : 'bg-current opacity-10'}`}>{idx + 1}</span>
                  <span className="font-bold text-sm leading-tight">{chapter.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 flex flex-col space-y-6">
          {!selectedChapter ? (
            <div className={`rounded-[3rem] p-20 text-center border-2 border-dashed flex flex-col items-center justify-center space-y-6 h-full ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-600' : 'bg-white border-gray-200 text-gray-300'}`}>
              <i className="fa-solid fa-book-open-reader text-6xl"></i>
              <div>
                <h3 className="text-2xl font-black uppercase tracking-widest mb-2">{t.selectChapter}</h3>
                <p className="text-sm font-bold opacity-60">Professional board solutions for Hindi medium.</p>
              </div>
            </div>
          ) : (
            <div className={`rounded-[2.5rem] shadow-2xl border overflow-hidden flex flex-col transition-all duration-500 ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-gray-100'}`}>
              <div className={`p-6 md:p-10 text-white relative overflow-hidden ${subject.color}`}>
                <div className="absolute -right-10 -top-10 text-[10rem] opacity-10 rotate-12">
                   <i className={`fa-solid ${subject.icon}`}></i>
                </div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] bg-white/20 px-4 py-1.5 rounded-full">{getLocalizedClassName()}</span>
                    {activeMode !== 'summary' && (
                      <button 
                        onClick={() => setActiveMode('summary')} 
                        className="px-5 py-2 bg-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-white/30 flex items-center"
                      >
                        <i className="fa-solid fa-arrow-left mr-2"></i> {t.summary}
                      </button>
                    )}
                  </div>
                  <h3 className="text-3xl md:text-4xl font-black tracking-tighter uppercase leading-none">{selectedChapter.title}</h3>
                </div>
              </div>

              <div className="p-8 md:p-14 flex-1 overflow-y-auto custom-scrollbar min-h-[500px]">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-24 space-y-6">
                    <div className="relative">
                       <div className="w-16 h-16 border-8 border-blue-600/10 border-t-blue-500 rounded-full animate-spin"></div>
                       <i className="fa-solid fa-bolt-lightning absolute inset-0 flex items-center justify-center text-blue-500 animate-pulse text-2xl"></i>
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-40 mb-2">{t.generateNotes}</p>
                      <p className="text-xs font-bold italic opacity-30">AI is composing your board-standard solutions...</p>
                    </div>
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-8 animate-fadeIn">
                    <div className="w-20 h-20 bg-red-100 text-red-600 rounded-[2rem] flex items-center justify-center text-3xl shadow-xl shadow-red-500/10"><i className="fa-solid fa-triangle-exclamation"></i></div>
                    <div>
                      <h4 className="text-2xl font-black mb-1">{error}</h4>
                      {errorDetails && <p className="text-[10px] font-mono opacity-30 mb-4">{errorDetails}</p>}
                      <p className="text-sm opacity-60 font-medium max-w-xs mx-auto">This might be due to a server hiccup or API quota. Please try generating it again.</p>
                    </div>
                    <button 
                      onClick={() => activeMode === 'summary' ? loadSummary(selectedChapter) : handleModeSwitch(activeMode)} 
                      className="px-10 py-4 bg-blue-600 text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl hover:bg-blue-700 active:scale-95 transition-all"
                    >
                      Retry Generation
                    </button>
                  </div>
                ) : (
                  <div className="animate-fadeIn space-y-12">
                    {summary && (
                      <div className="space-y-10">
                        <section className="space-y-8 relative">
                          <div className="flex items-center justify-between border-b-4 border-double pb-6 mb-10 border-current/10">
                            <div className="flex items-center space-x-3">
                               <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-xl shadow-lg shadow-blue-500/20">
                                  <i className="fa-solid fa-book-open"></i>
                               </div>
                               <h4 className="text-xl font-black uppercase tracking-tight text-blue-600">{t.summary}</h4>
                            </div>
                            <div className="flex bg-gray-100 dark:bg-slate-900 p-1.5 rounded-2xl">
                              {['short', 'medium', 'long'].map(l => (
                                <button 
                                  key={l} 
                                  onClick={() => loadSummary(selectedChapter, l as SummaryLength)} 
                                  className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${summaryLength === l ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 dark:text-slate-500 hover:text-blue-500'}`}
                                >
                                  {(t as any)[l]}
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          <div className={`prose max-w-none ${darkMode ? 'prose-invert prose-slate' : 'prose-blue'} text-lg md:text-xl leading-[1.8] font-medium whitespace-pre-wrap`}>
                            {summary}
                          </div>
                        </section>

                        {activeMode === 'summary' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-16 border-t-2 border-dashed border-current/10">
                            <button 
                              onClick={() => handleModeSwitch('qa')} 
                              className={`group p-8 rounded-[2.5rem] border-2 text-left space-y-5 transition-all transform hover:-translate-y-2 ${darkMode ? 'bg-slate-900 border-slate-800 hover:border-amber-500' : 'bg-amber-50/30 border-amber-100 hover:border-amber-400 shadow-sm'}`}
                            >
                              <div className="w-14 h-14 rounded-3xl bg-amber-500 text-white flex items-center justify-center text-2xl shadow-xl shadow-amber-500/30 group-hover:rotate-12 transition-transform">
                                <i className="fa-solid fa-pen-to-square"></i>
                              </div>
                              <div>
                                <h5 className="font-black text-xl uppercase tracking-tight leading-tight">{t.generateQA}</h5>
                                <p className="text-xs opacity-50 mt-1 font-bold leading-relaxed">Top 5 board-standard questions with model answers in Hindi Medium.</p>
                              </div>
                              <div className="flex items-center text-amber-600 font-black text-[10px] uppercase tracking-widest pt-4 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all">
                                <span>Explore Solutions</span> <i className="fa-solid fa-arrow-right ml-2"></i>
                              </div>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {activeMode === 'qa' && (
                      <div className="space-y-10 py-4 animate-fadeIn">
                        <div className="flex items-center justify-between border-b pb-4">
                           <h4 className="flex items-center space-x-4 text-2xl font-black uppercase tracking-tight">
                              <i className="fa-solid fa-pen-to-square text-amber-500"></i>
                              <span>{t.generateQA}</span>
                           </h4>
                           <button onClick={() => handleModeSwitch('qa')} className="text-[10px] font-black uppercase text-blue-500 hover:underline"><i className="fa-solid fa-rotate mr-2"></i> {t.regenerateQA}</button>
                        </div>
                        <div className="space-y-6">
                          {qaSolutions.map((qa, i) => (
                            <div key={i} className={`rounded-3xl border transition-all ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100 shadow-xl'}`}>
                              <button onClick={() => toggleAnswer(`qa-${i}`)} className="w-full text-left p-8 flex items-start justify-between group">
                                <div className="flex items-start space-x-6">
                                   <span className="w-10 h-10 flex-shrink-0 bg-amber-500 text-white rounded-2xl flex items-center justify-center text-sm font-black shadow-lg group-hover:scale-110 transition-transform">Q{i+1}</span>
                                   <span className="font-black text-xl leading-snug tracking-tight">{qa.question}</span>
                                </div>
                                <i className={`fa-solid fa-chevron-${visibleAnswers[`qa-${i}`] ? 'up' : 'down'} opacity-20 mt-3 text-sm`}></i>
                              </button>
                              {visibleAnswers[`qa-${i}`] && (
                                <div className={`p-10 border-t bg-gray-50 dark:bg-slate-800/50 text-base md:text-lg leading-[1.8] font-medium whitespace-pre-wrap animate-fadeIn border-l-8 border-amber-500`}>{qa.answer}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className={`p-6 border-t flex items-center justify-between ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-gray-50 border-gray-100'}`}>
                 <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30">{t.developedBy} {t.authorName}</span>
                 <p className="text-[11px] font-bold opacity-20">WBBSE Smart Solutions AI-Powered Content</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChapterViewer;