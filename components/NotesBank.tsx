import React, { useState, useRef } from 'react';
// @ts-ignore
import html2pdf from 'html2pdf.js/dist/html2pdf.bundle.min.js';
import Markdown from 'react-markdown';
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
  const [chapterPath, setChapterPath] = useState<{ id: string, title: string, parts?: any[] }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedNotes, setGeneratedNotes] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedPartMode, setSelectedPartMode] = useState<'both' | 'part1' | 'part2'>('both');
  const contentRef = useRef<HTMLDivElement>(null);

  const selectedChapter = chapterPath.length > 0 ? chapterPath[chapterPath.length - 1] : null;

  const handleBackToChapters = () => {
    setChapterPath([]);
    setGeneratedNotes(null);
  };

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
      const cached = await getOfflineContent(selectedClass, selectedSubject.id, selectedChapter.id, `${cacheType}_${selectedPartMode}`);
      if (cached && typeof cached === 'string') {
        setGeneratedNotes(cached);
        setIsLoading(false);
        return;
      }

      if (isOffline()) {
        throw new Error("You are offline and these notes are not saved.");
      }

      const locSubName = getLocalizedSubjectName(selectedSubject.id, selectedSubject.name);
      const result = await generateChapterNotes(selectedChapter.title, locSubName, selectedSubject.id, selectedPartMode);
      
      setGeneratedNotes(result);
      await saveOfflineContent(selectedClass, selectedSubject.id, selectedChapter.id, selectedChapter.title, `${cacheType}_${selectedPartMode}`, result);
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

  const handleDownloadPDF = async () => {
    if (!contentRef.current || isExporting || !selectedChapter || !selectedSubject) return;
    setIsExporting(true);
    try {
      const element = contentRef.current;
      const opt = {
        margin:       [15, 10, 15, 10],
        filename:     `${selectedChapter.title}-Notes.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
      };
      
      await html2pdf().from(element).set(opt).toPdf().get('pdf').then((pdf: any) => {
        const totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          pdf.setFontSize(10);
          pdf.setTextColor(150);
          
          const subjectText = getLocalizedSubjectName(selectedSubject.id, selectedSubject.name);
          const headerText = `${subjectText} | ${getLocalizedClassName(selectedClass!)}`;
          pdf.text(headerText, 10, 10);
          pdf.text("Developed by Ritik Roushan Sah", 10, pdf.internal.pageSize.getHeight() - 10);
        }
      }).save();
    } catch (err) {
      console.error('Failed to export PDF:', err);
      setErrorMsg("Failed to export as PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  // Breadcrumbs
  const renderBreadcrumbs = () => {
    return (
      <div className={`flex flex-wrap items-center gap-2 text-xs font-bold mb-6 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
        <button onClick={onHome} className="hover:text-blue-500 transition-colors"><i className="fa-solid fa-home"></i></button>
        {selectedClass && (
          <>
            <i className="fa-solid fa-chevron-right text-[10px] opacity-50"></i>
            <button onClick={() => { setSelectedSubject(null); setChapterPath([]); }} className="hover:text-blue-500 transition-colors whitespace-nowrap">
              {getLocalizedClassName(selectedClass)}
            </button>
          </>
        )}
        {selectedSubject && (
          <>
            <i className="fa-solid fa-chevron-right text-[10px] opacity-50"></i>
            <button onClick={() => setChapterPath([])} className="hover:text-blue-500 transition-colors whitespace-nowrap">
              {getLocalizedSubjectName(selectedSubject.id, selectedSubject.name)}
            </button>
          </>
        )}
        {chapterPath.map((node, index) => (
          <React.Fragment key={index}>
            <i className="fa-solid fa-chevron-right text-[10px] opacity-50"></i>
            {index < chapterPath.length - 1 ? (
              <button onClick={() => setChapterPath(chapterPath.slice(0, index + 1))} className="hover:text-blue-500 transition-colors whitespace-nowrap max-w-[150px] truncate" title={node.title}>
                {node.title}
              </button>
            ) : (
              <span className="text-blue-500 whitespace-nowrap max-w-[150px] truncate" title={node.title}>{node.title}</span>
            )}
          </React.Fragment>
        ))}
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

  const currentNode = chapterPath.length > 0 ? chapterPath[chapterPath.length - 1] : null;
  const currentFeatures = currentNode?.parts || (chapterPath.length === 0 ? selectedSubject?.chapters : null);
  const hasFeatures = currentFeatures && currentFeatures.length > 0;

  if (selectedSubject && (!currentNode || hasFeatures)) {
    // Only return the grid if we haven't started generating/loading
    if (!generatedNotes && !isLoading && !errorMsg) {
      return (
        <div className="animate-fadeIn pb-12">
          {renderBreadcrumbs()}
          
          {currentNode && (
            <div className={`p-6 md:p-8 rounded-3xl border shadow-sm mb-8 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-6 mb-6">
                <div className="flex-1">
                  <h2 className={`text-2xl font-black mb-1 ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
                    {currentNode.title}
                  </h2>
                  <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                    Select a sub-topic below, or generate comprehensive notes for this entire section.
                  </p>
                </div>
                <div className="flex flex-col gap-3 w-full md:w-auto items-stretch md:items-end">
                  <select 
                    value={selectedPartMode}
                    onChange={(e) => setSelectedPartMode(e.target.value as any)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border outline-none appearance-none cursor-pointer ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-slate-200 focus:border-blue-500' : 'bg-gray-50 border-gray-200 text-gray-700 focus:border-blue-500'
                    }`}
                  >
                    <option value="both">All Questions (Part 1 & 2)</option>
                    <option value="part1">Only Part 1: Objective & Short</option>
                    <option value="part2">Only Part 2: Long & Analytical</option>
                  </select>
                  <button 
                    onClick={handleGenerateNotes}
                    className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-md whitespace-nowrap"
                  >
                    <i className="fa-solid fa-layer-group mr-2"></i> Generate Whole Section
                  </button>
                </div>
              </div>
              <h3 className={`text-lg font-bold mb-4 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                Or Select Sub-Topic:
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentFeatures!.map((chap) => (
                  <button 
                    key={chap.id}
                    onClick={() => { setChapterPath([...chapterPath, chap]); setGeneratedNotes(null); }}
                    className={`p-5 rounded-2xl border text-left transition-all hover:scale-[1.02] active:scale-95 flex items-start space-x-4 ${
                      darkMode ? 'bg-slate-800 border-slate-700 hover:border-blue-500 text-slate-100' : 'bg-gray-50 border-gray-200 hover:border-blue-400 text-gray-800'
                    }`}
                  >
                    <div className={`bg-blue-100 text-blue-600 font-black text-xs px-2 py-1 rounded mt-0.5 whitespace-nowrap flex-shrink-0`}>
                      {chap.id.split('-').pop()}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm leading-snug">{chap.title}</h3>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!currentNode && (
            <div>
              <h2 className={`text-3xl font-black mb-8 ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
                Select Chapter
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentFeatures!.map((chap) => (
                  <button 
                    key={chap.id}
                    onClick={() => { setChapterPath([...chapterPath, chap]); setGeneratedNotes(null); }}
                    className={`p-5 rounded-2xl border text-left transition-all hover:scale-[1.02] active:scale-95 flex items-start space-x-4 ${
                      darkMode ? 'bg-slate-900 border-slate-800 hover:border-blue-500 text-slate-100' : 'bg-white border-gray-100 hover:border-blue-400 text-gray-800'
                    }`}
                  >
                    <div className={`bg-blue-100 text-blue-600 font-black text-xs px-2 py-1 rounded mt-0.5 flex-shrink-0 whitespace-nowrap`}>
                      {chap.id}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm leading-snug">{chap.title}</h3>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
  }

  if (!selectedChapter) return null;

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
            <p className={`text-sm mb-6 max-w-md ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
              Generate a unified document containing MCQs, Fill in the Blanks, True/False, Match the Column, and Short/Long answers.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto items-center mb-8">
              <select 
                value={selectedPartMode}
                onChange={(e) => setSelectedPartMode(e.target.value as any)}
                className={`px-4 py-3 rounded-xl text-sm font-bold border outline-none appearance-none cursor-pointer w-full sm:w-auto ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-200 focus:border-blue-500' : 'bg-white border-gray-200 text-gray-700 focus:border-blue-500'
                }`}
              >
                <option value="both">Generate All (Part 1 & 2)</option>
                <option value="part1">Only Part 1: Objective & Short</option>
                <option value="part2">Only Part 2: Long & Analytical</option>
              </select>
              <button 
                onClick={handleGenerateNotes}
                className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-xl shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all w-full sm:w-auto"
              >
                <i className="fa-solid fa-wand-magic-sparkles mr-2"></i> Generate Notes
              </button>
            </div>
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
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="flex items-center justify-center space-x-1">
                  <p className={`text-sm font-mono ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                    Analyzing syllabus pattern
                  </p>
                  <motion.span
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >...</motion.span>
                </div>
                <p className={`text-xs opacity-60 font-medium ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                  Developed by Ritik Roushan Sah
                </p>
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
          <div className="animate-fadeIn mt-6" ref={contentRef}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-6 mb-6 gap-4" data-html2canvas-ignore="true">
              <h3 className={`text-xl font-black ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                <i className="fa-solid fa-check-circle mr-2"></i> Notes Generated Successfully
              </h3>
              <button 
                className={`bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors font-bold text-sm shadow-md ${isExporting ? 'opacity-70 cursor-not-allowed' : ''}`}
                onClick={handleDownloadPDF}
                disabled={isExporting}
              >
                {isExporting ? (
                  <><i className="fa-solid fa-spinner animate-spin mr-2"></i> Exporting...</>
                ) : (
                  <><i className="fa-solid fa-file-pdf mr-2"></i> Download PDF</>
                )}
              </button>
            </div>
            
            <div className={`prose prose-sm md:prose-base max-w-none ${darkMode ? 'prose-invert' : ''}`}>
              <h1 className="text-3xl font-black mb-6 border-b-2 border-blue-500 pb-2">{selectedChapter.title} - Notes</h1>
              <div className="markdown-body">
                <Markdown>{generatedNotes}</Markdown>
              </div>
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
