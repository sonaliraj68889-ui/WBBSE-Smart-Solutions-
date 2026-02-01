
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout.tsx';
import Dashboard from './components/Dashboard.tsx';
import SmartTutor from './components/SmartTutor.tsx';
import ChapterViewer from './components/ChapterViewer.tsx';
import SamplePaperViewer from './components/SamplePaperViewer.tsx';
import { Subject, SearchHistoryItem, SamplePaper, ExamTerm } from './types.ts';
import { translations } from './translations.ts';
import { generateSamplePaper, ApiError } from './services/geminiService.ts';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [lang, setLang] = useState<'en' | 'hi'>(() => (localStorage.getItem('lang') as any) || 'en');
  const [darkMode, setDarkMode] = useState(() => JSON.parse(localStorage.getItem('darkMode') || 'false'));
  const [selectedSubject, setSelectedSubject] = useState<{ subject: Subject, classId: string, initialChapterId?: string } | null>(null);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>(() => {
    const saved = localStorage.getItem('searchHistory');
    return saved ? JSON.parse(saved).map((h: any) => ({ ...h, timestamp: new Date(h.timestamp) })) : [];
  });
  
  const [selectedSamplePaper, setSelectedSamplePaper] = useState<SamplePaper | null>(null);
  const [isGeneratingPaper, setIsGeneratingPaper] = useState(false);
  const [paperGenerationError, setPaperGenerationError] = useState<any>(null);
  const [paperGenerationStatus, setPaperGenerationStatus] = useState(0);

  const [showGlobalApiKeyPrompt, setShowGlobalApiKeyPrompt] = useState(false);
  
  const [pendingQuery, setPendingQuery] = useState<string | undefined>(undefined);
  const [pendingFile, setPendingFile] = useState<{ data: string, name: string, mimeType: string } | undefined>(undefined);

  const t = translations[lang];

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    localStorage.setItem('lang', lang);
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode, lang]);

  useEffect(() => {
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
  }, [searchHistory]);

  const generationMessages = [
    lang === 'hi' ? "फ्लैश प्रोसेसिंग शुरू..." : "Flash processing starting...",
    lang === 'hi' ? "बोर्ड पैटर्न मिलान..." : "Matching board patterns...",
    lang === 'hi' ? "प्रश्नों का संकलन..." : "Compiling questions...",
    lang === 'hi' ? "अंतिम रूप दिया जा रहा है..." : "Finalizing output...",
    lang === 'hi' ? "तैयार!" : "Ready!"
  ];

  useEffect(() => {
    let interval: any;
    if (isGeneratingPaper) {
      interval = setInterval(() => setPaperGenerationStatus(prev => (prev + 1) % generationMessages.length), 800);
    }
    return () => clearInterval(interval);
  }, [isGeneratingPaper, lang]);

  const handleQuotaExceeded = () => {
    setShowGlobalApiKeyPrompt(true);
  };

  const handleSelectPaidApiKey = async () => {
    // Assuming window.aistudio and its methods are globally available as per coding guidelines.
    if (window.aistudio && window.aistudio.openSelectKey) {
      try {
        await window.aistudio.openSelectKey();
        setShowGlobalApiKeyPrompt(false); // Assume success as per guideline
        // The user can now manually retry the operation that failed.
      } catch (error) {
        console.error("Error opening API key selection dialog:", error);
        // Optionally, show an error that the dialog couldn't be opened.
      }
    } else {
      alert("API key selection is not available in this environment.");
      setShowGlobalApiKeyPrompt(false);
    }
  };

  const handleSelectSamplePaper = async (subject: string, classId: string, term: ExamTerm) => {
    setActiveTab('papers');
    setIsGeneratingPaper(true);
    setPaperGenerationError(null);
    setPaperGenerationStatus(0);
    try {
      const classLabel = (t.classLabels as any)[classId] || classId;
      const paper = await generateSamplePaper(subject, classLabel, term);
      setSelectedSamplePaper(paper);
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'QUOTA_EXCEEDED') {
        handleQuotaExceeded();
        setPaperGenerationError(null); // Clear local error if global prompt takes over
      } else {
        let friendlyMsg = t.errorGeneric;
        if (err instanceof ApiError) {
          switch (err.code) {
            case 'SAFETY_BLOCKED': friendlyMsg = t.errorSafety; break;
            case 'SERVER_ERROR': friendlyMsg = t.errorServer; break;
          }
        }
        setPaperGenerationError({ 
          subject, 
          classId, 
          term, 
          msg: friendlyMsg, 
          details: err?.message 
        });
      }
    } finally {
      setIsGeneratingPaper(false);
    }
  };

  const handleGoHome = () => {
    setSelectedSubject(null);
    setSelectedSamplePaper(null);
    setPaperGenerationError(null);
    setActiveTab('dashboard');
  };

  const handleSearchSelect = (s: Subject, clId: string, ch?: string) => {
    setSelectedSubject({ subject: s, classId: clId, initialChapterId: ch });
    setActiveTab('curriculum');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard 
            onSelectSubject={handleSearchSelect} 
            onSearchHistoryClick={q => { setPendingQuery(q); setActiveTab('tutor'); }} 
            onClearHistory={() => setSearchHistory([])} 
            onSelectSamplePaper={handleSelectSamplePaper} 
            searchHistory={searchHistory} 
            darkMode={darkMode} 
            lang={lang} 
          />
        );
      case 'tutor':
        return (
          <SmartTutor 
            darkMode={darkMode} 
            lang={lang} 
            initialQuery={pendingQuery} 
            initialFile={pendingFile} 
            onSaveSearch={q => setSearchHistory(prev => [{ id: Math.random().toString(36).substr(2,9), query: q, timestamp: new Date() }, ...prev.filter(h => h.query !== q)].slice(0, 10))} 
            onHome={handleGoHome}
            onQuotaExceeded={handleQuotaExceeded}
          />
        );
      case 'curriculum':
        return selectedSubject ? (
          <ChapterViewer 
            subject={selectedSubject.subject} 
            classId={selectedSubject.classId} 
            initialChapterId={selectedSubject.initialChapterId} 
            onBack={() => setSelectedSubject(null)} 
            onHome={handleGoHome} 
            darkMode={darkMode} 
            lang={lang} 
            onQuotaExceeded={handleQuotaExceeded}
          />
        ) : null;
      case 'papers':
        if (isGeneratingPaper) {
          return (
            <div className="flex flex-col items-center justify-center h-[70vh] space-y-8 max-w-lg mx-auto text-center px-6 animate-fadeIn">
              <div className="relative">
                <div className="w-20 h-20 border-8 border-blue-600/10 border-t-blue-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                   <i className="fa-solid fa-bolt-lightning text-blue-500 animate-pulse text-3xl"></i>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-3xl font-black italic tracking-tighter text-blue-600 uppercase">Flash Mode</h3>
                <h4 className="text-xl font-bold">{generationMessages[paperGenerationStatus]}</h4>
                <p className="opacity-50 text-xs font-black uppercase tracking-widest">Powered by Gemini AI</p>
              </div>
            </div>
          );
        }
        if (paperGenerationError) {
          return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-8 px-8 animate-fadeIn">
              <div className="w-24 h-24 bg-red-100 text-red-600 rounded-[2.5rem] flex items-center justify-center text-4xl shadow-xl shadow-red-500/10"><i className="fa-solid fa-triangle-exclamation"></i></div>
              <div className="max-w-md">
                <h4 className="text-2xl font-black mb-2">{paperGenerationError.msg}</h4>
                {paperGenerationError.details && <p className="text-[10px] font-mono opacity-30 mb-6 truncate">{paperGenerationError.details}</p>}
                <p className="text-sm opacity-60 font-medium">This usually happens during high peak hours or if the daily usage quota is reached. Please try generating it again.</p>
              </div>
              <div className="flex gap-4">
                <button onClick={() => handleGoHome()} className={`px-8 py-3 rounded-xl font-bold transition-all ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-gray-100 text-gray-600'}`}>Cancel</button>
                <button onClick={() => handleSelectSamplePaper(paperGenerationError.subject, paperGenerationError.classId, paperGenerationError.term)} className="bg-blue-600 text-white px-10 py-3 rounded-xl font-bold shadow-xl shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all">Retry Now</button>
              </div>
            </div>
          );
        }
        if (selectedSamplePaper) {
          return <SamplePaperViewer paper={selectedSamplePaper} darkMode={darkMode} lang={lang} onBack={handleGoHome} />;
        }
        return null;
      default:
        return null;
    }
  };

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      darkMode={darkMode} 
      setDarkMode={setDarkMode} 
      lang={lang} 
      setLang={setLang} 
      onSearchSelect={handleSearchSelect}
    >
      {renderContent()}

      {showGlobalApiKeyPrompt && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className={`relative w-full max-w-md p-8 rounded-[2.5rem] shadow-3xl flex flex-col items-center text-center ${darkMode ? 'bg-slate-900 border border-slate-700 text-slate-100' : 'bg-white border border-gray-100 text-gray-900'}`}>
            <button 
              onClick={() => setShowGlobalApiKeyPrompt(false)} 
              className={`absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-sm ${darkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              title="Close"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl mb-6 ${darkMode ? 'bg-red-900/20 text-red-400' : 'bg-red-100 text-red-600'}`}>
              <i className="fa-solid fa-cloud-bolt"></i>
            </div>
            <h3 className="text-2xl font-black mb-4">{t.apiKeyRequiredTitle}</h3>
            <p className={`text-sm mb-8 leading-relaxed ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>
              {t.apiKeyQuotaMessage}
            </p>
            <button 
              onClick={handleSelectPaidApiKey} 
              className="w-full px-8 py-4 bg-blue-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all hover:-translate-y-1 active:scale-95"
            >
              <i className="fa-solid fa-key mr-2"></i> {t.selectApiKeyButton}
            </button>
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="mt-4 text-blue-500 hover:underline text-sm font-medium"
            >
              {t.learnMoreBilling} <i className="fa-solid fa-external-link text-xs ml-1"></i>
            </a>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;