
import React, { useState, useEffect } from 'react';
import { Subject, Chapter } from '../types.ts';
import { summarizeChapter, fetchChapterQuestions, ApiError } from '../services/geminiService.ts';
import { saveOfflineContent, getOfflineContent, isOffline } from '../services/offlineService.ts';
import { translations } from '../translations.ts';
import MathText from './MathText.tsx';

interface ChapterViewerProps {
  subject: Subject;
  classId: string;
  onBack: () => void;
  onHome: () => void;
  darkMode: boolean;
  lang: 'en' | 'hi';
  initialChapterId?: string;
  onQuotaExceeded: () => void;
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
  onQuotaExceeded 
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
  const contentRef = React.useRef<HTMLDivElement>(null);

  const getLocalizedSubjectName = () => t.subjects[subject.id as keyof typeof t.subjects] || subject.name;
  const getLocalizedClassName = () => (t.classLabels as any)[classId] || classId;

  const handleApiError = (err: any) => {
    if (err instanceof ApiError) {
      switch (err.code) {
        case 'QUOTA_EXCEEDED':
          onQuotaExceeded(); 
          setError(null); 
          setErrorDetails(null);
          break;
        case 'SAFETY_BLOCKED': setError(t.errorSafety); break;
        case 'SERVER_ERROR': setError(t.errorServer); break;
        default: setError(t.errorGeneric); break;
      }
      if (err.code !== 'QUOTA_EXCEEDED') { 
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
    
    // Scroll to content area
    if (contentRef.current) {
      setTimeout(() => {
        contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }

    try {
      if (isOffline()) {
        const offlineData = await getOfflineContent(classId, subject.id, chapter.id, 'summary');
        if (offlineData) {
          setSummary(offlineData);
        } else {
          setError("You are offline and this chapter's summary is not saved.");
        }
      } else {
        const result = await summarizeChapter(chapter.title, getLocalizedSubjectName(), length, subject.id);
        setSummary(result);
        await saveOfflineContent(classId, subject.id, chapter.id, chapter.title, 'summary', result);
      }
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
        if (isOffline()) {
          const offlineData = await getOfflineContent(classId, subject.id, selectedChapter.id, 'qa');
          if (offlineData) {
            setQaSolutions(offlineData);
          } else {
            setError("You are offline and this chapter's Q&A is not saved.");
          }
        } else {
          const questions = await fetchChapterQuestions(selectedChapter.title, getLocalizedSubjectName(), summary || "", subject.id);
          setQaSolutions(questions);
          await saveOfflineContent(classId, subject.id, selectedChapter.id, selectedChapter.title, 'qa', questions);
        }
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

  const currentIndex = selectedChapter ? subject.chapters.findIndex(c => c.id === selectedChapter.id) : -1;
  const nextChapter = currentIndex >= 0 && currentIndex < subject.chapters.length - 1 ? subject.chapters[currentIndex + 1] : null;

  return (
    <div className="animate-fadeIn space-y-6 pb-20">
      {/* Interactive Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
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

      {/* Interactive Main Layout */}
      <div className={`grid grid-cols-1 ${!selectedChapter ? 'lg:grid-cols-1 max-w-3xl mx-auto w-full' : 'lg:grid-cols-3'} gap-8`}>
        <div className={`${selectedChapter ? 'hidden lg:block lg:col-span-1' : ''} space-y-4`}>
          <div className={`p-6 md:p-8 rounded-[2rem] border shadow-sm flex flex-col h-full ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black uppercase text-[11px] tracking-widest opacity-50 flex items-center">
                <i className="fa-solid fa-list-ul mr-2"></i> Chapter Index
              </h3>
              <span className="text-[10px] font-bold bg-blue-500/10 text-blue-600 px-2.5 py-1 rounded-lg">{subject.chapters.length}</span>
            </div>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2 flex-1">
              {subject.chapters.map((chapter, idx) => {
                const isSelected = selectedChapter?.id === chapter.id;
                return (
                  <button
                    key={chapter.id}
                    onClick={() => loadSummary(chapter)}
                    className={`w-full text-left p-4 rounded-2xl transition-all duration-300 border flex items-start space-x-4 group relative overflow-hidden ${
                      isSelected 
                        ? (darkMode ? 'bg-gradient-to-br from-blue-600 to-indigo-700 border-blue-500 text-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] shadow-blue-500/30 scale-[1.02]' : 'bg-gradient-to-br from-blue-500 to-indigo-600 border-blue-400 text-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] shadow-blue-500/30 scale-[1.02]')
                        : (darkMode ? 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:border-slate-600 hover:text-slate-200' : 'bg-gray-50/50 border-gray-100 text-gray-600 hover:bg-white hover:border-gray-200 hover:shadow-md hover:text-gray-900')
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-white/30 rounded-l-2xl"></div>
                    )}
                    <span className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center text-[11px] font-black transition-colors ${
                      isSelected 
                        ? 'bg-white/20 text-white shadow-inner' 
                        : (darkMode ? 'bg-slate-900 text-slate-500 group-hover:bg-slate-700 group-hover:text-slate-300' : 'bg-white text-gray-400 shadow-sm group-hover:bg-blue-50 group-hover:text-blue-500')
                    }`}>
                      {idx + 1}
                    </span>
                    <div className="flex flex-col pt-1">
                      <span className={`font-bold text-sm leading-snug ${isSelected ? 'text-white' : ''}`}>{chapter.title}</span>
                      {isSelected && <span className="text-[9px] font-black uppercase tracking-widest text-blue-100 mt-2 flex items-center"><i className="fa-solid fa-bolt text-amber-300 mr-1.5"></i> Active</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {selectedChapter && (
          <div className="lg:col-span-2 flex flex-col space-y-6" ref={contentRef}>
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
                          
                          <div className={`prose max-w-none ${darkMode ? 'prose-invert prose-slate' : 'prose-blue'} text-lg md:text-xl leading-[1.8] font-medium`}>
                            <MathText text={summary} />
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
                      <div className="space-y-10 animate-fadeIn">
                        <div className="flex items-center justify-between border-b-4 border-double pb-6 mb-10 border-current/10">
                           <div className="flex items-center space-x-3">
                              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-xl shadow-lg shadow-amber-500/20">
                                 <i className="fa-solid fa-clipboard-question"></i>
                              </div>
                              <h4 className="text-xl font-black uppercase tracking-tight text-amber-600">{t.generateQA}</h4>
                           </div>
                           <button 
                             onClick={() => handleModeSwitch('qa')} 
                             className="w-10 h-10 rounded-xl flex items-center justify-center border hover:bg-gray-50 dark:hover:bg-slate-800 transition-all" 
                             title={t.regenerateQA}
                           >
                             <i className="fa-solid fa-rotate-right"></i>
                           </button>
                        </div>

                        {qaSolutions.map((qa, index) => (
                          <div key={index} className={`p-6 md:p-8 rounded-[2rem] border transition-all ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100 shadow-lg'}`}>
                             <div className="flex items-start space-x-4 mb-6">
                               <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex-shrink-0 flex items-center justify-center font-black text-xs shadow-md">Q{index + 1}</span>
                               <h5 className="text-lg md:text-xl font-bold leading-snug pt-1"><MathText text={qa.question} /></h5>
                             </div>
                             
                             <div className={`relative overflow-hidden rounded-2xl transition-all ${visibleAnswers[`q-${index}`] ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                               <div className={`p-6 md:p-8 border-t-2 border-dashed border-current/10 ${darkMode ? 'bg-slate-800/50' : 'bg-gray-50'}`}>
                                  <div className="flex items-center space-x-2 mb-4 opacity-40">
                                    <i className="fa-solid fa-pen-nib text-xs"></i>
                                    <span className="text-[10px] font-black uppercase tracking-widest">{lang === 'hi' ? 'उत्तर' : 'Answer'}</span>
                                  </div>
                                  <div className="text-base md:text-lg leading-relaxed font-medium opacity-90"><MathText text={qa.answer} /></div>
                               </div>
                             </div>
                             
                             <button 
                               onClick={() => toggleAnswer(`q-${index}`)} 
                               className={`w-full py-4 mt-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center space-x-2 transition-all ${
                                 visibleAnswers[`q-${index}`] 
                                   ? (darkMode ? 'bg-slate-800 text-slate-400' : 'bg-gray-100 text-gray-500') 
                                   : 'bg-blue-600 text-white shadow-xl hover:bg-blue-700 active:scale-95'
                               }`}
                             >
                               <span>{visibleAnswers[`q-${index}`] ? t.hideSolutions : t.viewSolutions}</span>
                               <i className={`fa-solid ${visibleAnswers[`q-${index}`] ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                             </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {nextChapter && (
                      <div className="mt-12 pt-8 border-t-2 border-dashed border-current/10 flex justify-end">
                        <button
                          onClick={() => loadSummary(nextChapter)}
                          className={`group flex items-center space-x-4 px-8 py-4 rounded-2xl transition-all shadow-md hover:shadow-xl ${
                            darkMode ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-100'
                          }`}
                        >
                          <div className="text-right">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">Next Chapter</p>
                            <p className="font-bold text-sm truncate max-w-[200px]">{nextChapter.title}</p>
                          </div>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:translate-x-1 ${
                            darkMode ? 'bg-slate-900 text-blue-400' : 'bg-blue-50 text-blue-600'
                          }`}>
                            <i className="fa-solid fa-arrow-right"></i>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-12 text-center pb-8">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30">Developed by</p>
        <p className="text-xs font-black uppercase tracking-widest text-blue-500 opacity-60 mt-1">Ritik Roushan Sah</p>
      </div>
    </div>
  );
};

export default ChapterViewer;
