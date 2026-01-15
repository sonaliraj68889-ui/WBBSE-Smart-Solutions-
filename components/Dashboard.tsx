
import React, { useState } from 'react';
import { CLASSES, USEFUL_LINKS } from '../constants';
import { Subject, SearchHistoryItem, ExamTerm } from '../types';
import { translations } from '../translations';

interface DashboardProps {
  onSelectSubject: (subject: Subject, classLabel: string) => void;
  onSearchHistoryClick: (query: string) => void;
  onClearHistory: () => void;
  onSelectSamplePaper: (subject: string, classLabel: string, term: ExamTerm) => void;
  searchHistory: SearchHistoryItem[];
  darkMode: boolean;
  lang: 'en' | 'hi';
}

const Dashboard: React.FC<DashboardProps> = ({ 
  onSelectSubject, 
  onSearchHistoryClick, 
  onClearHistory, 
  onSelectSamplePaper,
  searchHistory, 
  darkMode, 
  lang 
}) => {
  const t = translations[lang];
  const [activeClassTab, setActiveClassTab] = useState(CLASSES[0].id);

  const terms: { id: ExamTerm, label: string }[] = [
    { id: 'Summative 1', label: t.summative1 },
    { id: 'Summative 2', label: t.summative2 },
    { id: 'Summative 3', label: t.summative3 },
    { id: 'Madhyamik Selection', label: t.selection }
  ];

  const getLocalizedSubjectName = (subId: string, fallback: string) => {
    return t.subjects[subId as keyof typeof t.subjects] || fallback;
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      <section className={`rounded-3xl p-8 shadow-xl relative overflow-hidden transition-all duration-500 ${
        darkMode ? 'bg-gradient-to-br from-indigo-900 to-slate-900 border border-slate-800' : 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white'
      }`}>
        <div className="relative z-10">
          <h1 className="text-3xl md:text-4xl font-extrabold mb-4 text-white">
            {t.welcome}
          </h1>
          <p className={`text-lg max-w-xl mb-6 ${darkMode ? 'text-slate-300' : 'text-blue-100'}`}>
            {t.subHeading}
          </p>
          <div className="flex flex-wrap gap-4">
            <div className={`${darkMode ? 'bg-slate-800 border border-slate-700 text-slate-100' : 'bg-white/20 text-white'} backdrop-blur-md px-4 py-2 rounded-xl flex items-center space-x-2`}>
              <i className="fa-solid fa-fire text-orange-400"></i>
              <span className="text-sm font-semibold">{t.streak}</span>
            </div>
            <div className={`${darkMode ? 'bg-slate-800 border border-slate-700 text-slate-100' : 'bg-white/20 text-white'} backdrop-blur-md px-4 py-2 rounded-xl flex items-center space-x-2`}>
              <i className="fa-solid fa-medal text-yellow-400"></i>
              <span className="text-sm font-semibold">{t.topLearner}</span>
            </div>
          </div>
        </div>
        <div className={`absolute -right-10 -bottom-10 opacity-10 rotate-12 ${darkMode ? 'text-blue-500' : 'text-white'}`}>
          <i className="fa-solid fa-book-open text-[15rem]"></i>
        </div>
      </section>

      {/* Sample Papers Archive Section */}
      <section className={`p-6 rounded-3xl border shadow-sm transition-colors ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className={`text-2xl font-bold ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>{t.samplePapers}</h2>
            <p className={`text-sm ${darkMode ? 'text-slate-500' : 'text-gray-500'}`}>{lang === 'hi' ? 'सभी विषयों के नवीनतम सैंपल पेपर्स' : 'Latest Sample Papers for all subjects'}</p>
          </div>
          <div className="flex items-center bg-gray-100 dark:bg-slate-800 p-1 rounded-2xl overflow-x-auto no-scrollbar">
            {CLASSES.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveClassTab(c.id)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all whitespace-nowrap ${
                  activeClassTab === c.id ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-700 dark:hover:text-slate-300'
                }`}
              >
                {c.label.split(' ')[1] || c.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {terms.map(term => {
            const currentClass = CLASSES.find(c => c.id === activeClassTab)!;
            if (term.id === 'Madhyamik Selection' && currentClass.id !== 'class-10') return null;
            
            return (
              <div 
                key={term.id}
                className={`group flex flex-col p-5 rounded-3xl border transition-all hover:shadow-xl ${
                  darkMode ? 'bg-slate-950/50 border-slate-800 hover:border-blue-500' : 'bg-gray-50 border-gray-200 hover:border-blue-300 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center shadow-inner">
                    <i className="fa-solid fa-file-invoice"></i>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 opacity-80">Full Pack</span>
                </div>
                <h4 className={`font-black text-sm mb-5 leading-snug ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>{term.label}</h4>
                
                <div className="flex flex-col gap-2 flex-1">
                  {currentClass.subjects.map(sub => (
                    <button 
                      key={sub.id}
                      onClick={() => onSelectSamplePaper(getLocalizedSubjectName(sub.id, sub.name), currentClass.label, term.id)}
                      className={`text-left px-3 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-tight transition-all flex items-center justify-between group/btn ${
                        darkMode 
                          ? 'bg-slate-900 text-slate-400 hover:bg-blue-600 hover:text-white' 
                          : 'bg-white border border-gray-100 text-gray-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 shadow-sm'
                      }`}
                    >
                      <span className="truncate pr-2">{getLocalizedSubjectName(sub.id, sub.name)}</span>
                      <i className="fa-solid fa-circle-arrow-right text-[10px] opacity-0 group-hover/btn:opacity-100 transition-all -translate-x-2 group-hover/btn:translate-x-0"></i>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Search History Section */}
      {searchHistory.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className={`text-xl font-bold ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>{t.recentSearches}</h2>
            <button 
              onClick={onClearHistory}
              className="text-xs text-red-500 font-bold hover:underline"
            >
              {t.clearHistory}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 px-2">
            {searchHistory.map((item) => (
              <button
                key={item.id}
                onClick={() => onSearchHistoryClick(item.query)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  darkMode 
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-blue-500' 
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-blue-50 hover:border-blue-200'
                }`}
              >
                <i className="fa-solid fa-clock-rotate-left text-[10px] opacity-50"></i>
                <span className="truncate max-w-[150px]">{item.query}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {CLASSES.map((classLevel) => (
        <section key={classLevel.id} className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className={`text-2xl font-bold ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>{classLevel.label}</h2>
            <button className="text-blue-600 font-semibold hover:underline text-sm">{t.viewAll}</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {classLevel.subjects.map((subject) => (
              <div 
                key={subject.id}
                onClick={() => onSelectSubject(subject, classLevel.label)}
                className={`group cursor-pointer rounded-2xl p-6 border transition-all duration-300 shadow-sm hover:shadow-xl ${
                  darkMode ? 'bg-slate-900 border-slate-800 hover:border-blue-700' : 'bg-white border-gray-100 hover:border-blue-200'
                }`}
              >
                <div className={`w-12 h-12 ${subject.color} rounded-xl flex items-center justify-center text-white mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                  <i className={`fa-solid ${subject.icon} text-xl`}></i>
                </div>
                <h3 className={`text-xl font-bold mb-1 ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
                  {getLocalizedSubjectName(subject.id, subject.name)}
                </h3>
                <p className={`text-sm mb-4 ${darkMode ? 'text-slate-500' : 'text-gray-500'}`}>{subject.chapters.length} {t.chaptersAvailable}</p>
                <div className="flex items-center text-blue-600 font-bold text-sm">
                  <span>{t.startLearning}</span>
                  <i className="fa-solid fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Useful Resources Section */}
      <section className="space-y-4">
        <div className="px-2">
          <h2 className={`text-2xl font-bold ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>{t.usefulLinks}</h2>
          <p className={`text-sm ${darkMode ? 'text-slate-500' : 'text-gray-500'}`}>{t.resourceSub}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {USEFUL_LINKS.map((link, idx) => (
            <a 
              key={idx}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`p-5 rounded-2xl border transition-all hover:scale-[1.02] flex items-start space-x-4 ${
                darkMode ? 'bg-slate-900 border-slate-800 hover:border-blue-500 shadow-md' : 'bg-white border-gray-100 hover:border-blue-200 shadow-sm'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                darkMode ? 'bg-slate-800 text-blue-400' : 'bg-blue-50 text-blue-600'
              }`}>
                <i className={`fa-solid ${link.icon}`}></i>
              </div>
              <div className="flex-1">
                <h4 className={`font-bold mb-1 ${darkMode ? 'text-slate-200' : 'text-gray-800'}`}>{link.title}</h4>
                <p className={`text-xs mb-3 ${darkMode ? 'text-slate-500' : 'text-gray-500'}`}>{link.description}</p>
                <div className="text-[10px] font-bold text-blue-600 uppercase tracking-widest flex items-center">
                  <span>{t.visitSite}</span>
                  <i className="fa-solid fa-external-link ml-1"></i>
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className={`rounded-2xl p-6 border flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6 transition-colors ${
        darkMode ? 'bg-slate-900 border-slate-800' : 'bg-amber-50 border-amber-100'
      }`}>
        <div className="bg-amber-500 text-white w-16 h-16 rounded-full flex items-center justify-center text-3xl shadow-lg">
          <i className="fa-solid fa-bell"></i>
        </div>
        <div>
          <h3 className={`text-xl font-bold ${darkMode ? 'text-amber-400' : 'text-amber-900'}`}>{t.importantNote}</h3>
          <p className={darkMode ? 'text-slate-400' : 'text-amber-800/80'}>{t.routineUpdate}</p>
        </div>
        <button className="bg-amber-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-amber-700 transition-colors whitespace-nowrap">
          {t.viewRoutine}
        </button>
      </section>
      
      {/* Footer developed by mention */}
      <footer className="pt-8 pb-4 text-center border-t border-inherit/10 opacity-40">
        <p className="text-[10px] font-black uppercase tracking-[0.2em]">
          {t.developedBy} <span className="text-blue-500">{t.authorName}</span>
        </p>
      </footer>
    </div>
  );
};

export default Dashboard;
