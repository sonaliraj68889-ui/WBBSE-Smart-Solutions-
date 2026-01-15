
import React, { useState, useEffect, useRef } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import SmartTutor from './components/SmartTutor';
import ChapterViewer from './components/ChapterViewer';
import SamplePaperViewer from './components/SamplePaperViewer';
import { Subject, SearchHistoryItem, UploadedFile, SamplePaper, ExamTerm } from './types';
import { translations } from './translations';
import { generateSamplePaper } from './services/geminiService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [lang, setLang] = useState<'en' | 'hi'>(() => {
    const saved = localStorage.getItem('lang');
    return (saved === 'en' || saved === 'hi') ? saved : 'en';
  });
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [selectedSubject, setSelectedSubject] = useState<{ subject: Subject, classLabel: string, initialChapterId?: string } | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>(() => {
    const saved = localStorage.getItem('uploadedFiles');
    return saved ? JSON.parse(saved).map((f: any) => ({ ...f, timestamp: new Date(f.timestamp) })) : [];
  });
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>(() => {
    const saved = localStorage.getItem('searchHistory');
    return saved ? JSON.parse(saved).map((h: any) => ({ ...h, timestamp: new Date(h.timestamp) })) : [];
  });
  
  const [selectedSamplePaper, setSelectedSamplePaper] = useState<SamplePaper | null>(null);
  const [isGeneratingPaper, setIsGeneratingPaper] = useState(false);
  const [paperGenerationError, setPaperGenerationError] = useState<any>(null);
  const [paperGenerationStatus, setPaperGenerationStatus] = useState(0);
  
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
      // Very fast UI feedback (0.8s) to emphasize speed
      interval = setInterval(() => setPaperGenerationStatus(prev => (prev + 1) % generationMessages.length), 800);
    }
    return () => clearInterval(interval);
  }, [isGeneratingPaper, lang]);

  const handleSelectSamplePaper = async (subject: string, classLabel: string, term: ExamTerm) => {
    setActiveTab('papers');
    setIsGeneratingPaper(true);
    setPaperGenerationError(null);
    setPaperGenerationStatus(0);
    try {
      // Gemini 3 Flash is ultra-fast, so we trigger immediately
      const paper = await generateSamplePaper(subject, classLabel, term);
      setSelectedSamplePaper(paper);
    } catch (err: any) {
      setPaperGenerationError({ 
        subject, 
        classLabel, 
        term, 
        msg: lang === 'hi' ? "विफल। कृपया पुनः प्रयास करें।" : "Failed. Please try again." 
      });
    } finally {
      setIsGeneratingPaper(false);
    }
  };

  const handleRetryPaper = () => {
    if (paperGenerationError) {
      handleSelectSamplePaper(paperGenerationError.subject, paperGenerationError.classLabel, paperGenerationError.term);
    }
  };

  const handleGoHome = () => {
    setSelectedSubject(null);
    setSelectedSamplePaper(null);
    setPaperGenerationError(null);
    setActiveTab('dashboard');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onSelectSubject={(s, cl) => { setSelectedSubject({ subject: s, classLabel: cl }); setActiveTab('curriculum'); }} onSearchHistoryClick={q => { setPendingQuery(q); setActiveTab('tutor'); }} onClearHistory={() => setSearchHistory([])} onSelectSamplePaper={handleSelectSamplePaper} searchHistory={searchHistory} darkMode={darkMode} lang={lang} />;
      case 'tutor':
        return <SmartTutor darkMode={darkMode} lang={lang} initialQuery={pendingQuery} initialFile={pendingFile} onSaveSearch={q => setSearchHistory(prev => [{ id: Math.random().toString(36).substr(2,9), query: q, timestamp: new Date() }, ...prev.filter(h => h.query !== q)].slice(0, 10))} />;
      case 'curriculum':
        return selectedSubject ? <ChapterViewer subject={selectedSubject.subject} classLabel={selectedSubject.classLabel} initialChapterId={selectedSubject.initialChapterId} onBack={() => setSelectedSubject(null)} onHome={handleGoHome} darkMode={darkMode} lang={lang} /> : null;
      case 'papers':
        if (isGeneratingPaper) {
          return (
            <div className="flex flex-col items-center justify-center h-[70vh] space-y-8 max-w-lg mx-auto text-center px-6">
              <div className="relative">
                <div className="w-20 h-20 border-8 border-blue-600/10 border-t-blue-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                   <i className="fa-solid fa-bolt-lightning text-blue-500 animate-pulse text-3xl"></i>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-3xl font-black italic tracking-tighter text-blue-600">FLASH MODE</h3>
                <h4 className="text-xl font-bold">{generationMessages[paperGenerationStatus]}</h4>
                <p className="opacity-50 text-xs font-black uppercase tracking-widest">{lang === 'hi' ? "शक्तिशाली एआई द्वारा संचालित" : "Powered by Ultra-Fast Gemini 3"}</p>
              </div>
            </div>
          );
        }
        if (paperGenerationError) {
          return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-8 px-8 animate-fadeIn">
              <div className="w-24 h-24 bg-red-100 text-red-600 rounded-[2rem] flex items-center justify-center text-4xl shadow-lg"><i className="fa-solid fa-triangle-exclamation"></i></div>
              <div className="space-y-3 max-w-sm">
                <h3 className="text-3xl font-black">{lang === 'hi' ? 'क्षमा करें!' : 'Oops!'}</h3>
                <p className="text-gray-500 font-medium">{paperGenerationError.msg}</p>
              </div>
              <div className="flex flex-col w-full max-w-xs gap-3">
                <button onClick={handleRetryPaper} className="w-full bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-blue-700 active:scale-95 transition-all">
                  <i className="fa-solid fa-rotate-right mr-2"></i> {lang === 'hi' ? 'पुनः प्रयास करें' : 'Retry Now'}
                </button>
                <button onClick={handleGoHome} className="w-full px-8 py-4 rounded-2xl font-black uppercase tracking-widest border-2 border-gray-100 text-gray-400 hover:bg-gray-50">{t.back}</button>
              </div>
            </div>
          );
        }
        if (selectedSamplePaper) {
          return <SamplePaperViewer paper={selectedSamplePaper} darkMode={darkMode} lang={lang} onBack={handleGoHome} />;
        }
        return null;
      default:
        return <Dashboard onSelectSubject={(s, cl) => { setSelectedSubject({ subject: s, classLabel: cl }); setActiveTab('curriculum'); }} onSearchHistoryClick={q => { setPendingQuery(q); setActiveTab('tutor'); }} onClearHistory={() => setSearchHistory([])} onSelectSamplePaper={handleSelectSamplePaper} searchHistory={searchHistory} darkMode={darkMode} lang={lang} />;
    }
  };

  useEffect(() => {
    if (activeTab === 'tutor') { setPendingQuery(undefined); setPendingFile(undefined); }
  }, [activeTab]);

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} darkMode={darkMode} setDarkMode={setDarkMode} lang={lang} setLang={setLang} onSearchSelect={(s, cl, ch) => { setSelectedSubject({ subject: s, classLabel: cl, initialChapterId: ch }); setActiveTab('curriculum'); }}>
      {renderContent()}
    </Layout>
  );
};

export default App;
