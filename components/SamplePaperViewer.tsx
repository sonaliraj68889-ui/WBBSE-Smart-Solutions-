
import React, { useState, useRef } from 'react';
// @ts-ignore
import html2pdf from 'html2pdf.js/dist/html2pdf.bundle.min.js';
import { SamplePaper } from '../types.ts';
import { translations } from '../translations.ts';
import MathText from './MathText.tsx';

interface SamplePaperViewerProps {
  paper: SamplePaper;
  darkMode: boolean;
  lang: 'en' | 'hi';
  onBack: () => void;
  onRegenerate?: () => void;
}

const SamplePaperViewer: React.FC<SamplePaperViewerProps> = ({ paper, darkMode, lang, onBack, onRegenerate }) => {
  const t = translations[lang];
  const [showAnswers, setShowAnswers] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handleDownloadPDF = async () => {
    if (!printRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const element = printRef.current;
      const opt = {
        margin:       [15, 10, 15, 10],
        filename:     `${paper.title}-wbbse.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
      };
      
      // We temporarily add a print class to ensure light mode styling for the PDF if needed
      // but html2pdf captures what's currently rendered so let it capture as is.
      await html2pdf().from(element).set(opt).toPdf().get('pdf').then((pdf: any) => {
        const totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          pdf.setFontSize(10);
          pdf.setTextColor(150);
          
          let headerText = `${paper.subject} | ${paper.classLabel} | ${paper.term}`;
          
          // jsPDF standard fonts don't support Hindi/Unicode, so map to English if possible
          // or strip out characters that can't be rendered.
          const attemptEnMap = (text: string) => {
            if (/^[\x00-\x7F]*$/.test(text)) return text;
            let result = text;
            Object.keys(translations.hi.classLabels).forEach(k => {
              if (translations.hi.classLabels[k as keyof typeof translations.hi.classLabels] === text) result = translations.en.classLabels[k as keyof typeof translations.en.classLabels];
            });
            Object.keys(translations.hi.subjects).forEach(k => {
              if (translations.hi.subjects[k as keyof typeof translations.hi.subjects] === text) result = translations.en.subjects[k as keyof typeof translations.en.subjects];
            });
            if (translations.hi.selection === text) result = translations.en.selection;
            if (translations.hi.summative1 === text) result = translations.en.summative1;
            if (translations.hi.summative2 === text) result = translations.en.summative2;
            if (translations.hi.summative3 === text) result = translations.en.summative3;
            
            return /^[\x00-\x7F]*$/.test(result) ? result : result.replace(/[^\x00-\x7F]/g, "").trim();
          };
          
          const safeSubject = attemptEnMap(paper.subject);
          const safeClass = attemptEnMap(paper.classLabel);
          const safeTerm = attemptEnMap(paper.term);
          
          const finalHeaderParts = [safeSubject, safeClass, safeTerm].filter(p => p.length > 1 && p !== '()');
          
          if (finalHeaderParts.length > 0) {
            pdf.text(finalHeaderParts.join(' | '), 10, 10);
          }
          
          pdf.text("Developed by Ritik Roushan Sah", 10, pdf.internal.pageSize.getHeight() - 10);
          
          pdf.text(`Page ${i} of ${totalPages}`, pdf.internal.pageSize.getWidth() - 30, pdf.internal.pageSize.getHeight() - 10);
        }
      }).save();
    } catch (e) {
      console.error("PDF generation error:", e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    const shareData: ShareData = {
      title: paper.title,
      text: `WBBSE Board Sample Paper: ${paper.title}. Prepared by WBBSE Smart Solutions.`,
    };

    // Conditionally add the URL if it's a valid web protocol (http or https)
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      shareData.url = window.location.href;
    }

    if (navigator.share) {
      try { 
        await navigator.share(shareData); 
      } catch (err: any) {
        console.error("Error sharing:", err);
        // Fallback to clipboard copy if sharing fails, especially for 'Invalid URL' errors
        if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.message.includes('Invalid URL') || err.message.includes('permission denied'))) {
          navigator.clipboard.writeText(window.location.href);
          setShowCopied(true);
          setTimeout(() => setShowCopied(false), 2000);
        }
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  };

  return (
    <div className="animate-fadeIn pb-20 print:pb-0 print:block">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 no-print gap-4">
        <button onClick={onBack} className={`px-4 py-2.5 rounded-2xl flex items-center space-x-2 font-black text-xs uppercase transition-all shadow-md ${darkMode ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
          <i className="fa-solid fa-house"></i>
          <span>{t.mainMenu}</span>
        </button>
        <div className="flex flex-wrap items-center gap-3">
          {showCopied && <span className="text-[10px] font-bold text-emerald-500">{t.copied}</span>}
          {onRegenerate && (
            <button onClick={onRegenerate} className={`px-5 py-2.5 rounded-2xl flex items-center space-x-2 font-black text-xs uppercase shadow-lg ${darkMode ? 'bg-slate-800 text-purple-400 hover:bg-slate-700' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'}`}>
              <i className="fa-solid fa-rotate-right"></i>
              <span>{lang === 'hi' ? 'नया बनाएं' : 'Regenerate'}</span>
            </button>
          )}
          <button onClick={handleShare} className={`px-5 py-2.5 rounded-2xl flex items-center space-x-2 font-black text-xs uppercase shadow-lg ${darkMode ? 'bg-slate-800 text-blue-400' : 'bg-blue-50 text-blue-700'}`}>
            <i className="fa-solid fa-share-nodes"></i>
            <span>{t.share}</span>
          </button>
          <button onClick={() => setShowAnswers(!showAnswers)} className={`px-5 py-2.5 rounded-2xl flex items-center space-x-2 font-black text-xs uppercase shadow-lg ${showAnswers ? 'bg-emerald-600 text-white' : (darkMode ? 'bg-slate-800 text-emerald-400' : 'bg-emerald-50 text-emerald-700')}`}>
            <i className={`fa-solid ${showAnswers ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            <span>{showAnswers ? t.hideSolutions : t.viewSolutions}</span>
          </button>
          <button onClick={handleDownloadPDF} disabled={isExporting} className={`px-6 py-2.5 rounded-2xl flex items-center space-x-2 font-black text-xs uppercase shadow-xl transition-all ${isExporting ? 'bg-blue-400 cursor-wait text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            <i className={`fa-solid ${isExporting ? 'fa-spinner fa-spin' : 'fa-file-pdf'}`}></i>
            <span>{isExporting ? (lang === 'hi' ? 'PDF बना रहा है...' : 'Generating PDF...') : t.downloadPDF}</span>
          </button>
        </div>
      </div>

      <div ref={printRef} className={`p-10 md:p-16 rounded-[2.5rem] shadow-2xl border transition-colors printable-content ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-gray-100 text-gray-900'}`}>
        <div className="text-center mb-12 border-b-4 border-current pb-8">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-40 mb-4">WBBSE Smart Solutions Archive</p>
          <h1 className="text-4xl md:text-5xl font-black mb-4 uppercase leading-none">{paper.title}</h1>
          <div className="flex flex-wrap justify-center gap-x-12 gap-y-3 text-sm font-black uppercase opacity-60">
            <p>{lang === 'hi' ? 'विषय' : 'Subject'}: {paper.subject}</p>
            <p>{paper.classLabel}</p>
            <p>{paper.term}</p>
          </div>
          <div className="grid grid-cols-2 gap-8 border-y-2 border-current py-6 mt-10">
            <div className="text-left"><span className="font-black text-2xl">{paper.timeAllowed}</span></div>
            <div className="text-right"><span className="font-black text-2xl">{paper.fullMarks}</span></div>
          </div>
        </div>

        <div className="space-y-20">
          {paper.sections?.map((section, sIdx) => (
            <div key={sIdx} className="space-y-10">
              <h2 className="text-2xl font-black border-b-4 border-blue-600 pb-2 uppercase">{section.title}</h2>
              <p className="text-sm italic font-bold opacity-60">{section.instructions}</p>
              {section.passage && (
                <div className={`p-10 rounded-[2rem] border-2 shadow-inner leading-relaxed text-lg font-serif italic ${darkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-stone-50 border-stone-200'}`}>
                  {(section.passage || '').split('\n').map((p, i) => <div key={i} className={i > 0 ? 'mt-4' : ''}><MathText text={p} isInline /></div>)}
                </div>
              )}
              <div className="space-y-12">
                {section.questions?.map((q, qIdx) => (
                  <div key={q.id} className="relative pl-12 print:break-inside-avoid print-no-break">
                    <span className="absolute left-0 top-0 font-black text-2xl opacity-20">{qIdx + 1}.</span>
                    <div className="flex justify-between items-start gap-8">
                      <div className="flex-1">
                        <div className="font-bold text-xl mb-6"><MathText text={q.text} /></div>
                        {q.options && q.options.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                            {q.options.map((opt, o) => (
                              <div key={o} className="flex items-center space-x-4">
                                <span className="w-8 h-8 flex-shrink-0 flex items-center justify-center border-2 border-current/20 rounded-xl text-[10px] font-black">{String.fromCharCode(65 + o)}</span>
                                <span className="font-bold opacity-80"><MathText text={opt} isInline /></span>
                              </div>
                            ))}
                          </div>
                        )}
                        {showAnswers && q.answer && (
                          <div className="mt-8 p-6 rounded-3xl text-sm border-2 bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                            <span className="font-black uppercase text-[10px] block mb-2 opacity-60 text-inherit">Solution</span>
                            <div className="font-medium text-base leading-relaxed">
                              <MathText text={q.answer} />
                            </div>
                          </div>
                        )}
                      </div>
                      <span className="text-xs font-black border-2 border-current/20 px-4 py-1.5 rounded-full opacity-60">[{q.marks}]</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {paper.sources && paper.sources.length > 0 && (
          <div className="mt-20 pt-8 border-t-2 border-current border-dashed no-print">
            <h4 className="text-xs font-black uppercase tracking-widest opacity-40 mb-4">{t.sources}</h4>
            <div className="flex flex-wrap gap-3">
              {paper.sources.map((src, i) => (
                <a key={i} href={src.uri} target="_blank" rel="noopener" className={`px-4 py-2 rounded-xl border text-[10px] font-bold flex items-center space-x-2 transition-all hover:scale-105 ${darkMode ? 'bg-slate-800 border-slate-700 text-blue-400' : 'bg-white border-gray-100 text-blue-700 shadow-sm'}`}>
                  <i className="fa-solid fa-link opacity-40"></i>
                  <span className="truncate max-w-[200px]">{src.title || src.uri}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="mt-24 pt-16 border-t-2 border-current border-dashed flex flex-col md:flex-row justify-between items-end gap-12 opacity-40">
           <div><div className="w-48 border-b border-current mb-4"></div><p className="text-[10px] font-black uppercase">Candidate Signature</p></div>
           <div className="text-center">
             <i className="fa-solid fa-graduation-cap text-3xl mb-2"></i>
             <p className="text-[9px] font-black uppercase">End of Paper</p>
             <p className="text-[8px] font-black uppercase tracking-widest mt-2">{t.developedBy} {t.authorName}</p>
           </div>
           <div><div className="w-48 border-b border-current mb-4"></div><p className="text-[10px] font-black uppercase">Invigilator Signature</p></div>
        </div>
      </div>
    </div>
  );
};

export default SamplePaperViewer;
