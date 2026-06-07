
import React, { useState, useEffect, useRef } from 'react';
import { CLASSES } from '../constants.ts';
import { translations } from '../translations.ts';
import { Subject, Chapter } from '../types.ts';

interface SearchResult {
  classId: string;
  classLabel: string;
  subject: Subject;
  chapter: Chapter;
}

interface SearchBarProps {
  darkMode: boolean;
  lang: 'en' | 'hi';
  onResultClick: (subject: Subject, classId: string, chapterId: string) => void;
  isMobileSearchVisible?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ darkMode, lang, onResultClick, isMobileSearchVisible }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const t = translations[lang];

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      
      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setQuery(transcript);
        setShowDropdown(true);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      
      recognitionRef.current = recognition;
    }
  }, []);

  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = lang === 'hi' ? 'hi-IN' : 'en-US';
    }
  }, [lang]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.error("Speech recognition error:", e);
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getLocalizedClassName = (classId: string) => {
    return (t.classLabels as any)[classId] || classId;
  };

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    const searchResults: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    CLASSES.forEach((cls) => {
      const classLabel = getLocalizedClassName(cls.id);
      cls.subjects.forEach((sub) => {
        const localizedSubName = (t.subjects as any)[sub.id] || sub.name;
        
        sub.chapters.forEach((chap) => {
          if (
            chap.title.toLowerCase().includes(lowerQuery) ||
            localizedSubName.toLowerCase().includes(lowerQuery) ||
            classLabel.toLowerCase().includes(lowerQuery)
          ) {
            searchResults.push({
              classId: cls.id,
              classLabel: classLabel,
              subject: sub,
              chapter: chap,
            });
          }
        });
      });
    });

    setResults(searchResults.slice(0, 8));
    setShowDropdown(true);
  }, [query, t.subjects, t.classLabels]);

  const handleResultClick = (res: SearchResult) => {
    onResultClick(res.subject, res.classId, res.chapter.id);
    setQuery('');
    setShowDropdown(false);
  };

  return (
    <div className={`relative w-full transition-all duration-300 ${isMobileSearchVisible ? 'block' : 'hidden md:block'}`} ref={dropdownRef}>
      <div className={`relative flex items-center group`}>
        <div className={`absolute left-4 transition-colors ${darkMode ? 'text-slate-500 group-focus-within:text-blue-400' : 'text-gray-400 group-focus-within:text-blue-600'}`}>
          <i className="fa-solid fa-magnifying-glass"></i>
        </div>
        <input
          type="text"
          placeholder={t.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setShowDropdown(true)}
          className={`w-full pl-12 pr-12 py-3 rounded-2xl border transition-all outline-none text-sm font-medium ${
            darkMode 
              ? 'bg-slate-800 border-slate-700 text-slate-100 focus:bg-slate-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10' 
              : 'bg-white border-gray-100 text-gray-900 shadow-sm focus:border-blue-400 focus:ring-4 focus:ring-blue-100/50'
          }`}
        />
        <div className="absolute right-3 flex items-center space-x-1">
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
            >
              <i className="fa-solid fa-circle-xmark"></i>
            </button>
          )}
          {('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) && (
            <button
              onClick={toggleListening}
              className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${
                isListening 
                  ? 'bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 animate-pulse' 
                  : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:text-slate-500 dark:hover:text-blue-400 dark:hover:bg-blue-900/30'
              }`}
            >
              <i className={`fa-solid ${isListening ? 'fa-microphone-lines' : 'fa-microphone'}`}></i>
            </button>
          )}
        </div>
      </div>

      {showDropdown && (
        <div className={`absolute left-0 right-0 mt-2 z-[100] rounded-2xl border shadow-2xl overflow-hidden animate-fadeIn ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'
        }`}>
          {results.length > 0 ? (
            <div className="max-h-[350px] overflow-y-auto no-scrollbar py-2">
              {results.map((res, i) => (
                <button
                  key={i}
                  onClick={() => handleResultClick(res)}
                  className={`w-full text-left px-5 py-4 flex items-center space-x-4 transition-all ${
                    darkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-blue-50 text-gray-700'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white shadow-sm ${res.subject.color}`}>
                    <i className={`fa-solid ${res.subject.icon} text-sm`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                        darkMode ? 'bg-slate-800 text-slate-500' : 'bg-gray-100 text-gray-500'
                      }`}>{(res.classLabel || '').split(' ')[1] || res.classLabel}</span>
                      <span className="text-[10px] font-bold text-blue-500 opacity-80">{(t.subjects as any)[res.subject.id] || res.subject.name}</span>
                    </div>
                    <p className="font-bold text-sm truncate">{res.chapter.title}</p>
                  </div>
                  <i className="fa-solid fa-chevron-right text-[10px] opacity-20"></i>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-10 text-center">
              <div className="w-16 h-16 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300 dark:text-slate-700">
                <i className="fa-solid fa-search-minus text-2xl"></i>
              </div>
              <p className="text-sm font-bold opacity-50">{t.noResults}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
