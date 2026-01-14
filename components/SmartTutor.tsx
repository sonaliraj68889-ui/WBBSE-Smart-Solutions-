
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { solveProblem, generateDiagram, fetchExamQuestions, generateSpeech, summarizeChapter, translateContent } from '../services/geminiService';
import { Message, ExamQuestion, ExamResult, ExamTerm, Subject, Chapter } from '../types';
import { translations } from '../translations';
import { CLASSES } from '../constants';

interface SmartTutorProps {
  darkMode: boolean;
  lang: 'en' | 'hi';
  initialQuery?: string;
  initialFile?: { data: string, name: string, mimeType: string };
  onSaveSearch: (query: string) => void;
}

const SAVED_EXAM_KEY = 'wbbse_active_exam_session';

const SUGGESTED_DIAGRAMS = [
  { en: "Human Heart", hi: "मानव हृदय" },
  { en: "Photosynthesis", hi: "प्रकाश संश्लेषण" },
  { en: "Nitrogen Cycle", hi: "नाइट्रोजन चक्र" },
  { en: "Structure of Atom", hi: "परमाणु की संरचना" },
  { en: "Water Cycle", hi: "जल चक्र" },
  { en: "Electric Motor", hi: "विद्युत मोटर" },
  { en: "Plant Cell", hi: "पादप कोशिका" }
];

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const SmartTutor: React.FC<SmartTutorProps> = ({ darkMode, lang, initialQuery, initialFile, onSaveSearch }) => {
  const t = translations[lang];
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'initial',
      role: 'model',
      text: t.tutorGreeting,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveSession, setIsLiveSession] = useState(false);
  const [isGeneratingDiagram, setIsGeneratingDiagram] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ data: string, name: string, mimeType: string } | null>(null);
  const [showCopiedId, setShowCopiedId] = useState<string | null>(null);

  const [isAnyVoiceLoading, setIsAnyVoiceLoading] = useState<string | null>(null);

  // Curriculum Summary Feature State
  const [isSummaryMenuOpen, setIsSummaryMenuOpen] = useState(false);
  const [summaryStep, setSummaryStep] = useState<'class' | 'subject' | 'chapter' | 'length'>('class');
  const [selClassId, setSelClassId] = useState<string>('');
  const [selSubId, setSelSubId] = useState<string>('');
  const [selChap, setSelChap] = useState<Chapter | null>(null);

  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const liveSessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const micStreamRef = useRef<MediaStream | null>(null);

  const [isExamMode, setIsExamMode] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState(CLASSES[0].id);
  const [selectedTerm, setSelectedTerm] = useState<ExamTerm>('Summative 3');
  const [selectedSubjectName, setSelectedSubjectName] = useState<string>('');
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);
  const [currentExamIndex, setCurrentExamIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [examResult, setExamResult] = useState<ExamResult | null>(null);
  const [examTimer, setExamTimer] = useState(0);
  const [isExamLoading, setIsExamLoading] = useState(false);
  const [savedSession, setSavedSession] = useState<any>(null);
  
  const timerRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(SAVED_EXAM_KEY);
    if (saved) {
      try {
        setSavedSession(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved exam session");
      }
    }
    return () => stopLiveSession();
  }, []);

  useEffect(() => {
    if (isExamMode && examQuestions.length > 0 && !examResult) {
      const sessionData = {
        selectedClassId, selectedTerm, selectedSubjectName,
        examQuestions, currentExamIndex, userAnswers, examTimer,
        timestamp: Date.now()
      };
      localStorage.setItem(SAVED_EXAM_KEY, JSON.stringify(sessionData));
      setSavedSession(sessionData);
    }
  }, [isExamMode, examQuestions, userAnswers, currentExamIndex, examTimer, examResult]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, isGeneratingDiagram, isExamMode, examResult, isLiveSession, isSummaryMenuOpen]);

  useEffect(() => {
    if (initialQuery) handleSend(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (initialFile) setUploadedFile(initialFile);
  }, [initialFile]);

  const startLiveSession = async () => {
    if (isLiveSession) {
      stopLiveSession();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      
      audioContextInRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextOutRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const outNode = audioContextOutRef.current.createGain();
      outNode.connect(audioContextOutRef.current.destination);

      let currentInputTranscription = '';
      let currentOutputTranscription = '';

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsLiveSession(true);
            const source = audioContextInRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextInRef.current!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
              
              const pcmBlob: Blob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };

              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextInRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData && audioContextOutRef.current) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContextOutRef.current.currentTime);
              const buffer = await decodeAudioData(decode(audioData), audioContextOutRef.current, 24000, 1);
              const source = audioContextOutRef.current.createBufferSource();
              source.buffer = buffer;
              source.connect(outNode);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              audioSourcesRef.current.add(source);
              source.onended = () => audioSourcesRef.current.delete(source);
            }

            if (message.serverContent?.interrupted) {
              audioSourcesRef.current.forEach(s => { try { s.stop(); } catch(e){} });
              audioSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }

            if (message.serverContent?.inputTranscription) {
              currentInputTranscription += message.serverContent.inputTranscription.text;
            }
            if (message.serverContent?.outputTranscription) {
              currentOutputTranscription += message.serverContent.outputTranscription.text;
            }

            if (message.serverContent?.turnComplete) {
              if (currentInputTranscription) {
                setMessages(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), role: 'user', text: currentInputTranscription, timestamp: new Date() }]);
              }
              if (currentOutputTranscription) {
                setMessages(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), role: 'model', text: currentOutputTranscription, timestamp: new Date() }]);
              }
              currentInputTranscription = '';
              currentOutputTranscription = '';
            }
          },
          onclose: () => setIsLiveSession(false),
          onerror: (e) => {
            console.error("Live Error:", e);
            stopLiveSession();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `You are an expert WBBSE Hindi Medium Tutor. Assist the student verbally. Keep responses concise and educational. Strictly Hindi/English mix. NO BENGALI.`,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: lang === 'hi' ? 'Kore' : 'Zephyr' } }
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        }
      });

      liveSessionRef.current = sessionPromise;
    } catch (err) {
      console.error("Mic Access Error:", err);
      alert(lang === 'hi' ? "माइक्रोफोन एक्सेस की अनुमति नहीं है" : "Microphone access denied");
    }
  };

  const stopLiveSession = () => {
    if (liveSessionRef.current) {
      liveSessionRef.current.then((s: any) => s.close());
      liveSessionRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    audioSourcesRef.current.forEach(s => { try { s.stop(); } catch(e){} });
    audioSourcesRef.current.clear();
    setIsLiveSession(false);
  };

  const handleShareMessage = async (msg: Message) => {
    const textToShare = msg.showTranslated && msg.translatedText ? msg.translatedText : msg.text;
    const shareData = {
      title: "WBBSE Smart Solutions",
      text: `Question: ${messages.find(m => m.timestamp < msg.timestamp && m.role === 'user')?.text || 'WBBSE Query'}\n\nAI Solution: ${textToShare}`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      navigator.clipboard.writeText(textToShare);
      setShowCopiedId(msg.id);
      setTimeout(() => setShowCopiedId(null), 2000);
    }
  };

  const startExam = async (subjectName: string, level: string) => {
    setIsExamLoading(true);
    setSelectedSubjectName(subjectName);
    try {
      const questions = await fetchExamQuestions(subjectName, level, selectedTerm);
      setExamQuestions(questions);
      setUserAnswers(new Array(questions.length).fill(-1));
      setCurrentExamIndex(0);
      setExamResult(null);
      setIsExamMode(true);
      setExamTimer(600);
    } catch (error) {
      alert(lang === 'hi' ? "परीक्षा शुरू करने में त्रुटि" : "Error starting exam");
    } finally {
      setIsExamLoading(false);
    }
  };

  const resumeExam = () => {
    if (!savedSession) return;
    setSelectedClassId(savedSession.selectedClassId);
    setSelectedTerm(savedSession.selectedTerm);
    setSelectedSubjectName(savedSession.selectedSubjectName);
    setExamQuestions(savedSession.examQuestions);
    setUserAnswers(savedSession.userAnswers);
    setCurrentExamIndex(savedSession.currentExamIndex);
    setExamTimer(savedSession.examTimer);
    setIsExamMode(true);
    setExamResult(null);
  };

  const handleExamSubmit = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    let correctCount = 0;
    const detailed = examQuestions.map((q, idx) => {
      const isCorrect = userAnswers[idx] === q.correctAnswer;
      if (isCorrect) correctCount++;
      return {
        question: q.question,
        userAnswer: q.options[userAnswers[idx]] || (lang === 'hi' ? "कोई उत्तर नहीं" : "No answer"),
        correctAnswer: q.options[q.correctAnswer],
        isCorrect,
        explanation: q.explanation
      };
    });
    setExamResult({
      score: correctCount,
      total: examQuestions.length,
      feedback: correctCount === examQuestions.length 
        ? (lang === 'hi' ? "उत्कृष्ट प्रदर्शन!" : "Excellent performance!")
        : (lang === 'hi' ? "अच्छा प्रयास, और अभ्यास करें।" : "Good effort, keep practicing."),
      detailedResults: detailed
    });
    localStorage.removeItem(SAVED_EXAM_KEY);
    setSavedSession(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedFile({
          data: event.target?.result as string,
          name: file.name,
          mimeType: file.type
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const getLocalizedSubjectName = (subId: string, fallback: string) => {
    return t.subjects[subId as keyof typeof t.subjects] || fallback;
  };

  const handleSend = async (overrideInput?: string) => {
    const query = overrideInput || input;
    if ((!query.trim() && !uploadedFile) || isLoading) return;
    if (query.trim()) onSaveSearch(query);
    
    const currentInput = query || (lang === 'hi' ? "कृपया इस फ़ाइल का विश्लेषण करें और समस्या को हल करें।" : "Please analyze this file and solve the problem.");
    const currentFile = uploadedFile;
    
    const userMsg: Message = { 
      id: Math.random().toString(36).substr(2, 9),
      role: 'user', 
      text: query + (currentFile && !currentFile.mimeType.startsWith('image/') ? `\n[File: ${currentFile.name}]` : ''),
      imageUrl: currentFile?.mimeType.startsWith('image/') ? currentFile.data : undefined,
      timestamp: new Date() 
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setUploadedFile(null);
    setIsLoading(true);
    
    try {
      const response = await solveProblem(
        currentInput, 
        "WBBSE Hindi Medium", 
        currentFile ? { data: currentFile.data, mimeType: currentFile.mimeType } : undefined
      );
      const botMsg: Message = { 
        id: Math.random().toString(36).substr(2, 9),
        role: 'model', 
        text: response.text, 
        timestamp: new Date(),
        grounding: response.grounding
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      setMessages(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), role: 'model', text: lang === 'hi' ? "त्रुटि! कृपया पुनः प्रयास करें।" : "Error! Please try again.", timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateChapterSummary = async (length: 'short' | 'medium' | 'long') => {
    if (!selChap) return;
    
    setIsSummaryMenuOpen(false);
    setIsLoading(true);
    
    const selectedClass = CLASSES.find(c => c.id === selClassId);
    const selectedSubject = selectedClass?.subjects.find(s => s.id === selSubId);
    const subjectName = getLocalizedSubjectName(selSubId, selectedSubject?.name || '');
    
    const query = lang === 'hi' 
      ? `कृपया मुझे कक्षा ${selectedClass?.label} के ${subjectName} विषय के अध्याय "${selChap.title}" का ${t[length]} सारांश दें।`
      : `Please provide a ${t[length]} summary for the chapter "${selChap.title}" from ${subjectName} (Class ${selectedClass?.label}).`;
    
    setMessages(prev => [...prev, { 
      id: Math.random().toString(36).substr(2, 9),
      role: 'user', 
      text: query, 
      timestamp: new Date() 
    }]);

    try {
      const summaryText = await summarizeChapter(selChap.title, subjectName, length, selSubId);
      setMessages(prev => [...prev, { 
        id: Math.random().toString(36).substr(2, 9),
        role: 'model', 
        text: summaryText, 
        timestamp: new Date() 
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { 
        id: Math.random().toString(36).substr(2, 9),
        role: 'model', 
        text: lang === 'hi' ? "सारांश तैयार करने में विफल।" : "Failed to generate summary.", 
        timestamp: new Date() 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranslateMessage = async (msgId: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg || msg.translatedText) {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, showTranslated: !m.showTranslated } : m));
      return;
    }

    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isTranslating: true } : m));
    try {
      // If it looks like Hindi, translate to English. Otherwise, translate to Hindi.
      const hasHindi = /[\u0900-\u097F]/.test(msg.text);
      const targetLang = hasHindi ? 'English' : 'Hindi';
      
      const translated = await translateContent(msg.text, targetLang);
      setMessages(prev => prev.map(m => m.id === msgId ? { 
        ...m, 
        translatedText: translated, 
        showTranslated: true, 
        isTranslating: false 
      } : m));
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isTranslating: false } : m));
    }
  };

  const handlePlayVoice = async (msg: Message) => {
    const textToSpeak = msg.showTranslated && msg.translatedText ? msg.translatedText : msg.text;
    
    if (msg.isSpeaking) {
      audioSourcesRef.current.forEach(s => { try { s.stop(); } catch(e){} });
      audioSourcesRef.current.clear();
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isSpeaking: false } : m));
      return;
    }

    setIsAnyVoiceLoading(msg.id);
    
    try {
      const hasHindi = /[\u0900-\u097F]/.test(textToSpeak);
      const voiceName = hasHindi ? 'Kore' : 'Zephyr';
      
      const audioData = await generateSpeech(textToSpeak, voiceName);
      
      if (!audioData) throw new Error("No audio data generated");

      if (!audioContextOutRef.current) {
        audioContextOutRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      const buffer = await decodeAudioData(decode(audioData), audioContextOutRef.current, 24000, 1);
      const source = audioContextOutRef.current.createBufferSource();
      source.buffer = buffer;
      
      const outNode = audioContextOutRef.current.createGain();
      outNode.connect(audioContextOutRef.current.destination);
      source.connect(outNode);

      audioSourcesRef.current.forEach(s => { try { s.stop(); } catch(e){} });
      audioSourcesRef.current.clear();
      setMessages(prev => prev.map(m => ({ ...m, isSpeaking: false })));

      source.start();
      audioSourcesRef.current.add(source);
      
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isSpeaking: true } : m));
      
      source.onended = () => {
        audioSourcesRef.current.delete(source);
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isSpeaking: false } : m));
      };
    } catch (error) {
      console.error("Speech playback error:", error);
    } finally {
      setIsAnyVoiceLoading(null);
    }
  };

  const handleGenerateDiagram = async (topicOverride?: string) => {
    const topic = topicOverride || input;
    if (!topic.trim() || isGeneratingDiagram) return;
    setIsGeneratingDiagram(true);
    if (!topicOverride) setInput('');
    onSaveSearch(topic);
    setMessages(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), role: 'user', text: lang === 'hi' ? `चित्र बनाएँ: ${topic}` : `Generate a diagram for: ${topic}`, timestamp: new Date() }]);
    try {
      const imageUrl = await generateDiagram(topic);
      if (imageUrl) {
        setMessages(prev => [...prev, { 
          id: Math.random().toString(36).substr(2, 9),
          role: 'model', text: lang === 'hi' ? `मैंने आपके लिए "${topic}" का चित्र तैयार किया है:` : `I have generated a diagram for "${topic}":`, 
          timestamp: new Date(), imageUrl: imageUrl
        }]);
      } else {
        setMessages(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), role: 'model', text: lang === 'hi' ? "चित्र बनाने में विफल।" : "Failed to generate diagram.", timestamp: new Date() }]);
      }
    } finally {
      setIsGeneratingDiagram(false);
    }
  };

  const terms: {id: ExamTerm, label: string, desc: string}[] = [
    { id: 'Summative 1', label: t.summative1, desc: t.summativeSyllabus1 },
    { id: 'Summative 2', label: t.summative2, desc: t.summativeSyllabus2 },
    { id: 'Summative 3', label: t.summative3, desc: t.summativeSyllabus3 },
    { id: 'Madhyamik Selection', label: t.selection, desc: t.summativeSyllabus3 },
  ];

  const currentClass = CLASSES.find(c => c.id === selectedClassId) || CLASSES[0];
  const summaryClass = CLASSES.find(c => c.id === selClassId);
  const summarySubject = summaryClass?.subjects.find(s => s.id === selSubId);

  return (
    <div className={`flex flex-col h-[calc(100vh-160px)] md:h-[calc(100vh-120px)] rounded-3xl shadow-xl overflow-hidden border transition-colors ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
      <div className={`p-4 flex items-center justify-between transition-colors duration-500 ${
        isLiveSession ? 'bg-indigo-900' : (darkMode ? 'bg-slate-800' : (isExamMode ? 'bg-indigo-700' : 'bg-blue-600'))
      } text-white`}>
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            isLiveSession ? 'bg-indigo-400 animate-pulse' : (isExamMode ? 'bg-amber-400 text-amber-900 rotate-[360deg]' : 'bg-white/20 text-white')
          }`}>
            <i className={`fa-solid ${isLiveSession ? 'fa-volume-high' : (isExamMode ? 'fa-stopwatch' : 'fa-robot')} text-xl`}></i>
          </div>
          <div>
            <h2 className="font-bold leading-none">{isLiveSession ? (lang === 'hi' ? 'लाइव ट्यूटर' : 'Live Voice Session') : (isExamMode ? t.examMode : t.smartTutor)}</h2>
            <p className={`text-xs mt-1 transition-opacity ${isExamMode ? 'font-black text-amber-300' : 'opacity-70'}`}>
              {isExamMode ? (examQuestions.length > 0 ? `${t.timeLeft}: ${formatTime(examTimer)}` : t.selectTerm) : (isLiveSession ? t.voiceActive : t.classSpecialized)}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => {
              if (isExamMode) {
                if (confirm(lang === 'hi' ? "क्या आप परीक्षा समाप्त करना चाहते हैं?" : "Are you sure you want to end the exam?")) {
                  setIsExamMode(false); setExamResult(null); setExamQuestions([]); localStorage.removeItem(SAVED_EXAM_KEY); setSavedSession(null);
                }
              } else {
                setIsExamMode(true); stopLiveSession(); setIsSummaryMenuOpen(false);
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg ${
              isExamMode ? 'bg-red-500 hover:bg-red-600' : 'bg-white/20 hover:bg-white/30 border border-white/20'
            }`}
          >
            {isExamMode ? t.endExam : t.examMode}
          </button>
          {!isExamMode && !isLiveSession && (
            <div className="flex items-center space-x-2">
              <button onClick={() => cameraInputRef.current?.click()} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors" title={t.scanProblem}>
                <i className="fa-solid fa-camera"></i>
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                <i className="fa-solid fa-paperclip"></i>
              </button>
              <input type="file" hidden ref={fileInputRef} onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx" />
              <input type="file" hidden ref={cameraInputRef} onChange={handleFileUpload} accept="image/*" capture="environment" />
            </div>
          )}
        </div>
      </div>

      <div ref={scrollRef} className={`flex-1 overflow-y-auto p-4 md:p-6 space-y-6 relative ${darkMode ? 'bg-slate-950/50' : 'bg-gray-50/50'}`}>
        {isLiveSession && (
          <div className="absolute inset-x-0 top-0 z-10 p-4 animate-fadeIn">
            <div className={`p-4 rounded-2xl flex items-center justify-between border shadow-2xl ${darkMode ? 'bg-slate-900 border-indigo-500/30' : 'bg-white border-indigo-200'}`}>
              <div className="flex items-center space-x-4">
                <div className="flex space-x-1 items-end h-6">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-1 bg-indigo-500 rounded-full animate-pulse" style={{ height: `${20 + Math.random() * 80}%`, animationDelay: `${i * 100}ms` }}></div>
                  ))}
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-indigo-500">{lang === 'hi' ? 'ट्यूटर सुन रहा है...' : 'Tutor is Listening...'}</span>
              </div>
              <button onClick={stopLiveSession} className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center text-xs shadow-lg hover:scale-110 transition-transform">
                <i className="fa-solid fa-phone-slash"></i>
              </button>
            </div>
          </div>
        )}

        {isExamMode ? (
          <div className="max-w-4xl mx-auto w-full h-full">
            {isExamLoading ? (
              <div className="flex flex-col items-center justify-center h-full space-y-4">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className={darkMode ? 'text-slate-400' : 'text-gray-500 font-bold animate-pulse'}>{t.examLoading}</p>
              </div>
            ) : examQuestions.length === 0 ? (
              <div className="animate-fadeIn flex flex-col items-center py-8">
                {savedSession && (
                  <div className={`w-full max-w-2xl mb-12 p-6 rounded-[2rem] border-2 border-dashed animate-pulse transition-all ${
                    darkMode ? 'bg-blue-900/20 border-blue-500/40 text-blue-200' : 'bg-blue-50 border-blue-200 text-blue-800'
                  }`}>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-xl shadow-lg">
                          <i className="fa-solid fa-history"></i>
                        </div>
                        <div>
                          <h4 className="font-black text-lg">{lang === 'hi' ? 'अधूरी परीक्षा फिर से शुरू करें?' : 'Resume Unfinished Exam?'}</h4>
                          <p className="text-xs opacity-70 font-bold uppercase tracking-tight">{savedSession.selectedSubjectName} • {savedSession.selectedTerm}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <button onClick={resumeExam} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl">
                          {lang === 'hi' ? 'जारी रखें' : 'Resume'}
                        </button>
                        <button onClick={() => { localStorage.removeItem(SAVED_EXAM_KEY); setSavedSession(null); }} className="px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest opacity-50">
                          {lang === 'hi' ? 'हटाएं' : 'Discard'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="w-24 h-24 rounded-3xl bg-blue-600 text-white flex items-center justify-center text-4xl mb-6 shadow-2xl rotate-3">
                  <i className="fa-solid fa-user-graduate"></i>
                </div>
                <h3 className="text-3xl font-black mb-8 text-center">{t.startExam}</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 w-full">
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <h4 className="text-xs font-black uppercase tracking-[0.2em] opacity-50 flex items-center"><i className="fa-solid fa-users-viewfinder mr-2 text-blue-500"></i> {t.selectClass}</h4>
                      <div className="grid grid-cols-3 gap-2">
                        {CLASSES.map(c => (
                          <button key={c.id} onClick={() => setSelectedClassId(c.id)} className={`px-3 py-3 rounded-2xl text-xs font-black border transition-all ${selectedClassId === c.id ? 'bg-blue-600 text-white border-blue-600 shadow-xl' : (darkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-gray-200 text-gray-500')}`}>
                            {c.label.split(' ')[1] || c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-xs font-black uppercase tracking-[0.2em] opacity-50 flex items-center"><i className="fa-solid fa-calendar-check mr-2 text-blue-500"></i> {t.selectTerm}</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {terms.map(term => {
                          if (term.id === 'Madhyamik Selection' && selectedClassId !== 'class-10') return null;
                          return (
                            <button key={term.id} onClick={() => setSelectedTerm(term.id)} className={`w-full text-left p-5 rounded-3xl border transition-all ${selectedTerm === term.id ? 'bg-blue-600 text-white border-blue-600 shadow-xl' : (darkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-gray-200 text-gray-500')}`}>
                              <span className="font-black text-sm">{term.label}</span>
                              <p className={`text-[10px] mt-2 font-medium ${selectedTerm === term.id ? 'text-blue-100' : 'opacity-60'}`}>{term.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] opacity-50 flex items-center"><i className="fa-solid fa-book mr-2 text-blue-500"></i> {t.examSubject}</h4>
                    <div className="grid grid-cols-1 gap-3">
                      {currentClass.subjects.map(sub => (
                        <button key={sub.id} onClick={() => startExam(getLocalizedSubjectName(sub.id, sub.name), currentClass.label)} className={`group flex items-center justify-between p-5 rounded-3xl border transition-all ${darkMode ? 'bg-slate-900 border-slate-800 hover:border-blue-500' : 'bg-white border-gray-100 hover:shadow-xl'}`}>
                          <div className="flex items-center space-x-5">
                            <div className={`w-12 h-12 ${sub.color} rounded-2xl flex items-center justify-center text-white shadow-xl group-hover:rotate-6 transition-all`}>
                              <i className={`fa-solid ${sub.icon} text-lg`}></i>
                            </div>
                            <span className="font-black block">{getLocalizedSubjectName(sub.id, sub.name)}</span>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all"><i className="fa-solid fa-play text-[10px] ml-0.5"></i></div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : examResult ? (
              <div className="animate-fadeIn space-y-6 pb-10">
                <div className={`rounded-[2.5rem] p-12 text-center shadow-2xl relative overflow-hidden ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-gray-100'}`}>
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500"></div>
                  <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center text-6xl mb-8 shadow-2xl ${examResult.score >= examResult.total / 2 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}><i className={`fa-solid ${examResult.score >= examResult.total / 2 ? 'fa-medal' : 'fa-brain'}`}></i></div>
                  <h3 className="text-4xl font-black mb-2 tracking-tight">{t.examResult}</h3>
                  <div className="text-7xl font-black text-blue-600 tabular-nums">{examResult.score}<span className="text-4xl opacity-30 mx-2">/</span>{examResult.total}</div>
                  <p className="text-2xl font-bold opacity-80 mb-10">{examResult.feedback}</p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button onClick={() => { setExamQuestions([]); setExamResult(null); }} className="w-full sm:w-auto bg-blue-600 text-white px-12 py-5 rounded-[2rem] font-black uppercase tracking-widest hover:bg-blue-700 shadow-2xl transition-all">
                      <i className="fa-solid fa-rotate-left mr-3"></i> {lang === 'hi' ? 'फिर से अभ्यास करें' : 'Practice Again'}
                    </button>
                    <button onClick={() => { setIsExamMode(false); setExamResult(null); setExamQuestions([]); }} className={`w-full sm:w-auto px-12 py-5 rounded-[2rem] font-black uppercase tracking-widest border-2 ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-gray-100 border-gray-200 text-gray-600'}`}>{t.back}</button>
                  </div>
                </div>
                {examResult.detailedResults.map((res, i) => (
                  <div key={i} className={`p-8 rounded-[2rem] border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100 shadow-sm'}`}>
                    <div className="flex items-start justify-between mb-6">
                      <span className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center text-[10px] font-black">#{i+1}</span>
                      <span className={`text-[10px] font-black uppercase px-4 py-2 rounded-full border ${res.isCorrect ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : 'text-red-500 bg-red-500/10 border-red-500/20'}`}><i className={`fa-solid ${res.isCorrect ? 'fa-check' : 'fa-xmark'} mr-2`}></i> {res.isCorrect ? 'Correct' : 'Incorrect'}</span>
                    </div>
                    <p className="font-bold text-xl mb-8 leading-relaxed">{res.question}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-8">
                      <div className={`p-5 rounded-2xl border ${res.isCorrect ? 'border-emerald-500/20' : 'border-red-500/20'}`}><span className="opacity-60 block text-[9px] font-black uppercase mb-2">Student Choice</span><span className={`font-black text-base ${res.isCorrect ? 'text-emerald-500' : 'text-red-500'}`}>{res.userAnswer}</span></div>
                      <div className={`p-5 rounded-2xl border border-emerald-500/20 bg-emerald-50/10`}><span className="opacity-60 block text-[9px] font-black uppercase mb-2 text-emerald-600">Correct Answer</span><span className="text-emerald-600 font-black text-base">{res.correctAnswer}</span></div>
                    </div>
                    <p className="text-xs font-medium italic opacity-80 leading-relaxed">{res.explanation}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col h-full space-y-6">
                <div className={`flex flex-wrap items-center justify-between gap-4 p-4 rounded-3xl border shadow-lg ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
                  <div className="flex items-center space-x-3"><div className="px-4 py-2 rounded-xl bg-blue-600 text-white font-black text-xs uppercase tracking-wider">{selectedSubjectName}</div></div>
                  <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-2"><div className="text-right"><span className="block text-[8px] font-black uppercase opacity-40">Remaining</span><span className={`block font-black text-xl tabular-nums ${examTimer < 60 ? 'text-red-500 animate-pulse' : 'text-amber-500'}`}>{formatTime(examTimer)}</span></div></div>
                    <div className="text-center"><span className="block text-[8px] font-black uppercase opacity-40">Progress</span><span className="block font-black text-lg">{currentExamIndex + 1}<span className="opacity-30 mx-1">/</span>{examQuestions.length}</span></div>
                  </div>
                </div>
                <div className={`p-10 md:p-14 rounded-[2.5rem] border shadow-2xl flex-1 relative overflow-hidden ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
                   <div className="absolute top-0 left-0 h-1 bg-blue-600 transition-all duration-500" style={{ width: `${((currentExamIndex + 1) / examQuestions.length) * 100}%` }}></div>
                   <h3 className="text-3xl md:text-4xl font-black mb-16 leading-[1.15] tracking-tight">{examQuestions[currentExamIndex].question}</h3>
                   <div className="grid grid-cols-1 gap-5">
                     {examQuestions[currentExamIndex].options.map((option, idx) => (
                       <button key={idx} onClick={() => { const newAnswers = [...userAnswers]; newAnswers[currentExamIndex] = idx; setUserAnswers(newAnswers); }} className={`w-full text-left p-6 rounded-3xl border-2 transition-all relative ${userAnswers[currentExamIndex] === idx ? 'bg-blue-600/20 border-blue-600 text-blue-400' : (darkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500' : 'bg-gray-50 border-gray-100 text-gray-700 hover:shadow-lg')}`}>
                         {userAnswers[currentExamIndex] === idx && <div className="absolute right-6 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg"><i className="fa-solid fa-check text-xs"></i></div>}
                         <div className="flex items-center space-x-6"><div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base ${userAnswers[currentExamIndex] === idx ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-500'}`}>{String.fromCharCode(65 + idx)}</div><span className="text-xl font-black">{option}</span></div>
                       </button>
                     ))}
                   </div>
                </div>
                <div className="flex items-center justify-between px-2 pb-6">
                  <button disabled={currentExamIndex === 0} onClick={() => setCurrentExamIndex(prev => prev - 1)} className={`px-10 py-5 rounded-3xl font-black uppercase tracking-widest text-xs flex items-center transition-all ${darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-20' : 'bg-white border shadow-md text-gray-600 hover:bg-gray-50 disabled:opacity-30'}`}><i className="fa-solid fa-arrow-left-long mr-3"></i> {t.previous}</button>
                  {currentExamIndex === examQuestions.length - 1 ? (
                    <button onClick={handleExamSubmit} className="px-14 py-5 rounded-3xl font-black uppercase tracking-[0.2em] text-xs bg-emerald-600 text-white shadow-2xl hover:bg-emerald-700 active:scale-95 animate-pulse">{t.submitExam} <i className="fa-solid fa-paper-plane-top ml-3"></i></button>
                  ) : (
                    <button onClick={() => setCurrentExamIndex(prev => prev + 1)} className="px-12 py-5 rounded-3xl font-black uppercase tracking-widest text-xs bg-blue-600 text-white shadow-2xl hover:bg-blue-700 active:scale-95">{t.next} <i className="fa-solid fa-arrow-right-long ml-3"></i></button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <div key={msg.id || idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm relative group/msg ${msg.role === 'user' ? (darkMode ? 'bg-blue-700 text-white' : 'bg-blue-600 text-white shadow-md') + ' rounded-tr-none' : (darkMode ? 'bg-slate-800 text-slate-100 border-slate-700' : 'bg-white text-gray-800 border-gray-100 shadow-sm') + ' rounded-tl-none border'}`}>
                  {msg.role === 'model' && (
                    <div className="absolute -right-12 top-0 flex flex-col space-y-2">
                      {showCopiedId === msg.id && (
                        <div className="absolute -top-6 right-0 text-[8px] font-black text-emerald-500 animate-fadeIn whitespace-nowrap">{t.copied}</div>
                      )}
                      
                      <button 
                        onClick={() => handlePlayVoice(msg)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-90 ${
                          msg.isSpeaking 
                          ? 'bg-blue-500 text-white animate-pulse shadow-md' 
                          : (darkMode ? 'bg-slate-800 text-blue-400 hover:bg-slate-700 border border-slate-700' : 'bg-white text-blue-600 shadow-md border border-gray-100')
                        }`}
                        title={lang === 'hi' ? 'सुनें' : 'Listen'}
                      >
                        {isAnyVoiceLoading === msg.id ? (
                          <i className="fa-solid fa-circle-notch animate-spin text-xs"></i>
                        ) : (
                          <i className={`fa-solid ${msg.isSpeaking ? 'fa-stop' : 'fa-volume-up'} text-xs`}></i>
                        )}
                      </button>

                      <button 
                        onClick={() => handleShareMessage(msg)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-90 ${
                          darkMode ? 'bg-slate-800 text-blue-400 hover:bg-slate-700 border border-slate-700' : 'bg-white text-blue-600 shadow-md border border-gray-100'
                        }`}
                        title={t.share}
                      >
                        <i className="fa-solid fa-share-nodes text-xs"></i>
                      </button>
                      
                      <button 
                        onClick={() => handleTranslateMessage(msg.id)}
                        disabled={msg.isTranslating}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-90 ${
                          msg.showTranslated 
                          ? 'bg-emerald-500 text-white shadow-md' 
                          : (darkMode ? 'bg-slate-800 text-emerald-400 hover:bg-slate-700 border border-slate-700' : 'bg-white text-emerald-600 shadow-md border border-gray-100')
                        }`}
                        title={t.translateToHindi}
                      >
                        {msg.isTranslating ? (
                          <i className="fa-solid fa-circle-notch animate-spin text-xs"></i>
                        ) : (
                          <i className="fa-solid fa-language text-xs"></i>
                        )}
                      </button>
                    </div>
                  )}

                  <div className="prose prose-sm max-w-none prose-p:leading-relaxed">
                    {(msg.showTranslated && msg.translatedText ? msg.translatedText : msg.text).split('\n').map((line, i) => (
                      <p key={i} className="mb-2 whitespace-pre-wrap text-inherit">
                        {line}
                      </p>
                    ))}
                    
                    {msg.imageUrl && (
                      <div className="mt-4 rounded-xl overflow-hidden border border-white/20 shadow-lg">
                        <img src={msg.imageUrl} alt="Diagram" className="w-full h-auto" />
                        {msg.role === 'model' && (
                           <button onClick={() => { const link = document.createElement('a'); link.href = msg.imageUrl!; link.download = 'diagram.png'; link.click(); }} className="w-full bg-black/40 py-2 text-xs font-bold hover:bg-black/60 transition-colors text-white"><i className="fa-solid fa-download mr-2"></i> {t.downloadDiagram}</button>
                        )}
                      </div>
                    )}
                    
                    {msg.grounding && msg.grounding.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-inherit/20">
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-2 opacity-70">{t.sources}</p>
                        <div className="flex flex-wrap gap-2">
                          {msg.grounding.map((chunk, i) => chunk.web && (
                            <a key={i} href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className={`text-[10px] px-2 py-1 rounded-md transition-colors flex items-center space-x-1 ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-blue-50 hover:bg-blue-100 text-blue-700'}`}>
                              <i className="fa-solid fa-link text-[8px]"></i><span className="truncate max-w-[150px]">{chunk.web.title || chunk.web.uri}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className={`text-[10px] mt-2 opacity-60 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {msg.showTranslated && <span className="ml-2 italic opacity-40">(Translated)</span>}
                  </div>
                </div>
              </div>
            ))}
            {(isLoading || isGeneratingDiagram) && (
              <div className="flex justify-start">
                <div className={`rounded-2xl p-4 shadow-sm rounded-tl-none border flex items-center space-x-2 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
                  <div className="flex space-x-1"><div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div><div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div></div>
                  <span className={`text-xs font-medium italic ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>{isGeneratingDiagram ? t.drawing : t.thinking}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className={`p-4 border-t ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
        {!isExamMode ? (
          <>
            <div className="flex items-center space-x-2 overflow-x-auto pb-3 mb-1 no-scrollbar">
              <span className={`text-[10px] font-bold uppercase tracking-wider whitespace-nowrap px-1 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}><i className="fa-solid fa-lightbulb mr-1"></i> {lang === 'hi' ? 'सुझाव:' : 'Try:'}</span>
              {SUGGESTED_DIAGRAMS.map((topic, i) => (
                <button key={i} onClick={() => handleGenerateDiagram(topic[lang])} disabled={isLoading || isGeneratingDiagram} className={`whitespace-nowrap px-3 py-1 rounded-full text-[11px] font-semibold border transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-blue-500' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-400 hover:bg-blue-50 shadow-sm'} disabled:opacity-50`}>{topic[lang]}</button>
              ))}
            </div>

            {uploadedFile && (
              <div className={`mb-2 p-3 rounded-2xl flex items-center justify-between animate-fadeIn ${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-blue-50 border border-blue-100 shadow-inner'}`}>
                <div className="flex items-center space-x-3 overflow-hidden">
                   {uploadedFile.mimeType.startsWith('image/') ? (
                      <img src={uploadedFile.data} alt="Preview" className="w-10 h-10 rounded-lg object-cover shadow-md border border-white/20" />
                   ) : (
                      <div className="w-10 h-10 rounded-lg bg-blue-200 flex items-center justify-center text-blue-600"><i className="fa-solid fa-file-lines"></i></div>
                   )}
                   <span className="text-xs truncate font-bold text-blue-600 dark:text-blue-400">{uploadedFile.name}</span>
                </div>
                <button onClick={() => setUploadedFile(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors"><i className="fa-solid fa-circle-xmark"></i></button>
              </div>
            )}
            
            <div className="flex items-center space-x-2">
              <button 
                onClick={startLiveSession}
                className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 ${
                  isLiveSession ? 'bg-red-500 text-white shadow-inner animate-pulse' : (darkMode ? 'bg-slate-800 text-blue-400 hover:bg-slate-700' : 'bg-blue-50 text-blue-600 hover:bg-blue-100 shadow-sm')
                }`}
                title={lang === 'hi' ? 'आवाज से बात करें' : 'Talk with Voice'}
              >
                <i className={`fa-solid ${isLiveSession ? 'fa-phone-slash' : 'fa-microphone'} text-lg`}></i>
              </button>
              
              <div className="flex-1 relative">
                <input 
                  type="text" 
                  placeholder={isLiveSession ? (lang === 'hi' ? 'बोलिए...' : 'Say something...') : t.diagramPrompt}
                  className={`w-full pl-4 pr-12 py-3 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all outline-none ${darkMode ? 'bg-slate-800 text-slate-100' : 'bg-gray-100 text-gray-900'}`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  disabled={isLiveSession}
                />
                <button onClick={() => handleSend()} disabled={isLoading || isLiveSession || (!input.trim() && !uploadedFile)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded-xl shadow-lg disabled:opacity-50"><i className="fa-solid fa-paper-plane text-sm"></i></button>
              </div>
              
              <button 
                onClick={() => { setIsSummaryMenuOpen(!isSummaryMenuOpen); setSummaryStep('class'); }} 
                disabled={isLoading || isLiveSession}
                className={`w-12 h-12 flex flex-col items-center justify-center rounded-2xl transition-all ${isSummaryMenuOpen ? 'bg-blue-600 text-white shadow-inner' : (darkMode ? 'bg-slate-800 text-blue-400 hover:bg-slate-700' : 'bg-blue-50 text-blue-600 hover:bg-blue-100 shadow-sm')} disabled:opacity-50`}
                title={lang === 'hi' ? 'अध्याय सारांश' : 'Chapter Summary'}
              >
                <i className="fa-solid fa-book-bookmark text-sm"></i><span className="text-[8px] font-bold mt-1 uppercase">{lang === 'hi' ? 'सारांश' : 'Summ'}</span>
              </button>

              <button onClick={() => handleGenerateDiagram()} disabled={!input.trim() || isGeneratingDiagram || isLiveSession} className={`w-12 h-12 flex flex-col items-center justify-center rounded-2xl transition-all ${darkMode ? 'bg-slate-800 text-emerald-400 hover:bg-slate-700' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 shadow-sm'} disabled:opacity-50`}>
                <i className="fa-solid fa-chart-line text-sm"></i><span className="text-[8px] font-bold mt-1 uppercase">{t.draw}</span>
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-2"><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest flex items-center justify-center"><i className="fa-solid fa-shield-halved mr-2 text-blue-500"></i> AI Invigilated Practice Mode Active</p></div>
        )}
        <div className="mt-2 text-center"><p className="text-[10px] text-gray-400 font-medium">{t.voiceActive}</p></div>
      </div>
    </div>
  );
};

export default SmartTutor;
