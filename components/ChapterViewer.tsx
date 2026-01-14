
import React, { useState, useEffect } from 'react';
import { Subject, Chapter } from '../types';
import { summarizeChapter, fetchChapterQuestions, translateContent } from '../services/geminiService';
import { translations } from '../translations';
import { USEFUL_LINKS } from '../constants';

interface ChapterViewerProps {
  subject: Subject;
  classLabel: string;
  onBack: () => void;
  onHome: () => void;
  darkMode: boolean;
  lang: 'en' | 'hi';
  initialChapterId?: string;
}

type SummaryLength = 'short' | 'medium' | 'long';

interface SolutionPair {
  question: string;
  answer: string;
}

interface SolutionState {
  original: SolutionPair;
  translated?: SolutionPair;
  showTranslated: boolean;
  isTranslating: boolean;
}

const ChapterViewer: React.FC<ChapterViewerProps> = ({ subject, classLabel, onBack, onHome, darkMode, lang, initialChapterId }) => {
  const t = translations[lang];
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLength, setSummaryLength] = useState<SummaryLength>('medium');
  const [solutionStates, setSolutionStates] = useState<SolutionState[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [visibleAnswers, setVisibleAnswers] = useState<Record<number, boolean>>({});
  const [showCopied, setShowCopied] = useState(false);

  const getLocalizedSubjectName = () => {
    return t.subjects[subject.id as keyof typeof t.subjects] || subject.name;
  };

  const currentIndex = selectedChapter 
    ? subject.chapters.findIndex(c => c.id === selectedChapter.id) 
    : -1;

  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < subject.chapters.length - 1;

  const fetchSummary = async (chapter: Chapter, length: SummaryLength = 'medium') => {
    setLoading(true);
    setSummary(null);
    setSolutionStates([]);
    setVisibleAnswers({});
    setSelectedChapter(chapter);
    setSummaryLength(length);
    const result = await summarizeChapter(chapter.title, getLocalizedSubjectName(), length, subject.id);
    setSummary(result);
    setLoading(false);
  };

  const handleNext = () => {
    if (hasNext && !loading) {
      fetchSummary(subject.chapters[currentIndex + 1], summaryLength);
    }
  };

  const handlePrevious = () => {
    if (hasPrevious && !loading) {
      fetchSummary(subject.chapters[currentIndex - 1], summaryLength);
    }
  };

  const handleShare = async () => {
    if (!selectedChapter || !summary) return;
    const shareData = {
      title: `${selectedChapter.title} - WBBSE Smart Solutions`,
      text: `Check out these study notes for ${selectedChapter.title} (${getLocalizedSubjectName()}, Class ${classLabel}).`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  };

  // Keyboard Navigation Support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrevious();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, loading]);

  useEffect(() => {
    if (selectedChapter) {
      fetchSummary(selectedChapter, summaryLength);
    }
  }, [summaryLength]);

  useEffect(() => {
    if (initialChapterId) {
      const chapter = subject.chapters.find(c => c.id === initialChapterId);
      if (chapter) {
        fetchSummary(chapter, summaryLength);
      }
    }
  }, [initialChapterId]);

  const handleGenerateQuestions = async () => {
    if (!selectedChapter || !summary || generatingQuestions) return;
    
    setGeneratingQuestions(true);
    try {
      const sList = await fetchChapterQuestions(selectedChapter.title, getLocalizedSubjectName(), summary, subject.id);
      setSolutionStates(sList.map(pair => ({
        original: pair,
        showTranslated: false,
        isTranslating: false
      })));
    } catch (err) {
      console.error("Failed to generate questions");
    } finally {
      setGeneratingQuestions(false);
    }
  };

  const toggleAnswer = (idx: number) => {
    setVisibleAnswers(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleTranslateSolution = async (idx: number) => {
    const state = solutionStates[idx];
    if (state.translated) {
      setSolutionStates(prev => prev.map((s, i) => i === idx ? { ...s, showTranslated: !s.showTranslated } : s));
      return;
    }

    setSolutionStates(prev => prev.map((s, i) => i === idx ? { ...s, isTranslating: true } : s));
    
    try {
      const targetLang = subject.id === 'english' ? 'Hindi' : 'English';
      
      const [translatedQ, translatedA] = await Promise.all([
        translateContent(state.original.question, targetLang as any),
        translateContent(state.original.answer, targetLang as any)
      ]);

      setSolutionStates(prev => prev.map((s, i) => i === idx ? { 
        ...s, 
        translated: { question: translatedQ, answer: translatedA },
        showTranslated: true,
        isTranslating: false 
      } : s));
    } catch (err) {
      setSolutionStates(prev => prev.map((s, i) => i === idx ? { ...s, isTranslating: false } : s));
    }
  };

  const getSearchUrl = (baseUrl: string) => {
    if (!selectedChapter) return baseUrl;
    const query = encodeURIComponent(`WBBSE ${getLocalizedSubjectName()} ${selectedChapter.title} solutions`);
    if (baseUrl.includes('wbbsesolutions.com')) {
      return `https://wbbsesolutions.com/?s=${query}`;
    }
    return baseUrl;
  };

  const lengthOptions: { id: SummaryLength, icon: string }[] = [
    { id: 'short', icon: 'fa-bolt-lightning' },
    { id: 'medium', icon: 'fa-bars-staggered' },
    { id: 'long', icon: 'fa-list-check' }
  ];

  return (
    <div className="animate-fadeIn space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <button 
            onClick={onBack}
            className={`w-10 h-10 flex items-center justify-center rounded-full shadow-md transition-colors ${
              darkMode ? 'bg-slate-800 text-slate-100 hover:bg-slate-700' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
            title={t.back}
          >
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <div>
            <h2 className={`text-3xl font-bold ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>{getLocalizedSubjectName()}</h2>
            <p className={darkMode ? 'text-slate-400' : 'text-gray-500'}>{classLabel} {t.curriculum}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {showCopied && (
            <span className="text-[10px] font-bold text-emerald-500 animate-fadeIn">{t.copied}</span>
          )}
          
          <button 
            onClick={onHome}
            className={`px-4 py-2 rounded-xl flex items-center space-x-2 font-black text-xs uppercase tracking-widest transition-all shadow-md ${
              darkMode ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-100'
            }`}
          >
            <i className="fa-solid fa-house"></i>
            <span>{t.mainMenu}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chapter List */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className={`font-bold px-2 uppercase tracking-wider text-xs ${darkMode ? 'text-slate-500' : 'text-gray-700'}`}>Chapters</h3>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto no-scrollbar pr-1">
            {subject.chapters.map((chapter) => (
              <button
                key={chapter.id}
                onClick={() => fetchSummary(chapter, summaryLength)}
                className={`w-full text-left p-4 rounded-2xl transition-all border ${
                  selectedChapter?.id === chapter.id 
                    ? (darkMode ? 'bg-blue-900/30 border-blue-800 text-blue-400 shadow-lg' : 'bg-blue-50 border-blue-200 text-blue-800 shadow-sm')
                    : (darkMode ? 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300' : 'bg-white border-gray-100 hover:border-blue-100 text-gray-700')
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    selectedChapter?.id === chapter.id 
                      ? 'bg-blue-600 text-white' 
                      : (darkMode ? 'bg-slate-800 text-slate-500' : 'bg-gray-100 text-gray-400')
                  }`}>
                    {subject.chapters.indexOf(chapter) + 1}
                  </div>
                  <span className="font-semibold">{chapter.title}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Content Viewer */}
        <div className="lg:col-span-2 flex flex-col space-y-6">
          {!selectedChapter ? (
            <div className={`rounded-3xl p-12 text-center border-2 border-dashed flex flex-col items-center justify-center space-y-4 h-full ${
              darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'
            }`}>
              <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl ${
                darkMode ? 'bg-slate-800 text-blue-400' : 'bg-blue-50 text-blue-500'
              }`}>
                <i className="fa-solid fa-book-open-reader"></i>
              </div>
              <h3 className={`text-xl font-bold ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>{t.selectChapter}</h3>
              <p className={darkMode ? 'text-slate-400' : 'text-gray-500'}>
                Get instant Hindi summaries, key definitions, and typical exam questions for each chapter.
              </p>
            </div>
          ) : (
            <>
              <div className={`rounded-3xl shadow-sm border overflow-hidden min-h-[500px] flex-1 flex flex-col ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'
              }`}>
                <div className={`p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${subject.color}`}>
                  <div className="flex items-center space-x-4">
                    {/* Compact Top Navigation */}
                    <div className="flex items-center space-x-1 bg-black/10 rounded-xl p-1">
                      <button 
                        onClick={handlePrevious} 
                        disabled={!hasPrevious || loading}
                        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/20 disabled:opacity-30 transition-all"
                        title="Previous Chapter"
                      >
                        <i className="fa-solid fa-chevron-left text-xs"></i>
                      </button>
                      <span className="text-[10px] font-black w-10 text-center opacity-80 tabular-nums">
                        {currentIndex + 1} / {subject.chapters.length}
                      </span>
                      <button 
                        onClick={handleNext} 
                        disabled={!hasNext || loading}
                        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/20 disabled:opacity-30 transition-all"
                        title="Next Chapter"
                      >
                        <i className="fa-solid fa-chevron-right text-xs"></i>
                      </button>
                    </div>
                    
                    <div>
                      <h3 className="text-xl font-bold leading-tight">{selectedChapter.title}</h3>
                      <p className="text-xs opacity-80 font-medium">AI-Generated Study Notes</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {/* Visual Segmented Control for Summary Length */}
                    <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-1.5 flex items-center border border-white/10 shadow-inner">
                       {lengthOptions.map((opt) => (
                         <button 
                           key={opt.id}
                           onClick={() => setSummaryLength(opt.id)}
                           className={`relative group px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-2 ${
                             summaryLength === opt.id 
                               ? 'bg-white text-blue-900 shadow-[0_4px_12px_rgba(0,0,0,0.15)] scale-100' 
                               : 'text-white/70 hover:text-white hover:bg-white/5 scale-95'
                           }`}
                         >
                           <i className={`fa-solid ${opt.icon} ${summaryLength === opt.id ? 'text-blue-600' : 'opacity-60'}`}></i>
                           <span className="hidden sm:inline">{t[opt.id]}</span>
                         </button>
                       ))}
                    </div>
                    
                    <button 
                      onClick={handleShare}
                      className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors shadow-sm"
                      title={t.share}
                    >
                      <i className="fa-solid fa-share-nodes"></i>
                    </button>

                    <button 
                      onClick={() => window.print()}
                      className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors shadow-sm"
                      title="Print Notes"
                    >
                      <i className="fa-solid fa-print"></i>
                    </button>
                  </div>
                </div>

                <div className="p-8 flex-1">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className={darkMode ? 'text-slate-400 font-medium' : 'text-gray-500 font-medium'}>{t.generateNotes}</p>
                    </div>
                  ) : (
                    <div className="space-y-10">
                      <div className={`prose max-w-none ${darkMode ? 'prose-invert prose-slate' : 'prose-blue'} animate-fadeIn`}>
                        {summary?.split('\n').map((line, i) => {
                          if (line.startsWith('# ')) return <h1 key={i} className="text-3xl font-bold mb-4 mt-6 border-b pb-2">{line.replace('# ', '')}</h1>;
                          if (line.startsWith('## ')) return <h2 key={i} className="text-2xl font-bold mb-3 mt-5">{line.replace('## ', '')}</h2>;
                          if (line.startsWith('### ')) return <h3 key={i} className="text-xl font-bold mb-2 mt-4">{line.replace('### ', '')}</h3>;
                          if (line.trim() === '') return <div key={i} className="h-4" />;
                          return <p key={i} className="mb-4 leading-relaxed whitespace-pre-wrap text-inherit">{line}</p>;
                        })}
                      </div>

                      {/* Explicit Q&A Generation Button for better UX after reading summary */}
                      {solutionStates.length === 0 && !generatingQuestions && summary && (
                        <div className="flex justify-center py-6">
                           <button 
                            onClick={handleGenerateQuestions}
                            className="group relative px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-[0_10px_30px_-10px_rgba(37,99,235,0.5)] hover:bg-blue-700 hover:-translate-y-1 active:scale-95 transition-all flex items-center space-x-3 overflow-hidden"
                          >
                            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                            <i className="fa-solid fa-wand-magic-sparkles text-amber-300"></i>
                            <span>{t.generateQA}</span>
                          </button>
                        </div>
                      )}

                      {/* Practice Questions & Answers Area */}
                      <div className={`mt-12 pt-10 border-t ${darkMode ? 'border-slate-800' : 'border-gray-100'}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                           <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                                 <i className="fa-solid fa-pen-to-square"></i>
                              </div>
                              <h4 className="font-black text-lg uppercase tracking-tight">{lang === 'hi' ? 'महत्वपूर्ण प्रश्न और उत्तर' : 'Important Questions & Answers'}</h4>
                           </div>
                           
                           {solutionStates.length > 0 && (
                             <button 
                               onClick={handleGenerateQuestions}
                               disabled={generatingQuestions}
                               className={`px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 flex items-center space-x-2 ${
                                 darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                               }`}
                             >
                               {generatingQuestions ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-rotate"></i>}
                               <span>{t.regenerateQA}</span>
                             </button>
                           )}
                        </div>

                        {solutionStates.length > 0 && (
                          <div className="space-y-6 animate-fadeIn">
                            {solutionStates.map((state, i) => {
                              const currentPair = state.showTranslated && state.translated ? state.translated : state.original;
                              
                              return (
                                <div key={i} className={`rounded-2xl border transition-all overflow-hidden ${
                                  darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-100 shadow-sm'
                                }`}>
                                  <div className={`p-5 flex items-start space-x-4`}>
                                    <span className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white rounded-lg flex items-center justify-center font-black text-xs shadow-md">
                                      Q{i+1}
                                    </span>
                                    <div className="flex-1">
                                      <div className="flex items-start justify-between">
                                        <p className="font-bold leading-relaxed pr-8">{currentPair.question}</p>
                                        <button 
                                          onClick={() => handleTranslateSolution(i)}
                                          disabled={state.isTranslating}
                                          className={`flex-shrink-0 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                                            state.isTranslating 
                                              ? 'bg-gray-100 text-gray-400' 
                                              : 'bg-blue-500/10 text-blue-600 hover:bg-blue-600 hover:text-white'
                                          }`}
                                        >
                                          {state.isTranslating ? t.translating : (state.showTranslated ? t.showOriginal : t.translateToHindi)}
                                        </button>
                                      </div>
                                      
                                      <button 
                                        onClick={() => toggleAnswer(i)}
                                        className="text-[10px] font-black uppercase text-blue-500 mt-2 block tracking-widest hover:underline"
                                      >
                                        {visibleAnswers[i] ? (lang === 'hi' ? 'समाधान छिपाएं' : 'Hide Solution') : (lang === 'hi' ? 'समाधान देखें' : 'View Solution')}
                                      </button>
                                    </div>
                                    <i className={`fa-solid fa-chevron-${visibleAnswers[i] ? 'up' : 'down'} text-[10px] mt-2 opacity-30`}></i>
                                  </div>
                                  
                                  {visibleAnswers[i] && (
                                    <div className={`p-6 border-t animate-fadeIn ${
                                      darkMode ? 'bg-slate-900 border-slate-700' : 'bg-blue-50/30 border-blue-100'
                                    }`}>
                                      <div className="flex items-start space-x-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 flex-shrink-0"></div>
                                        <div className={`text-sm leading-relaxed whitespace-pre-wrap ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                                          {currentPair.answer}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            <div className="pt-4 flex justify-end">
                               <button 
                                 onClick={() => { setSolutionStates([]); setVisibleAnswers({}); }}
                                 className="text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
                               >
                                 {lang === 'hi' ? 'साफ़ करें' : 'Clear Solutions'}
                               </button>
                            </div>
                          </div>
                        )}
                        
                        {generatingQuestions && (
                          <div className="flex flex-col items-center justify-center py-10 space-y-4">
                            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-xs font-black uppercase tracking-widest opacity-50 animate-pulse">{t.translating}</p>
                          </div>
                        )}

                        {!generatingQuestions && solutionStates.length === 0 && (
                          <p className={`text-sm italic opacity-50 text-center py-4`}>
                            {lang === 'hi' ? 'इस अध्याय के लिए बोर्ड प्रश्न और उनके उत्तर उत्पन्न करने के लिए ऊपर बटन पर क्लिक करें।' : 'Click the button above to generate board questions and their model answers for this chapter.'}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* External References in Viewer */}
                {!loading && (
                  <div className={`p-6 border-t ${darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-50 border-gray-100'}`}>
                    <h4 className={`text-xs font-bold uppercase tracking-wider mb-4 ${darkMode ? 'text-slate-500' : 'text-gray-500'}`}>
                      {t.externalRef}
                    </h4>
                    <div className="flex flex-wrap gap-3">
                      {USEFUL_LINKS.slice(0, 3).map((link, idx) => (
                        <a 
                          key={idx}
                          href={getSearchUrl(link.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center space-x-2 px-4 py-2 rounded-xl border text-xs font-medium transition-all ${
                            darkMode ? 'bg-slate-900 border-slate-700 text-slate-300 hover:border-blue-500 hover:text-blue-400' : 'bg-white border-gray-200 text-gray-700 hover:border-blue-400 hover:text-blue-600'
                          }`}
                        >
                          <i className={`fa-solid ${link.icon}`}></i>
                          <span>{link.title}</span>
                          <i className="fa-solid fa-arrow-up-right-from-square opacity-40 text-[10px]"></i>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation Footer */}
              <div className={`flex items-center justify-between p-4 rounded-2xl border shadow-sm ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'
              }`}>
                <button
                  onClick={handlePrevious}
                  disabled={!hasPrevious || loading}
                  className={`flex items-center space-x-2 px-6 py-2 rounded-xl font-bold transition-all ${
                    hasPrevious && !loading
                      ? (darkMode ? 'bg-slate-800 text-blue-400 hover:bg-slate-700' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 active:scale-95 shadow-sm')
                      : (darkMode ? 'bg-slate-950 text-slate-700 cursor-not-allowed' : 'bg-gray-50 text-gray-300 cursor-not-allowed')
                  }`}
                >
                  <i className="fa-solid fa-arrow-left"></i>
                  <span>{t.previous}</span>
                </button>

                <div className="hidden sm:block text-sm font-medium opacity-50">
                  Chapter {currentIndex + 1} of {subject.chapters.length}
                </div>

                <button
                  onClick={handleNext}
                  disabled={!hasNext || loading}
                  className={`flex items-center space-x-2 px-6 py-2 rounded-xl font-bold transition-all ${
                    hasNext && !loading
                      ? (darkMode ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-lg' : 'bg-blue-600 text-white shadow-lg hover:bg-blue-700 active:scale-95')
                      : (darkMode ? 'bg-slate-950 text-slate-700 cursor-not-allowed' : 'bg-gray-50 text-gray-300 cursor-not-allowed')
                  }`}
                >
                  <span>{t.next}</span>
                  <i className="fa-solid fa-arrow-right"></i>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChapterViewer;
