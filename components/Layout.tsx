
import React, { useState } from 'react';
import { translations } from '../translations';
import SearchBar from './SearchBar';
import { Subject } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  lang: 'en' | 'hi';
  setLang: (lang: 'en' | 'hi') => void;
  onSearchSelect: (subject: Subject, classLabel: string, chapterId: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, darkMode, setDarkMode, lang, setLang, onSearchSelect }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const t = translations[lang];

  const navItems = [
    { id: 'dashboard', label: t.dashboard, icon: 'fa-home' },
    { id: 'tutor', label: t.smartTutor, icon: 'fa-robot' },
    { id: 'curriculum', label: t.curriculum, icon: 'fa-graduation-cap' },
    { id: 'resources', label: t.studyMaterials, icon: 'fa-file-signature' },
  ];

  return (
    <div className={`min-h-screen transition-colors duration-500 flex flex-col md:flex-row ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-gray-50 text-gray-900'}`}>
      {/* Mobile Header */}
      <header className={`md:hidden p-4 flex flex-col sticky top-0 z-50 transition-all duration-300 ${darkMode ? 'bg-slate-900 border-b border-slate-800' : 'bg-blue-700 text-white shadow-md'}`}>
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center space-x-2">
            <i className="fa-solid fa-graduation-cap text-2xl"></i>
            <span className="font-bold text-xl tracking-tight">WBBSE Smart Solutions</span>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
              className={`p-2 rounded-lg transition-colors ${isMobileSearchOpen ? 'bg-white/20' : ''}`}
            >
              <i className="fa-solid fa-magnifying-glass"></i>
            </button>
            <button onClick={() => setDarkMode(!darkMode)} className="p-2">
              <i className={`fa-solid ${darkMode ? 'fa-sun text-yellow-400' : 'fa-moon text-white'}`}></i>
            </button>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              <i className={`fa-solid ${isSidebarOpen ? 'fa-xmark' : 'fa-bars'} text-2xl`}></i>
            </button>
          </div>
        </div>
        
        {/* Mobile Search Bar Expansion */}
        {isMobileSearchOpen && (
          <div className="mt-3 animate-fadeIn">
            <SearchBar 
              darkMode={darkMode} 
              lang={lang} 
              onResultClick={(sub, cls, chap) => {
                onSearchSelect(sub, cls, chap);
                setIsMobileSearchOpen(false);
              }}
              isMobileSearchVisible={true}
            />
          </div>
        )}
      </header>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        ${darkMode ? 'bg-slate-900 border-r border-slate-800' : 'bg-blue-800 text-white'}
      `}>
        <div className="p-6 h-full flex flex-col">
          <div className="hidden md:flex items-center justify-between mb-10">
            <div className="flex items-center space-x-3">
              <div className={darkMode ? 'bg-blue-600 p-2 rounded-lg' : 'bg-white p-2 rounded-lg'}>
                <i className={`fa-solid fa-graduation-cap ${darkMode ? 'text-white' : 'text-blue-800'} text-2xl`}></i>
              </div>
              <span className="font-bold text-xl tracking-tight">WBBSE Smart</span>
            </div>
          </div>

          <nav className="space-y-2 flex-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center space-x-4 px-4 py-3 rounded-xl transition-all ${
                  activeTab === item.id 
                    ? (darkMode ? 'bg-blue-600 text-white' : 'bg-white/20 text-white shadow-lg') 
                    : (darkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-white/10 text-blue-100')
                }`}
              >
                <i className={`fa-solid ${item.icon} w-6 text-center`}></i>
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-auto space-y-4">
            <div className="flex flex-col space-y-2">
              <button 
                onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
                className={`w-full flex items-center space-x-4 px-4 py-3 rounded-xl transition-all border ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-blue-400' : 'bg-blue-900/50 border-blue-700 text-blue-100'
                }`}
              >
                <i className="fa-solid fa-language w-6 text-center"></i>
                <span className="font-medium">{lang === 'en' ? 'English (En)' : 'हिंदी (Hi)'}</span>
              </button>

              <button 
                onClick={() => setDarkMode(!darkMode)}
                className={`w-full flex items-center space-x-4 px-4 py-3 rounded-xl transition-all border ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-yellow-400' : 'bg-blue-900/50 border-blue-700 text-blue-200'
                }`}
              >
                {/* Fixed syntax error: removed extra braces and colons */}
                <i className={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'} w-6 text-center`}></i>
                <span className="font-medium">{darkMode ? t.lightMode : t.darkMode}</span>
              </button>
            </div>

            <div className={`${darkMode ? 'bg-slate-800' : 'bg-blue-700/50'} rounded-2xl p-4 border ${darkMode ? 'border-slate-700' : 'border-blue-600/50'}`}>
              <p className="text-xs text-blue-200 mb-2 uppercase tracking-wider font-semibold">{t.hindiMedium}</p>
              <h4 className="text-sm font-bold mb-1">{t.classSpecialized}</h4>
              <p className="text-xs opacity-70">{t.boardCurriculum}</p>
            </div>
            
            {/* Author Credit */}
            <div className="pt-2 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">
                {t.developedBy}
              </p>
              <p className="text-[11px] font-bold mt-0.5 opacity-60">
                {t.authorName}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 h-screen overflow-y-auto relative custom-scrollbar">
        <div className="max-w-6xl mx-auto p-4 md:p-8">
          {/* Desktop Top Header Bar */}
          <div className="hidden md:flex items-center justify-between mb-8 gap-6">
            <div className="flex-1 max-w-2xl">
              <SearchBar 
                darkMode={darkMode} 
                lang={lang} 
                onResultClick={onSearchSelect} 
              />
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
                className={`p-3.5 rounded-2xl border transition-all hover:scale-105 active:scale-95 ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-blue-400' : 'bg-white border-gray-100 text-blue-600 shadow-sm'
                }`}
                title={t.language}
              >
                <i className="fa-solid fa-language text-lg"></i>
              </button>
              <button 
                onClick={() => setDarkMode(!darkMode)}
                className={`p-3.5 rounded-2xl border transition-all hover:scale-105 active:scale-95 ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-yellow-400' : 'bg-white border-gray-100 text-indigo-600 shadow-sm'
                }`}
                title={darkMode ? t.lightMode : t.darkMode}
              >
                <i className={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'} text-lg`}></i>
              </button>
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
