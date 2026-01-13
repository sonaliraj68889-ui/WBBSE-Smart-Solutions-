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
  const [uploadFeedback, setUploadFeedback] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>(() => {
    const saved = localStorage.getItem('searchHistory');
    return saved ? JSON.parse(saved).map((h: any) => ({ ...h, timestamp: new Date(h.timestamp) })) : [];
  });
  
  const [selectedSamplePaper, setSelectedSamplePaper] = useState<SamplePaper | null>(null);
  const [isGeneratingPaper, setIsGeneratingPaper] = useState(false);
  const [paperGenerationStatus, setPaperGenerationStatus] = useState(0);
  
  const [pendingQuery, setPendingQuery] = useState<string | undefined>(undefined);
  const [pendingFile, setPendingFile] = useState<{ data: string, name: string, mimeType: string } | undefined>(undefined);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = translations[lang];

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    localStorage.setItem('lang', lang);
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode, lang]);

  useEffect(() => {
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
  }, [searchHistory]);

  useEffect(() => {
    try {
      localStorage.setItem('uploadedFiles', JSON.stringify(uploadedFiles));
    } catch (e) {
      console.warn("Local storage full, could not save all file contents.");
      setUploadFeedback({ message: t.fileStorageFull, type: 'error' });
    }
  }, [uploadedFiles]);

  const generationMessages = [
    lang === 'hi' ? "WBBSE पाठ्यक्रम का विश्लेषण कर रहे हैं..." : "Analyzing WBBSE syllabus...",
    lang === 'hi' ? "बोर्ड-मानक गद्यांश खोज रहे हैं..." : "Searching board-standard passages...",
    lang === 'hi' ? "सेक्शन A: रीडिंग कॉम्प्रिहेंशन ड्राफ्ट कर रहे हैं..." : "Drafting Section A: Reading...",
    lang === 'hi' ? "व्याकरण और शब्दावली तैयार कर रहे हैं..." : "Preparing Grammar and Vocabulary...",
    lang === 'hi' ? "लेखन कौशल और अंक योजना को अंतिम रूप दे रहे हैं..." : "Finalizing Writing and Marks...",
    lang === 'hi' ? "आपका आधिकारिक सैंपल पेपर तैयार है!" : "Sample paper is ready!"
  ];

  useEffect(() => {
    let interval: any;
    if (isGeneratingPaper) {
      interval = setInterval(() => {
        setPaperGenerationStatus(prev => (prev + 1) % generationMessages.length);
      }, 4500);
    } else {
      setPaperGenerationStatus(0);
    }
    return () => clearInterval(interval);
  }, [isGeneratingPaper, lang]);

  const handleSelectSubject = (subject: Subject, classLabel: string) => {
    setSelectedSubject({ subject, classLabel });
    setActiveTab('curriculum');
  };

  const handleSearchSelect = (subject: Subject, classLabel: string, chapterId: string) => {
    setSelectedSubject({ subject, classLabel, initialChapterId: chapterId });
    setActiveTab('curriculum');
  };

  const handleSelectSamplePaper = async (subject: string, classLabel: string, term: ExamTerm) => {
    setActiveTab('papers');
    setIsGeneratingPaper(true);
    setPaperGenerationStatus(0);
    try {
      const paper = await generateSamplePaper(subject, classLabel, term);
      setSelectedSamplePaper(paper);
    } catch (err) {
      alert("Failed to generate sample paper. Please try again.");
      setActiveTab('dashboard');
    } finally {
      setIsGeneratingPaper(false);
    }
  };

  const handleSaveSearch = (query: string) => {
    if (!query.trim()) return;
    setSearchHistory(prev => {
      const filtered = prev.filter(h => h.query.toLowerCase() !== query.toLowerCase());
      const newItem: SearchHistoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        query: query.trim(),
        timestamp: new Date()
      };
      return [newItem, ...filtered].slice(0, 10);
    });
  };

  const handleSearchHistoryClick = (query: string) => {
    setPendingQuery(query);
    setActiveTab('tutor');
  };

  const handleClearHistory = () => {
    setSearchHistory([]);
  };

  const handleAskAIWithFile = (file: UploadedFile) => {
    if (file.content) {
      setPendingFile({
        data: file.content,
        name: file.name,
        mimeType: file.mimeType
      });
      setActiveTab('tutor');
    }
  };

  const handleDeleteFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files) as File[];
    
    fileList.forEach(file => {
      const isAllowed = file.name.endsWith('.pdf') || 
                        file.name.endsWith('.docx') || 
                        file.type.includes('image/') ||
                        file.type === 'application/pdf' || 
                        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      if (!isAllowed) {
        setUploadFeedback({ message: `File "${file.name}" is not a supported format.`, type: 'error' });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const newFile: UploadedFile = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
          type: file.name.split('.').pop()?.toUpperCase() || 'FILE',
          status: 'success',
          timestamp: new Date(),
          content: base64,
          mimeType: file.type
        };
        
        setUploadedFiles(prev => [newFile, ...prev]);
        setUploadFeedback({ message: `Successfully uploaded ${file.name}.`, type: 'success' });
      };
      reader.readAsDataURL(file);
    });

    setTimeout(() => setUploadFeedback(null), 3000);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGoHome = () => {
    setSelectedSubject(null);
    setSelectedSamplePaper(null);
    setActiveTab('dashboard');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard 
            onSelectSubject={handleSelectSubject} 
            onSearchHistoryClick={handleSearchHistoryClick}
            onClearHistory={handleClearHistory}
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
            onSaveSearch={handleSaveSearch}
          />
        );
      case 'curriculum':
        if (selectedSubject) {
          return (
            <ChapterViewer 
              subject={selectedSubject.subject} 
              classLabel={selectedSubject.classLabel} 
              initialChapterId={selectedSubject.initialChapterId}
              onBack={() => setSelectedSubject(null)}
              onHome={handleGoHome}
              darkMode={darkMode}
              lang={lang}
            />
          );
        }
        return (
          <div className={`text-center py-20 rounded-3xl border shadow-sm ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl mx-auto mb-6 ${darkMode ? 'bg-slate-800 text-blue-400' : 'bg-blue-50 text-blue-500'}`}>
              <i className="fa-solid fa-graduation-cap"></i>
            </div>
            <h2 className={`text-2xl font-bold mb-2 ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>{t.curriculum} Explorer</h2>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-colors shadow-lg"
            >
              {t.back}
            </button>
          </div>
        );
      case 'papers':
        if (isGeneratingPaper) {
          return (
            <div className="flex flex-col items-center justify-center h-[70vh] space-y-8 max-w-lg mx-auto">
              <div className="relative">
                <div className="w-24 h-24 border-8 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                   <i className="fa-solid fa-file-signature text-blue-600 text-2xl animate-bounce"></i>
                </div>
              </div>
              <div className="text-center space-y-4">
                <h3 className="text-2xl font-black transition-all animate-pulse">{generationMessages[paperGenerationStatus]}</h3>
                <p className="opacity-50 text-sm font-medium leading-relaxed">
                  {lang === 'hi' 
                    ? "हमारे प्रो एआई मॉडल का उपयोग करके आधिकारिक बोर्ड-मानक प्रश्न तैयार किए जा रहे हैं। इसमें एक मिनट लग सकता है।" 
                    : "Using our Pro AI model to draft authentic board-standard questions. This may take a minute."}
                </p>
                <div className="flex justify-center space-x-1">
                  {generationMessages.map((_, i) => (
                    <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === paperGenerationStatus ? 'w-8 bg-blue-600' : 'w-2 bg-blue-200'}`}></div>
                  ))}
                </div>
              </div>
            </div>
          );
        }
        if (selectedSamplePaper) {
          return (
            <SamplePaperViewer 
              paper={selectedSamplePaper}
              darkMode={darkMode}
              lang={lang}
              onBack={() => { setSelectedSamplePaper(null); setActiveTab('dashboard'); }}
            />
          );
        }
        return null;
      case 'resources':
        return (
          <div className="space-y-6 animate-fadeIn">
            <div className={`p-8 rounded-3xl border shadow-sm ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                 <div className="flex items-center space-x-4">
                   <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 text-2xl">
                     <i className="fa-solid fa-file-arrow-up"></i>
                   </div>
                   <div>
                     <h2 className={`text-2xl font-bold ${darkMode ? 'text-slate-100' : 'text-gray-900'}`}>{t.uploadTitle}</h2>
                     <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>{t.uploadDesc}</p>
                   </div>
                 </div>
                 
                 <div className="flex flex-col items-end">
                   <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple accept=".pdf,.docx,image/*" className="hidden" />
                   <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg active:scale-95 flex items-center space-x-2">
                     <i className="fa-solid fa-plus"></i>
                     <span>{t.uploadButton}</span>
                   </button>
                 </div>
               </div>

               {uploadFeedback && (
                 <div className={`mb-6 p-4 rounded-xl flex items-center space-x-3 animate-slideIn ${
                   uploadFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' : 'bg-red-50 text-red-700 border border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                 }`}>
                   <i className={`fa-solid ${uploadFeedback.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
                   <span className="font-medium text-sm">{uploadFeedback.message}</span>
                 </div>
               )}

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {uploadedFiles.length === 0 ? (
                   <div className={`col-span-full py-20 text-center rounded-3xl border-2 border-dashed ${darkMode ? 'border-slate-800 text-slate-500' : 'border-gray-200 text-gray-400'}`}>
                     <i className="fa-solid fa-cloud-upload-alt text-5xl mb-4 opacity-20"></i>
                     <p className="text-lg font-medium">{t.noFiles}</p>
                   </div>
                 ) : (
                   uploadedFiles.map(file => (
                     <div key={file.id} className={`group p-5 rounded-2xl border flex flex-col transition-all hover:shadow-xl ${darkMode ? 'bg-slate-800 border-slate-700 hover:border-blue-500' : 'bg-white border-gray-100 hover:border-blue-200'}`}>
                       <div className="flex items-center space-x-4 mb-4">
                         <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-md ${file.type === 'PDF' ? 'bg-red-500' : (file.type === 'DOCX' ? 'bg-blue-500' : 'bg-emerald-500')}`}>
                           {file.type}
                         </div>
                         <div className="flex-1 min-w-0">
                           <h4 className={`text-sm font-bold truncate ${darkMode ? 'text-slate-200' : 'text-gray-800'}`}>{file.name}</h4>
                           <div className="flex items-center space-x-2 text-[10px] opacity-60">
                             <span>{file.size}</span>
                             <span>•</span>
                             <span>{file.timestamp.toLocaleDateString()}</span>
                           </div>
                         </div>
                       </div>
                       <div className="flex items-center justify-between mt-auto pt-4 border-t border-inherit/10">
                         <button onClick={() => handleAskAIWithFile(file)} className="flex items-center space-x-2 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">
                           <i className="fa-solid fa-robot"></i>
                           <span>{t.askAI}</span>
                         </button>
                         <button onClick={() => handleDeleteFile(file.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                           <i className="fa-solid fa-trash-can text-sm"></i>
                         </button>
                       </div>
                     </div>
                   ))
                 )}
               </div>
            </div>
          </div>
        );
      default:
        return <Dashboard onSelectSubject={handleSelectSubject} onSearchHistoryClick={handleSearchHistoryClick} onClearHistory={handleClearHistory} onSelectSamplePaper={handleSelectSamplePaper} searchHistory={searchHistory} darkMode={darkMode} lang={lang} />;
    }
  };

  useEffect(() => {
    if (activeTab === 'tutor') {
      if (pendingQuery) setPendingQuery(undefined);
      if (pendingFile) setPendingFile(undefined);
    }
  }, [activeTab]);

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
    </Layout>
  );
};

export default App;