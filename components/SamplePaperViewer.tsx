
import React, { useState } from 'react';
import { SamplePaper } from '../types';
import { translations } from '../translations';

interface SamplePaperViewerProps {
  paper: SamplePaper;
  darkMode: boolean;
  lang: 'en' | 'hi';
  onBack: () => void;
}

const SamplePaperViewer: React.FC<SamplePaperViewerProps> = ({ paper, darkMode, lang, onBack }) => {
  const t = translations[lang];
  const [showAnswers, setShowAnswers] = useState(false);
  const [showCopied, setShowCopied] = useState(false);

  const handleDownloadPDF = () => window.print();

  const handleShare = async () => {
    const shareData = {
      title: paper.title,
      text: `WBBSE Board Sample Paper: ${paper.title}. Prepared by WBBSE Smart Solutions.`,
      url: window.location.href,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (err) {}
    } else {
      navigator.clipboard.writeText(window.location.href);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  };

  return (
    <div className="animate-fadeIn pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 no-print gap-4">
        <button onClick={onBack} className={`px-4 py-2.5 rounded-2xl flex items-center space-x-2 font-black text-xs uppercase transition-all shadow-md ${darkMode ? 'bg-slate-800 text-slate-200' : 'bg-white text-gray-700'}`}>
          <i className="fa-solid fa-arrow-left"></i>
          <span>{t.back}</span>
        </button>
        <div className="flex flex-wrap items-center gap-3">
          {showCopied && <span className="text-[10px] font-bold text-emerald-500">{t.copied}</span>}
          <button onClick={handleShare} className={`px-5 py-2.5 rounded-2xl flex items-center space-x-2 font-black text-xs uppercase shadow-lg ${darkMode ? 'bg-slate-800 text-blue-400' : 'bg-blue-50 text-blue-700'}`}>
            <i className="fa-solid fa-share-nodes"></i>
            <span>{t.share}</span>
          </button>
          <button onClick={() => setShowAnswers(!showAnswers)} className={`px-5 py-2.5 rounded-2xl flex items-center space-x-2 font-black text-xs uppercase shadow-lg ${showAnswers ? 'bg-emerald-600 text-white' : (darkMode ? 'bg-slate-800 text-emerald-400' : 'bg-emerald-50 text-emerald-700')}`}>
            <i className={`fa-solid ${showAnswers ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            <span>{showAnswers ? t.hideSolutions : t.viewSolutions}</span>
          </button>
          <button onClick={handleDownloadPDF} className="px-6 py-2.5 bg-blue-600 text-white rounded-2xl flex items-center space-x-2 font-black text-xs uppercase shadow-xl hover:bg-blue-700">
            <i className="fa-solid fa-file-pdf"></i>
            <span>{t.downloadPDF}</span>
          </button>
        </div>
      </div>

      <div className={`p-10 md:p-16 rounded-[2.5rem] shadow-2xl border transition-colors printable-content ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-gray-100 text-gray-900'}`}>
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
          {paper.sections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-10 print:break-inside-avoid">
              <h2 className="text-2xl font-black border-b-4 border-blue-600 pb-2 uppercase">{section.title}</h2>
              <p className="text-sm italic font-bold opacity-60">{section.instructions}</p>
              {section.passage && (
                <div className={`p-10 rounded-[2rem] border-2 shadow-inner leading-relaxed text-lg font-serif italic ${darkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-stone-50 border-stone-200'}`}>
                  {section.passage.split('\n').map((p, i) => <p key={i} className={i > 0 ? 'mt-4' : ''}>{p}</p>)}
                </div>
              )}
              <div className="space-y-12">
                {section.questions.map((q, qIdx) => (
                  <div key={q.id} className="relative pl-12 print:break-inside-avoid">
                    <span className="absolute left-0 top-0 font-black text-2xl opacity-20">{qIdx + 1}.</span>
                    <div className="flex justify-between items-start gap-8">
                      <div className="flex-1">
                        <p className="font-bold text-xl mb-6">{q.text}</p>
                        {q.options && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                            {q.options.map((opt, o) => (
                              <div key={o} className="flex items-center space-x-4">
                                <span className="w-8 h-8 flex-shrink-0 flex items-center justify-center border-2 border-current/20 rounded-xl text-[10px] font-black">{String.fromCharCode(65 + o)}</span>
                                <span className="font-bold opacity-80">{opt}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {showAnswers && q.answer && (
                          <div className="mt-8 p-6 rounded-3xl text-sm border-2 bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                            <span className="font-black uppercase text-[10px] block mb-2 opacity-60 text-inherit">Solution</span>
                            <span className="font-bold text-lg">{q.answer}</span>
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

        {/* Source Grounding Listing */}
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
