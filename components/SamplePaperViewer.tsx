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

  const handleDownloadPDF = () => {
    window.print();
  };

  return (
    <div className="animate-fadeIn pb-20">
      {/* Action Header - Hidden during print */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 no-print gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className={`px-4 py-2.5 rounded-2xl flex items-center space-x-2 font-black text-xs uppercase tracking-widest transition-all w-fit shadow-md ${
              darkMode ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-100'
            }`}
          >
            <i className="fa-solid fa-arrow-left"></i>
            <span>{t.back}</span>
          </button>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => setShowAnswers(!showAnswers)}
            className={`px-5 py-2.5 rounded-2xl flex items-center space-x-2 font-black text-xs uppercase tracking-widest transition-all shadow-lg ${
              showAnswers 
                ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                : (darkMode ? 'bg-slate-800 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100')
            }`}
          >
            <i className={`fa-solid ${showAnswers ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            <span>{showAnswers ? t.hideSolutions : t.viewSolutions}</span>
          </button>
          
          <button 
            onClick={handleDownloadPDF}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-2xl flex items-center space-x-2 font-black text-xs uppercase tracking-[0.15em] shadow-xl hover:bg-blue-700 active:scale-95 transition-all"
          >
            <i className="fa-solid fa-file-pdf text-base"></i>
            <span>{t.downloadPDF}</span>
          </button>
        </div>
      </div>

      <div className={`p-10 md:p-16 rounded-[2.5rem] shadow-2xl print:shadow-none print:p-0 border transition-colors printable-content ${
        darkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-gray-100 text-gray-900'
      }`}>
        {/* Formal Board Header */}
        <div className="text-center mb-12 border-b-4 border-current pb-8">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-40 mb-4">WBBSE Smart Solutions Examination Archive</p>
          <h1 className="text-4xl md:text-5xl font-black mb-4 uppercase tracking-tighter leading-none">{paper.title}</h1>
          <div className="flex flex-wrap justify-center gap-x-12 gap-y-3 text-sm font-black uppercase tracking-widest opacity-60">
            <p>{lang === 'hi' ? 'विषय' : 'Subject'}: {paper.subject}</p>
            <p>{paper.classLabel}</p>
            <p>{paper.term}</p>
          </div>

          <div className="grid grid-cols-2 gap-8 border-y-2 border-current py-6 mt-10">
            <div className="text-left">
              <span className="font-black opacity-40 text-[9px] uppercase block tracking-[0.2em] mb-1">Duration</span>
              <span className="font-black text-2xl">{paper.timeAllowed}</span>
            </div>
            <div className="text-right">
              <span className="font-black opacity-40 text-[9px] uppercase block tracking-[0.2em] mb-1">Full Marks</span>
              <span className="font-black text-2xl">{paper.fullMarks}</span>
            </div>
          </div>
          
          <div className="mt-8 text-left bg-current/5 p-6 rounded-3xl">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-3">General Instructions:</p>
            <ul className="text-xs font-bold opacity-70 list-decimal list-inside space-y-2">
              <li>Candidates are expected to answer in their own words as far as practicable.</li>
              <li>Attempt all sections. Special marks will be given for neatness and accuracy.</li>
              <li>Figures in the margin indicate full marks for the respective questions.</li>
            </ul>
          </div>
        </div>

        {/* Paper Body */}
        <div className="space-y-20">
          {paper.sections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-10 print:break-inside-avoid">
              <div className="flex items-center space-x-6">
                <h2 className="text-2xl font-black border-b-4 border-blue-600 pb-2 whitespace-nowrap uppercase tracking-tight">{section.title}</h2>
                <div className="flex-1 border-t-2 border-current opacity-10"></div>
              </div>
              
              <p className="text-sm italic font-bold opacity-60">
                {section.instructions}
              </p>

              {section.passage && (
                <div className={`p-10 rounded-[2rem] border-2 shadow-inner leading-relaxed text-lg font-serif italic ${
                  darkMode ? 'bg-slate-950/50 border-slate-800 text-slate-300' : 'bg-stone-50 border-stone-200 text-stone-800'
                }`}>
                  {section.passage.split('\n').map((para, pIdx) => (
                    <p key={pIdx} className={pIdx > 0 ? 'mt-6' : ''}>{para}</p>
                  ))}
                </div>
              )}
              
              <div className="space-y-12">
                {section.questions.map((q, qIdx) => (
                  <div key={q.id} className="relative pl-12 print:break-inside-avoid">
                    <span className="absolute left-0 top-0 font-black text-2xl opacity-20">{qIdx + 1}.</span>
                    <div className="flex justify-between items-start gap-8">
                      <div className="flex-1">
                        <p className="font-bold text-xl leading-snug mb-6">{q.text}</p>
                        
                        {q.options && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                            {q.options.map((opt, oIdx) => (
                              <div key={oIdx} className="flex items-center space-x-4 text-base">
                                <span className="w-8 h-8 flex-shrink-0 flex items-center justify-center border-2 border-current/20 rounded-xl text-[10px] font-black uppercase">
                                  {String.fromCharCode(65 + oIdx)}
                                </span>
                                <span className="font-bold opacity-80">{opt}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {showAnswers && q.answer && (
                          <div className={`mt-8 p-6 rounded-3xl text-sm border-2 animate-fadeIn bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-400`}>
                            <span className="font-black uppercase text-[10px] tracking-widest block mb-2 opacity-60">Model Solution</span>
                            <span className="font-bold text-lg">{q.answer}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-xs font-black border-2 border-current/20 px-4 py-1.5 rounded-full opacity-60 whitespace-nowrap">
                          {q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Board Signature Region */}
        <div className="mt-24 pt-16 border-t-2 border-current border-dashed">
          <div className="flex flex-col md:flex-row justify-between items-end gap-12">
            <div className="text-center md:text-left">
               <div className="w-56 border-b border-current opacity-30 mb-4"></div>
               <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Candidate Signature</p>
            </div>
            <div className="text-center">
              <i className="fa-solid fa-graduation-cap text-3xl opacity-20 mb-4 block"></i>
              <p className="text-[9px] font-black uppercase tracking-[0.6em] opacity-20">End of Paper</p>
            </div>
            <div className="text-center md:text-right">
               <div className="w-56 border-b border-current opacity-30 mb-4"></div>
               <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Invigilator Signature</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SamplePaperViewer;