import React, { useState } from 'react';
import { Subject } from '../types.ts';
import { CLASSES } from '../constants.ts';
import { translations } from '../translations.ts';
import { generateChapterNotes, ApiError } from '../services/geminiService.ts';
import { saveOfflineContent, getOfflineContent, isOffline } from '../services/offlineService.ts';
import { motion } from 'motion/react';

interface NotesBankProps {
  darkMode: boolean;
  lang: 'en' | 'hi';
  onHome: () => void;
  onQuotaExceeded: () => void;
}

const NotesBank: React.FC<NotesBankProps> = ({ darkMode, lang, onHome, onQuotaExceeded }) => {
  const t = translations[lang];
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<{ id: string, title: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedNotes, setGeneratedNotes] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getLocalizedClassName = (classId: string) => {
    return (t.classLabels as any)[classId] || classId;
  };

  const getLocalizedSubjectName = (subId: string, fallback: string) => {
    return (t.subjects as any)[subId] || fallback;
  };

  const handleGenerateNotes = async () => {
    if (!selectedClass || !selectedSubject || !selectedChapter) return;
    
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const cacheType = 'summary';
      const cached = await getOfflineContent(selectedClass, selectedSubject.id, selectedChapter.id, cacheType);
      if (cached && typeof cached === 'string') {
        setGeneratedNotes(cached);
        setIsLoading(false);
        return;
      }

      if (isOffline()) {
        throw new Error("You are offline and these notes are not saved.");
      }

      const locSubName = getLocalizedSubjectName(selectedSubject.id, selectedSubject.name);
      const result = await generateChapterNotes(selectedChapter.title, locSubName, selectedSubject.id);
      
      setGeneratedNotes(result);
      await saveOfflineContent(selectedClass, selectedSubject.id, selectedChapter.id, selectedChapter.title, cacheType, result);
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'QUOTA_EXCEEDED') {
        onQuotaExceeded();
      } else {
        setErrorMsg(err.message || "Failed to generate notes. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Breadcrumbs
  const renderBreadcrumbs = () => {
    return (
      <div className={`flex items-center space-x-2 text-xs font-bold mb-6 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
        <button onClick={onHome} className="hover:text-blue-500 transition-colors"><i className="fa-solid fa-home"></i></button>
        {selectedClass && (
          <>
            <i className="fa-solid fa-chevron-right text-[10px] opacity-50"></i>
            <button onClick={() => { setSelectedSubject(null); setSelectedChapter(null); }} className="hover:text-blue-500 transition-colors">
              {getLocalizedClassName(selectedClass)}
            </button>
          </>
        )}
        {selectedSubject && (
          <>
            <i className="fa-solid fa-chevron-right text-[10px] opacity-50"></i>
            <button onClick={() => setSelectedChapter(null)} className="hover:text-blue-500 transition-colors">
              {getLocalizedSubjectName(selectedSubject.id, selectedSubject.name)}
            </button>
          </>
        )}
        {selectedChapter && (
          <>
            <i className="fa-solid fa-chevron-right text-[10px] opacity-50"></i>
            <span className="text-blue-500">{selectedChapter.title}</span>
          </>
        )}
      </div>
    );
  };

  if (!selectedClass) {
    return (
      <div className="animate-fadeIn pb-12">
        {renderBreadcrumbs()}
        <h2 className={`text-3xl font-black mb-8 ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
          <i className="fa-solid fa-book-bookmark text-blue-500 mr-3"></i> 
          Notes Bank
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {CLASSES.map((c) => (
            <button 
              key={c.id}
              onClick={() => setSelectedClass(c.id)}
              className={`p-6 rounded-3xl border text-left transition-all hover:scale-[1.02] active:scale-95 shadow-sm hover:shadow-xl ${
                darkMode ? 'bg-slate-900 border-slate-800 hover:border-blue-500 text-slate-100' : 'bg-white border-gray-100 hover:border-blue-400 text-gray-800'
              }`}
            >
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-xl mb-4">
                <i className="fa-solid fa-graduation-cap"></i>
              </div>
              <h3 className="text-xl font-bold mb-1">{getLocalizedClassName(c.id)}</h3>
              <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-gray-500'}`}>{c.subjects.length} Subjects Available</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!selectedSubject) {
    const classData = CLASSES.find(c => c.id === selectedClass);
    return (
      <div className="animate-fadeIn pb-12">
        {renderBreadcrumbs()}
        <h2 className={`text-3xl font-black mb-8 ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
          Select Subject
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {classData?.subjects.map((sub) => (
            <button 
              key={sub.id}
              onClick={() => setSelectedSubject(sub)}
              className={`p-5 rounded-2xl border text-left transition-all hover:scale-[1.02] active:scale-95 ${
                darkMode ? 'bg-slate-900 border-slate-800 hover:border-blue-500 text-slate-100' : 'bg-white border-gray-100 hover:border-blue-400 text-gray-800'
              }`}
            >
              <div className={`w-10 h-10 ${sub.color} text-white rounded-xl flex items-center justify-center mb-3 shadow-md`}>
                <i className={`fa-solid ${sub.icon}`}></i>
              </div>
              <h3 className="font-bold text-sm">{getLocalizedSubjectName(sub.id, sub.name)}</h3>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!selectedChapter) {
    return (
      <div className="animate-fadeIn pb-12">
        {renderBreadcrumbs()}
        <h2 className={`text-3xl font-black mb-8 ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
          Select Chapter
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {selectedSubject.chapters.map((chap) => (
            <button 
              key={chap.id}
              onClick={() => { setSelectedChapter(chap); setGeneratedNotes(null); }}
              className={`p-5 rounded-2xl border text-left transition-all hover:scale-[1.02] active:scale-95 flex items-start space-x-4 ${
                darkMode ? 'bg-slate-900 border-slate-800 hover:border-blue-500 text-slate-100' : 'bg-white border-gray-100 hover:border-blue-400 text-gray-800'
              }`}
            >
              <div className={`bg-blue-100 text-blue-600 font-black text-xs px-2 py-1 rounded mt-0.5`}>
                {chap.id}
              </div>
              <div>
                <h3 className="font-bold text-sm leading-snug">{chap.title}</h3>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn pb-12">
      {renderBreadcrumbs()}
      
      <div className={`p-8 md:p-10 rounded-3xl border shadow-sm ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
        <div className="mb-8">
          <h2 className={`text-2xl md:text-3xl font-black mb-2 ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
            {selectedChapter.title}
          </h2>
          <p className={`text-sm font-bold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-gray-500'}`}>
            {getLocalizedSubjectName(selectedSubject.id, selectedSubject.name)} • {getLocalizedClassName(selectedClass)}
          </p>
        </div>

        {!generatedNotes && !isLoading && !errorMsg && (
          <div className={`mt-6 min-h-[30vh] flex flex-col items-center justify-center text-center py-12 px-6 rounded-2xl border border-dashed ${darkMode ? 'border-slate-700 bg-slate-800/50' : 'border-gray-200 bg-gray-50'}`}>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl mb-6 shadow-inner ${darkMode ? 'bg-slate-800 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
              <i className="fa-solid fa-layer-group"></i>
            </div>
            <h3 className={`text-2xl font-black mb-2 ${darkMode ? 'text-slate-200' : 'text-gray-800'}`}>
              Complete Chapter Bank
            </h3>
            <p className={`text-sm mb-8 max-w-md ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
              Generate a unified document containing MCQs, Fill in the Blanks, True/False, Match the Column, and Short/Long answers all at once.
            </p>
            <button 
              onClick={handleGenerateNotes}
              className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-xl shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all w-full md:w-auto"
            >
              <i className="fa-solid fa-wand-magic-sparkles mr-2"></i> Generate Full Notes Bank
            </button>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center h-[50vh] space-y-8">
            <div className="relative w-32 h-32 flex items-center justify-center">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute w-full h-full rounded-full border border-blue-500 opacity-20"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1.5, opacity: [0, 0.5, 0] }}
                  transition={{ 
                    duration: 2, 
                    repeat: Infinity, 
                    delay: i * 0.6,
                    ease: "easeOut" 
                  }}
                />
              ))}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute w-16 h-16 rounded-full border-4 border-dashed border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
              />
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="relative z-10 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg"
              >
                <i className="fa-solid fa-wand-magic-sparkles text-xl"></i>
              </motion.div>
            </div>
            
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <h3 className={`text-xl font-bold mb-2 ${darkMode ? 'text-slate-200' : 'text-gray-800'}`}>
                Synthesizing Study Material
              </h3>
              <div className="flex items-center justify-center space-x-1">
                <p className={`text-sm font-mono ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  Analyzing syllabus pattern
                </p>
                <motion.span
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >...</motion.span>
              </div>
            </motion.div>
          </div>
        )}

        {errorMsg && !isLoading && (
          <div className="flex flex-col items-center justify-center h-[40vh] text-center space-y-6 px-8 animate-fadeIn">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-3xl shadow-xl shadow-red-500/10">
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div className="max-w-xs">
              <h4 className="text-xl font-black mb-2">Generation Failed</h4>
              <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>{errorMsg}</p>
            </div>
            <button 
              onClick={() => setErrorMsg(null)} 
              className={`px-6 py-2 rounded-xl font-bold transition-all border ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-gray-100 border-gray-200 text-gray-600'}`}
            >
              Dismiss
            </button>
          </div>
        )}

        {generatedNotes && !isLoading && !errorMsg && (
          <div className="animate-fadeIn mt-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-6 mb-6 gap-4">
              <h3 className={`text-xl font-black ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                <i className="fa-solid fa-check-circle mr-2"></i> Notes Generated Successfully
              </h3>
              <button 
                className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors font-bold text-sm shadow-md"
                onClick={() => {
                  const blob = new Blob([generatedNotes], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${selectedChapter.title}-Complete-Notes.md`;
                  a.click();
                }}
              >
                <i className="fa-solid fa-download mr-2"></i> Export
              </button>
            </div>
            
            <div className={`prose prose-sm md:prose-base max-w-none ${darkMode ? 'prose-invert' : ''}`}>
              {generatedNotes.split('\n').map((line, i) => {
                if (line.startsWith('## ')) return <h2 key={i} className="text-2xl font-bold mt-8 mb-4 border-b pb-2 text-blue-500">{line.replace('## ', '')}</h2>;
                if (line.startsWith('### ')) return <h3 key={i} className="text-xl font-bold mt-6 mb-3">{line.replace('### ', '')}</h3>;
                if (line.startsWith('> ')) return <blockquote key={i} className="border-l-4 border-blue-500 pl-4 text-gray-500 italic mb-4">{line.replace('> ', '')}</blockquote>;
                if (line.startsWith('**')) return <p key={i} className="font-bold mt-5 mb-2">{line.replace(/\*\*/g, '')}</p>;
                if (line.startsWith('*')) return <p key={i} className="italic text-gray-500 mb-2">{line.replace(/\*/g, '')}</p>;
                return line ? <p key={i} className="mb-2">{line}</p> : <br key={i} />;
              })}
            </div>
            
            <div className="mt-12 pt-6 border-t border-inherit/20 flex flex-col sm:flex-row justify-between items-center opacity-60 gap-4">
              <span className="text-xs font-black uppercase tracking-widest text-blue-600">Unified Chapter Notes Generator</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Developed by Ritik Roushan Sah</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default NotesBank;
