import React, { useState, useEffect } from 'react';
import { Subject, ExamTerm } from '../types.ts';
import { translations } from '../translations.ts';
import { getAllOfflineContent, OfflineContent, deleteOfflineContent } from '../services/offlineService.ts';
import { CLASSES } from '../constants.ts';

interface SavedOfflineProps {
  darkMode: boolean;
  lang: 'en' | 'hi';
  onSelectSubject: (subject: Subject, classId: string) => void;
  onSelectSamplePaper: (subject: string, classId: string, term: ExamTerm) => void;
  onHome: () => void;
}

const SavedOffline: React.FC<SavedOfflineProps> = ({ darkMode, lang, onSelectSubject, onSelectSamplePaper, onHome }) => {
  const t = translations[lang];
  const [offlineItems, setOfflineItems] = useState<OfflineContent[]>([]);

  useEffect(() => {
    const loadOfflineContent = async () => {
      const items = await getAllOfflineContent();
      setOfflineItems(items.sort((a, b) => b.timestamp - a.timestamp));
    };
    loadOfflineContent();
  }, []);

  const getLocalizedSubjectName = (subjectId: string, defaultName: string) => {
    return t.subjects[subjectId as keyof typeof t.subjects] || defaultName;
  };

  const getLocalizedClassName = (classId: string) => {
    return (t.classLabels as any)[classId] || classId;
  };

  const handleRemove = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm(lang === 'hi' ? 'क्या आप वाकई इसे हटाना चाहते हैं?' : 'Are you sure you want to remove this?')) {
      await deleteOfflineContent(id);
      setOfflineItems(prev => prev.filter(item => item.id !== id));
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      <div className="flex items-center justify-between">
        <button 
          onClick={onHome}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all ${
            darkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-white hover:bg-gray-50 text-gray-600 shadow-sm border border-gray-200'
          }`}
        >
          <i className="fa-solid fa-arrow-left"></i>
          <span className="font-bold">{lang === 'hi' ? 'मुख्य मेनू' : 'Main Menu'}</span>
        </button>
      </div>

      <section className={`p-6 md:p-8 rounded-3xl border shadow-sm transition-colors ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className={`text-2xl font-bold flex items-center ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
              <i className="fa-solid fa-cloud-arrow-down mr-3 text-emerald-500"></i>
              {lang === 'hi' ? 'ऑफ़लाइन सहेजा गया' : 'Saved Offline'}
            </h2>
            <p className={`text-sm mt-2 ${darkMode ? 'text-slate-500' : 'text-gray-500'}`}>
              {lang === 'hi' ? 'बिना इंटरनेट के अपने डाउनलोड किए गए अध्यायों और पेपरों तक पहुंचें' : 'Access your downloaded chapters and papers without internet'}
            </p>
          </div>
        </div>

        {offlineItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
             <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500 rounded-full flex items-center justify-center text-3xl mb-4">
               <i className="fa-solid fa-cloud-arrow-down"></i>
             </div>
             <h3 className={`text-xl font-bold mb-2 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
               {lang === 'hi' ? 'कुछ भी सहेजा नहीं गया' : 'Nothing saved yet'}
             </h3>
             <p className={`text-sm max-w-sm ${darkMode ? 'text-slate-500' : 'text-gray-500'}`}>
               {lang === 'hi' ? 'जब आप नोट्स या प्रश्न-उत्तर पढ़ते हैं, तो वे ऑफ़लाइन पढ़ने के लिए यहाँ अपने आप सहेज लिए जाते हैं।' : 'When you read notes or Q&A, they are automatically saved here for offline reading.'}
             </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {offlineItems.map((item) => {
              const classData = CLASSES.find(c => c.id === item.classId);
              const subjectData = classData?.subjects.find(s => s.id === item.subject);
              const chapterId = item.id.split('_').pop();
              
              return (
                <div
                  key={item.id}
                  className={`text-left p-5 rounded-2xl border transition-all hover:shadow-md flex flex-col gap-3 relative group cursor-pointer ${
                    darkMode ? 'bg-slate-800 border-slate-700 hover:border-emerald-500' : 'bg-gray-50 border-gray-200 hover:border-emerald-400 hover:bg-white'
                  }`}
                  onClick={() => {
                    if (item.type === 'paper') {
                      onSelectSamplePaper(item.subject, item.classId, item.id.split('_')[3] as ExamTerm);
                    } else if (subjectData && chapterId) {
                      onSelectSubject(subjectData, item.classId);
                    }
                  }}
                >
                  <button
                    onClick={(e) => handleRemove(e, item.id)}
                    className="absolute top-4 right-4 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600 p-1"
                    title={lang === 'hi' ? 'हटाएं' : 'Remove'}
                  >
                    <i className="fa-solid fa-trash"></i>
                  </button>
                  <div className="flex justify-between items-start pr-6">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md ${
                      item.type === 'summary' ? 'bg-blue-100 text-blue-700' : item.type === 'paper' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {item.type === 'summary' ? 'Notes' : item.type === 'paper' ? 'Paper' : 'Q&A'}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <h4 className={`font-bold text-base line-clamp-2 leading-tight mt-1 ${darkMode ? 'text-slate-200' : 'text-gray-800'}`}>{item.title}</h4>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mt-3 flex items-center">
                      <i className="fa-solid fa-graduation-cap mr-1.5"></i>
                      {getLocalizedClassName(item.classId)} • {getLocalizedSubjectName(item.subject, subjectData?.name || '')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default SavedOffline;
