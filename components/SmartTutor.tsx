

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { solveProblem, generateDiagram, fetchExamQuestions, generateSpeech, translateContent, ApiError } from '../services/geminiService.ts';
import { Message, ExamQuestion, ExamResult, ExamTerm, Chapter } from '../types.ts';
import { translations } from '../translations.ts';
import { CLASSES } from '../constants.ts';

interface SmartTutorProps {
  darkMode: boolean;
  lang: 'en' | 'hi';
  initialQuery?: string;
  initialFile?: { data: string, name: string, mimeType: string };
  onSaveSearch: (query: string) => void;
  onHome: () => void;
  onQuotaExceeded: () => void; // New prop for global quota error handling
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

const SmartTutor: React.FC<SmartTutorProps> = ({ darkMode, lang, initialQuery, initialFile, onSaveSearch, onHome, onQuotaExceeded }) => {
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
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [isAnyVoiceLoading, setIsAnyVoiceLoading] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
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

    const fsHandler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', fsHandler);

    return () => {
      stopLiveSession();
      document.removeEventListener('fullscreenchange', fsHandler);
    };
  }, []);

  // Initialize from initialFile prop
  useEffect(() => {
    if (initialFile) {
      setUploadedFile(initialFile);
    }
    if (initialQuery) {
      setInput(initialQuery);
    }
  }, [initialFile, initialQuery]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const getFriendlyErrorMessage = (err: any) => {
    if (err instanceof ApiError) {
      switch (err.code) {
        case 'QUOTA_EXCEEDED':
          onQuotaExceeded(); // Trigger global prompt
          return ""; // Return empty as global prompt will handle message
        case 'SAFETY_BLOCKED': return t.errorSafety;
        case 'SERVER_ERROR': return t.errorServer;
        default: return t.errorGeneric;
      }
    }
    return t.errorGeneric;
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
      const errorMsg = getFriendlyErrorMessage(err);
      if (errorMsg) { // Only show local message if not handled by global prompt
        setMessages(prev => [...prev, { 
          id: Math.random().toString(36).substr(2, 9), 
          role: 'model', 
          text: `⚠️ ${errorMsg}`, 
          timestamp: new Date() 
        }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const startExam = async (subjectName: string, levelLabel: string) => {
    setIsExamLoading(true);
    setSelectedSubjectName(subjectName);
    try {
      const questions = await fetchExamQuestions(subjectName, levelLabel, selectedTerm);
      setExamQuestions(questions);
      setUserAnswers(new Array(questions.length).fill(-1));
      setCurrentExamIndex(0);
      setExamResult(null);
      setIsExamMode(true);
      setExamTimer(600);
    } catch (error) {
      const errorMsg = getFriendlyErrorMessage(error);
      if (errorMsg) { // Only show local message if not handled by global prompt
        alert(`⚠️ ${errorMsg}`);
      }
    } finally {
      setIsExamLoading(false);
    }
  };

  const startLiveSession = async () => {
    if (isLiveSession) {
      stopLiveSession();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
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
            // Live session errors can also be quota related
            if (e.error && e.error.message && (e.error.message.includes('quota') || e.error.message.includes('429'))) {
              onQuotaExceeded();
            }
          }
        },
        config: {
          responseModalalities: [Modality.AUDIO],
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
      const errorMsg = getFriendlyErrorMessage(err);
      if (errorMsg) { // Only show local message if not handled by global prompt
        alert(`⚠️ ${errorMsg}`);
      }
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
    const shareData: ShareData = {
      title: "WBBSE Smart Solutions",
      text: `Question: ${messages.find(m => m.timestamp < msg.timestamp && m.role === 'user')?.text || 'WBBSE Query'}\n\nAI Solution: ${textToShare}`,
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
             navigator.clipboard.writeText(textToShare);
             setShowCopiedId(msg.id);
             setTimeout(() => setShowCopiedId(null), 2000);
        }
      }
    } else {
      // Fallback for browsers that do not support navigator.share
      navigator.clipboard.writeText(textToShare);
      setShowCopiedId(msg.id);
      setTimeout(() => setShowCopiedId(null), 2000);
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

  const getLocalizedClassName = (classId: string) => {
    return (t.classLabels as any)[classId] || classId;
  };

  const handleTranslateMessage = async (msgId: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg || msg.translatedText) {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, showTranslated: !m.showTranslated } : m));
      return;
    }

    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isTranslating: true } : m));
    try {
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
      const errorMsg = getFriendlyErrorMessage(err);
      if (errorMsg) { // Only show local message if not handled by global prompt
         setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isTranslating: false } : m));
      }
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
      const errorMsg = getFriendlyErrorMessage(error);
      if (errorMsg) { // Only show local message if not handled by global prompt
        console.error("Speech playback error:", errorMsg);
      }
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
    } catch(err: any) {
      const errorMsg = getFriendlyErrorMessage(err);
      if (errorMsg) { // Only show local message if not handled by global prompt
        setMessages(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), role: 'model', text: `⚠️ ${errorMsg}`, timestamp: new Date() }]);
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

  return (
    <div 
      ref={containerRef}
      className={`flex flex-col transition-all duration-500 overflow-hidden border shadow-2xl ${
        isFullscreen 
          ? 'fixed inset-0 z-[100] h-screen w-screen rounded-none' 
          : 'relative h-[calc(100vh-140px)] md:h-[calc(100vh-100px)] rounded-[2rem]'
      } ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}
    >
      <div className={`p-4 md:p-5 flex items-center justify-between transition-colors duration-500 ${
        isLiveSession ? 'bg-indigo-900' : (darkMode ? 'bg-slate-800' : (isExamMode ? 'bg-indigo-700' : 'bg-blue-600'))
      } text-white`}>
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all ${
            isLiveSession ? 'bg-indigo-400 animate-pulse shadow-[0_0_20px_rgba(129,140,248,0.5)]' : (isExamMode ? 'bg-amber-400 text-amber-900 rotate-[360deg]' : 'bg-white/20 text-white shadow-lg')
          }`}>
            <i className={`fa-solid ${isLiveSession ? 'fa-volume-high' : (isExamMode ? 'fa-stopwatch' : 'fa-robot')} text-xl md:text-2xl`}></i>
          </div>
          <div>
            <h2 className="font-black text-sm md:text-lg leading-tight tracking-tight uppercase truncate max-w-[120px] md:max-w-none">
              {isLiveSession ? (lang === 'hi' ? 'लाइव ट्यूटर' : 'Live Voice Session') : (isExamMode ? t.examMode : t.smartTutor)}
            </h2>
            <p className={`text-[9px] md:text-[10px] mt-0.5 font-bold transition-opacity uppercase tracking-widest ${isExamMode ? 'text-amber-300' : 'opacity-70'}`}>
              {isExamMode ? (examQuestions.length > 0 ? `${t.timeLeft}: ${formatTime(examTimer)}` : t.selectTerm) : (isLiveSession ? t.voiceActive : getLocalizedClassName(selectedClassId))}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 md:space-x-3">
          <button 
            onClick={toggleFullscreen}
            className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all border border-white/10"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'} text-sm`}></i>
          </button>

          <button 
            onClick={onHome}
            className={`flex items-center space-x-2 px-3 md:px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all font-black text-[9px] md:text-[10px] uppercase tracking-widest border border-white/10`}
            title={t.mainMenu}
          >
            <i className="fa-solid fa-house"></i>
            <span className="hidden sm:inline">{t.mainMenu}</span>
          </button>
          
          <button 
            onClick={() => {
              if (isExamMode) {
                if (confirm(lang === 'hi' ? "क्या आप परीक्षा समाप्त करना चाहते हैं?" : "Are you sure you want to end the exam?")) {
                  setIsExamMode(false); setExamResult(null); setExamQuestions([]); localStorage.removeItem(SAVED_EXAM_KEY); setSavedSession(null);
                }
              } else {
                setIsExamMode(true); stopLiveSession(); 
              }
            }}
            className={`px-3 md:px-5 py-2 md:py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all shadow-lg ${
              isExamMode ? 'bg-red-500 hover:bg-red-600' : 'bg-white/20 hover:bg-white/30 border border-white/20'
            }`}
          >
            {isExamMode ? t.endExam : t.examMode}
          </button>
          
          <input type="file" hidden ref={fileInputRef} onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx" />
          <input type="file" hidden ref={cameraInputRef} onChange={handleFileUpload} accept="image/*" capture="environment" />
        </div>
      </div>

      <div ref={scrollRef} className={`flex-1 overflow-y-auto p-3 md:p-8 space-y-6 md:space-y-8 relative scroll-smooth custom-scrollbar ${darkMode ? 'bg-slate-950/50' : 'bg-gray-50/20'}`}>
        {isLiveSession && (
          <div className="absolute inset-x-0 top-0 z-10 p-4 md:p-6 animate-fadeIn">
            <div className={`p-4 md:p-5 rounded-3xl flex items-center justify-between border shadow-2xl backdrop-blur-xl ${darkMode ? 'bg-slate-900/90 border-indigo-500/30' : 'bg-white/90 border-indigo-200'}`}>
              <div className="flex items-center space-x-3 md:space-x-4">
                <div className="flex space-x-1 items-end h-6 md:h-8">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="w-1 md:w.5 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{ height: `${30 + Math.random() * 70}%`, animationDelay: `${i * 150}ms` }}></div>
                  ))}
                </div>
                <span className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] text-indigo-500">{lang === 'hi' ? 'ट्यूटर सुन रहा है...' : 'Tutor is Listening...'}</span>
              </div>
              <button onClick={stopLiveSession} className="w-9 h-9 md:w-10 md:h-10 rounded-2xl bg-red-500 text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all">
                <i className="fa-solid fa-phone-slash"></i>
              </button>
            </div>
          </div>
        )}

        {isExamMode ? (
          <div className="max-w-4xl mx-auto w-full h-full flex flex-col">
            {isExamLoading ? (
              <div className="flex flex-col items-center justify-center flex-1 space-y-6">
                <div className="w-16 h-16 md:w-20 md:h-20 border-8 border-blue-600 border-t-transparent rounded-full animate-spin shadow-xl"></div>
                <p className={`text-sm md:text-lg font-black uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-blue-600 animate-pulse'}`}>{t.examLoading}</p>
              </div>
            ) : examQuestions.length === 0 ? (
              <div className="animate-fadeIn flex flex-col items-center py-6 md:py-8 flex-1">
                {savedSession && (
                  <div className={`w-full max-w-2xl mb-8 md:mb-12 p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border-2 border-dashed transition-all ${
                    darkMode ? 'bg-blue-900/20 border-blue-500/40 text-blue-200' : 'bg-blue-50 border-blue-200 text-blue-800'
                  }`}>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
                      <div className="flex items-center space-x-4 md:space-x-5 text-center md:text-left">
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-xl md:text-2xl shadow-xl animate-bounce">
                          <i className="fa-solid fa-history"></i>
                        </div>
                        <div>
                          <h4 className="font-black text-lg md:text-xl leading-tight">{lang === 'hi' ? 'अधूरी परीक्षा शुरू करें?' : 'Resume Unfinished Exam?'}</h4>
                          <p className="text-[9px] md:text-[10px] opacity-70 font-black uppercase tracking-widest mt-1">{savedSession.selectedSubjectName} • {savedSession.selectedTerm}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 md:space-x-4">
                        <button onClick={resumeExam} className="bg-blue-600 text-white px-6 md:px-8 py-2.5 md:py-3 rounded-2xl font-black text-[10px] md:text-[11px] uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all">
                          {lang === 'hi' ? 'जारी रखें' : 'Resume'}
                        </button>
                        <button onClick={() => { localStorage.removeItem(SAVED_EXAM_KEY); setSavedSession(null); }} className="px-4 md:px-5 py-2.5 md:py-3 rounded-2xl font-black text-[10px] md:text-[11px] uppercase tracking-widest opacity-50 hover:opacity-100 transition-all">
                          {lang === 'hi' ? 'हटाएं' : 'Discard'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-[2rem] md:rounded-[2.5rem] bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-4xl md:text-5xl mb-6 md:mb-10 shadow-2xl rotate-3 transform hover:rotate-0 transition-transform">
                  <i className="fa-solid fa-user-graduate"></i>
                </div>
                <h3 className="text-2xl md:text-4xl font-black mb-8 md:mb-12 text-center tracking-tight">{t.startExam}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 w-full max-w-5xl">
                  <div className="space-y-8 md:space-y-10">
                    <div className="space-y-4 md:space-y-5">
                      <h4 className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.3em] opacity-40 flex items-center"><i className="fa-solid fa-users-viewfinder mr-3 text-blue-500"></i> {t.selectClass}</h4>
                      <div className="grid grid-cols-3 gap-2 md:gap-3">
                        {CLASSES.map(c => (
                          <button key={c.id} onClick={() => setSelectedClassId(c.id)} className={`px-3 md:px-4 py-3 md:py-4 rounded-[1.25rem] md:rounded-[1.5rem] text-[10px] md:text-[11px] font-black border transition-all ${selectedClassId === c.id ? 'bg-blue-600 text-white border-blue-600 shadow-2xl scale-105' : (darkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-white border-gray-200 text-gray-500 hover:shadow-lg')}`}>
                            {getLocalizedClassName(c.id).split(' ')[1] || getLocalizedClassName(c.id)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4 md:space-y-5">
                      <h4 className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.3em] opacity-40 flex items-center"><i className="fa-solid fa-calendar-check mr-3 text-blue-500"></i> {t.selectTerm}</h4>
                      <div className="grid grid-cols-1 gap-2 md:gap-3">
                        {terms.map(term => {
                          if (term.id === 'Madhyamik Selection' && selectedClassId !== 'class-10') return null;
                          return (
                            <button key={term.id} onClick={() => setSelectedTerm(term.id)} className={`w-full text-left p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border transition-all ${selectedTerm === term.id ? 'bg-blue-600 text-white border-blue-600 shadow-2xl scale-[1.02]' : (darkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-white border-gray-200 text-gray-500 hover:shadow-xl')}`}>
                              <span className="font-black text-sm md:text-base tracking-tight">{term.label}</span>
                              <p className={`text-[9px] md:text-[10px] mt-1 md:mt-2 font-bold uppercase tracking-widest ${selectedTerm === term.id ? 'text-blue-100 opacity-70' : 'opacity-40'}`}>{term.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4 md:space-y-5">
                    <h4 className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.3em] opacity-40 flex items-center"><i className="fa-solid fa-book mr-3 text-blue-500"></i> {t.examSubject}</h4>
                    <div className="grid grid-cols-1 gap-3 md:gap-4">
                      {currentClass.subjects.map(sub => (
                        <button key={sub.id} onClick={() => startExam(getLocalizedSubjectName(sub.id, sub.name), getLocalizedClassName(currentClass.id))} className={`group flex items-center justify-between p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border transition-all ${darkMode ? 'bg-slate-900 border-slate-800 hover:border-blue-500 hover:bg-slate-800' : 'bg-white border-gray-100 hover:shadow-2xl hover:scale-[1.02]'}`}>
                          <div className="flex items-center space-x-4 md:space-x-6">
                            <div className={`w-10 h-10 md:w-14 md:h-14 ${sub.color} rounded-2xl flex items-center justify-center text-white shadow-2xl group-hover:rotate-12 transition-all`}>
                              <i className={`fa-solid ${sub.icon} text-xl md:text-2xl`}></i>
                            </div>
                            <span className="font-black text-base md:text-lg tracking-tight">{getLocalizedSubjectName(sub.id, sub.name)}</span>
                          </div>
                          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner"><i className="fa-solid fa-play text-[10px] md:text-xs ml-0.5"></i></div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : examResult ? (
              <div className="animate-fadeIn space-y-8 md:space-y-10 pb-16 flex-1">
                <div className={`rounded-[2rem] md:rounded-[3rem] p-8 md:p-20 text-center shadow-2xl relative overflow-hidden ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-gray-100'}`}>
                  <div className="absolute top-0 left-0 w-full h-2 md:h-3 bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-600"></div>
                  <div className={`w-24 h-24 md:w-40 md:h-40 mx-auto rounded-full flex items-center justify-center text-4xl md:text-7xl mb-6 md:mb-10 shadow-2xl ${examResult.score >= examResult.total / 2 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}><i className={`fa-solid ${examResult.score >= examResult.total / 2 ? 'fa-medal' : 'fa-brain'}`}></i></div>
                  <h3 className="text-3xl md:text-5xl font-black mb-4 tracking-tighter uppercase">{t.examResult}</h3>
                  <div className="text-5xl md:text-8xl font-black text-blue-600 tabular-nums leading-none mb-6">{examResult.score}<span className="text-2xl md:text-4xl opacity-20 mx-2 md:mx-4">/</span>{examResult.total}</div>
                  <p className="text-lg md:text-2xl font-bold opacity-80 mb-8 md:mb-12 tracking-tight">{examResult.feedback}</p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-6">
                    <button onClick={() => { setExamQuestions([]); setExamResult(null); }} className="w-full sm:w-auto bg-blue-600 text-white px-8 md:px-14 py-4 md:py-5 rounded-[2.5rem] font-black uppercase tracking-[0.2em] text-[10px] md:text-xs hover:bg-blue-700 shadow-[0_20px_40px_-10px_rgba(37,99,235,0.5)] transition-all hover:-translate-y-1 active:scale-95">
                      <i className="fa-solid fa-rotate-left mr-3"></i> {lang === 'hi' ? 'फिर से अभ्यास करें' : 'Practice Again'}
                    </button>
                    <button onClick={() => { setIsExamMode(false); setExamResult(null); setExamQuestions([]); }} className={`w-full sm:w-auto px-8 md:px-14 py-4 md:py-5 rounded-[2.5rem] font-black uppercase tracking-[0.2em] text-[10px] md:text-xs border-2 transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'}`}>{t.back}</button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-6 md:gap-8">
                  {examResult.detailedResults.map((res, i) => (
                    <div key={i} className={`p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border transition-all ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100 shadow-xl'}`}>
                      <div className="flex items-start justify-between mb-6 md:mb-8">
                        <span className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center text-xs md:text-sm font-black shadow-inner">#{i+1}</span>
                        <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-[0.1em] md:tracking-[0.2em] px-4 md:px-6 py-1.5 md:py-2.5 rounded-full border shadow-sm ${res.isCorrect ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : 'text-red-500 bg-red-500/10 border-red-500/20'}`}><i className={`fa-solid ${res.isCorrect ? 'fa-check' : 'fa-xmark'} mr-2 md:mr-3`}></i> {res.isCorrect ? 'Correct' : 'Incorrect'}</span>
                      </div>
                      <p className="font-black text-lg md:text-2xl mb-6 md:mb-10 leading-tight tracking-tight">{res.question}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 text-sm mb-6 md:mb-10">
                        <div className={`p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border-2 ${res.isCorrect ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}><span className="opacity-40 block text-[9px] md:text-[10px] font-black uppercase mb-2 md:mb-3 tracking-widest">Student Choice</span><span className={`font-black text-base md:text-lg ${res.isCorrect ? 'text-emerald-500' : 'text-red-500'}`}>{res.userAnswer}</span></div>
                        <div className={`p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border-2 border-emerald-500/20 bg-emerald-500/10 shadow-inner`}><span className="opacity-40 block text-[9px] md:text-[10px] font-black uppercase mb-2 md:mb-3 tracking-widest text-emerald-600">Correct Answer</span><span className="text-emerald-600 font-black text-base md:text-lg">{res.correctAnswer}</span></div>
                      </div>
                      <div className={`p-4 md:p-6 rounded-2xl md:rounded-3xl ${darkMode ? 'bg-slate-800/50' : 'bg-gray-50'} border border-current/5`}>
                         <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">Explanation</p>
                         <p className="text-xs md:text-sm font-medium leading-relaxed opacity-80">{res.explanation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col flex-1 space-y-6 md:space-y-8 pb-10">
                <div className={`flex flex-wrap items-center justify-between gap-4 p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] border shadow-2xl ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
                  <div className="flex items-center space-x-3 md:space-x-4"><div className="px-4 md:px-6 py-2 md:py-2.5 rounded-xl md:rounded-2xl bg-blue-600 text-white font-black text-[10px] md:text-[11px] uppercase tracking-[0.2em] shadow-lg">{selectedSubjectName}</div></div>
                  <div className="flex items-center space-x-6 md:space-x-10">
                    <div className="flex items-center space-x-3 md:space-x-4"><div className="text-right"><span className="block text-[9px] md:text-[10px] font-black uppercase opacity-40 tracking-widest">Time Remaining</span><span className={`block font-black text-2xl md:text-3xl tabular-nums ${examTimer < 60 ? 'text-red-500 animate-pulse' : 'text-amber-500'}`}>{formatTime(examTimer)}</span></div></div>
                    <div className="text-center w-px h-8 md:h-10 bg-current opacity-10"></div>
                    <div className="text-center"><span className="block text-[9px] md:text-[10px] font-black uppercase opacity-40 tracking-widest">Progress</span><span className="block font-black text-xl md:text-2xl tracking-tighter">{currentExamIndex + 1}<span className="opacity-20 mx-1 md:mx-2">/</span>{examQuestions.length}</span></div>
                  </div>
                </div>
                <div className={`p-6 md:p-20 rounded-[2.5rem] md:rounded-[3.5rem] border shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] flex-1 relative overflow-hidden flex flex-col justify-center ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
                   <div className="absolute top-0 left-0 w-full h-1 md:h-2 bg-gray-100 dark:bg-slate-800">
                     <div className="h-full bg-blue-600 transition-all duration-700 ease-out shadow-[0_0_15px_rgba(37,99,235,0.5)]" style={{ width: `${((currentExamIndex + 1) / examQuestions.length) * 100}%` }}></div>
                   </div>
                   <h3 className="text-xl md:text-5xl font-black mb-10 md:mb-20 leading-[1.1] tracking-tighter text-center max-w-4xl mx-auto">{examQuestions[currentExamIndex].question}</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 max-w-5xl mx-auto w-full">
                     {examQuestions[currentExamIndex].options.map((option, idx) => (
                       <button key={idx} onClick={() => { const newAnswers = [...userAnswers]; newAnswers[currentExamIndex] = idx; setUserAnswers(newAnswers); }} className={`w-full text-left p-6 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border-2 md:border-4 transition-all relative group ${userAnswers[currentExamIndex] === idx ? 'bg-blue-600/10 border-blue-600 shadow-2xl scale-[1.02]' : (darkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500' : 'bg-gray-50 border-white text-gray-700 hover:shadow-2xl hover:scale-[1.02] shadow-sm')}`}>
                         {userAnswers[currentExamIndex] === idx && <div className="absolute -right-2 -top-2 md:-right-3 md:-top-3 w-8 h-8 md:w-10 md:h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-2xl border-2 md:border-4 border-white dark:border-slate-900 animate-fadeIn"><i className="fa-solid fa-check text-xs md:text-sm"></i></div>}
                         <div className="flex items-center space-x-4 md:space-x-6"><div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center font-black text-lg md:text-xl shadow-inner transition-all ${userAnswers[currentExamIndex] === idx ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-500 group-hover:bg-blue-500 group-hover:text-white'}`}>{String.fromCharCode(65 + idx)}</div><span className="text-lg md:text-2xl font-black tracking-tight">{option}</span></div>
                       </button>
                     ))}
                   </div>
                </div>
                <div className="flex items-center justify-between px-2 md:px-4 pb-10">
                  <button disabled={currentExamIndex === 0} onClick={() => setCurrentExamIndex(prev => prev - 1)} className={`px-8 md:px-12 py-4 md:py-6 rounded-2xl md:rounded-[2.5rem] font-black uppercase tracking-[0.1em] md:tracking-[0.2em] text-[10px] md:text-[11px] flex items-center transition-all ${darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-10' : 'bg-white border-2 shadow-xl text-gray-600 hover:bg-gray-50 disabled:opacity-20'}`}><i className="fa-solid fa-arrow-left-long mr-3 md:mr-4"></i> {t.previous}</button>
                  {currentExamIndex === examQuestions.length - 1 ? (
                    <button onClick={handleExamSubmit} className="px-12 md:px-20 py-4 md:py-6 rounded-2xl md:rounded-[2.5rem] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-[10px] md:text-[11px] bg-emerald-600 text-white shadow-[0_20px_50px_-10px_rgba(16,185,129,0.5)] hover:bg-emerald-700 active:scale-95 hover:-translate-y-1 transition-all">{t.submitExam} <i className="fa-solid fa-paper-plane-top ml-3 md:ml-4"></i></button>
                  ) : (
                    <button onClick={() => setCurrentExamIndex(prev => prev + 1)} className="px-10 md:px-16 py-4 md:py-6 rounded-2xl md:rounded-[2.5rem] font-black uppercase tracking-[0.1em] md:tracking-[0.2em] text-[10px] md:text-[11px] bg-blue-600 text-white shadow-[0_20px_50px_-10px_rgba(37,99,235,0.5)] hover:bg-blue-700 active:scale-95 hover:-translate-y-1 transition-all">{t.next} <i className="fa-solid fa-arrow-right-long ml-3 md:mr-4"></i></button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 space-y-6 md:space-y-10 max-w-5xl mx-auto w-full">
            {messages.map((msg, idx) => (
              <div key={msg.id || idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
                <div className={`max-w-[90%] md:max-w-[85%] rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-8 shadow-2xl relative group/msg transition-all ${msg.role === 'user' ? (darkMode ? 'bg-indigo-700 text-white' : 'bg-blue-600 text-white shadow-blue-200/50') + ' rounded-tr-none' : (darkMode ? 'bg-slate-800 text-slate-100 border-slate-700' : 'bg-white text-gray-800 border-gray-100 shadow-gray-200/50') + ' rounded-tl-none border'}`}>
                  {msg.role === 'model' && (
                    <div className="absolute -right-10 md:-right-14 top-0 flex flex-col space-y-2 md:space-y-3 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-300 z-10">
                      {showCopiedId === msg.id && (
                        <div className="absolute -top-10 right-0 text-[9px] md:text-[10px] font-black text-emerald-500 animate-fadeIn whitespace-nowrap bg-emerald-500/10 px-2 md:px-3 py-1 rounded-full">{t.copied}</div>
                      )}
                      
                      <button 
                        onClick={() => handlePlayVoice(msg)}
                        className={`w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-90 shadow-xl ${
                          msg.isSpeaking 
                          ? 'bg-blue-500 text-white animate-pulse' 
                          : (darkMode ? 'bg-slate-800 text-blue-400 hover:bg-slate-700 border border-slate-700' : 'bg-white text-blue-600 border border-gray-100')
                        }`}
                        title={lang === 'hi' ? 'सुनें' : 'Listen'}
                      >
                        {isAnyVoiceLoading === msg.id ? (
                          <i className="fa-solid fa-circle-notch animate-spin text-[10px] md:text-sm"></i>
                        ) : (
                          <i className={`fa-solid ${msg.isSpeaking ? 'fa-stop' : 'fa-volume-up'} text-[10px] md:text-sm`}></i>
                        )}
                      </button>

                      <button 
                        onClick={() => handleShareMessage(msg)}
                        className={`w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-90 shadow-xl ${
                          darkMode ? 'bg-slate-800 text-blue-400 hover:bg-slate-700 border border-slate-700' : 'bg-white text-blue-600 border border-gray-100'
                        }`}
                        title={t.share}
                      >
                        <i className="fa-solid fa-share-nodes text-[10px] md:text-sm"></i>
                      </button>
                      
                      {!/[\u0900-\u097F]/.test(msg.text) && (
                        <button 
                          onClick={() => handleTranslateMessage(msg.id)}
                          disabled={msg.isTranslating}
                          className={`w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-90 shadow-xl ${
                            msg.showTranslated 
                            ? 'bg-emerald-500 text-white' 
                            : (darkMode ? 'bg-slate-800 text-emerald-400 hover:bg-slate-700 border border-slate-700' : 'bg-white text-emerald-600 border border-gray-100')
                          }`}
                          title={t.translateToHindi}
                        >
                          {msg.isTranslating ? (
                            <i className="fa-solid fa-circle-notch animate-spin text-[10px] md:text-sm"></i>
                          ) : (
                            <i className="fa-solid fa-language text-[10px] md:text-sm"></i>
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  <div className={`prose prose-sm md:prose-lg max-w-none prose-p:leading-relaxed prose-p:mb-3 md:prose-p:mb-4 prose-headings:font-black ${msg.text.startsWith('⚠️') ? 'text-red-500 dark:text-red-400' : ''}`}>
                    {(msg.showTranslated && msg.translatedText ? msg.translatedText : msg.text).split('\n').map((line, i) => (
                      <p key={i} className="mb-3 md:mb-4 whitespace-pre-wrap text-inherit font-medium">
                        {line}
                      </p>
                    ))}
                    
                    {msg.imageUrl && (
                      <div className="mt-4 md:mt-8 rounded-[1.5rem] md:rounded-[2rem] overflow-hidden border-2 md:border-4 border-current/10 shadow-2xl group/img">
                        <img src={msg.imageUrl} alt="Diagram" className="w-full h-auto transform transition-transform duration-700 group-hover/img:scale-105" />
                        {msg.role === 'model' && (
                           <button onClick={() => { const link = document.createElement('a'); link.href = msg.imageUrl!; link.download = 'diagram.png'; link.click(); }} className="w-full bg-black/60 py-3 md:py-4 text-[9px] md:text-[11px] font-black uppercase tracking-[0.1em] md:tracking-[0.2em] hover:bg-black/80 transition-all text-white backdrop-blur-md"><i className="fa-solid fa-download mr-2 md:mr-3"></i> {t.downloadDiagram}</button>
                        )}
                      </div>
                    )}
                    
                    {msg.grounding && msg.grounding.length > 0 && (
                      <div className="mt-4 md:mt-8 pt-4 md:pt-8 border-t border-inherit/10">
                        <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] mb-3 md:mb-4 opacity-50">{t.sources}</p>
                        <div className="flex flex-wrap gap-2 md:gap-3">
                          {msg.grounding.map((chunk, i) => chunk.web && (
                            <a key={i} href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className={`text-[9px] md:text-[10px] px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl font-black uppercase tracking-tight md:tracking-widest transition-all flex items-center space-x-2 border ${darkMode ? 'bg-white/5 border-white/10 hover:bg-white/10 text-blue-400' : 'bg-blue-50 border-blue-100 hover:bg-blue-100 text-blue-700'}`}>
                              <i className="fa-solid fa-link text-[8px] opacity-50"></i><span className="truncate max-w-[140px] md:max-w-[180px]">{chunk.web.title || chunk.web.uri}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className={`text-[8px] md:text-[9px] mt-4 md:mt-6 font-black uppercase tracking-widest opacity-30 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {msg.showTranslated && <span className="ml-2 italic">(Translated)</span>}
                  </div>
                </div>
              </div>
            ))}
            {(isLoading || isGeneratingDiagram) && (
              <div className="flex justify-start animate-fadeIn">
                <div className={`rounded-2xl md:rounded-[2rem] p-4 md:p-6 shadow-2xl rounded-tl-none border flex items-center space-x-3 md:space-x-4 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
                  <div className="flex space-x-1.5 md:space-x-2"><div className="w-2 md:w-2.5 h-2 md:h-2.5 bg-blue-500 rounded-full animate-bounce"></div><div className="w-2 md:w-2.5 h-2 md:h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div><div className="w-2 md:w-2.5 h-2 md:h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></div></div>
                  <span className={`text-[10px] md:text-xs font-black uppercase tracking-widest md:tracking-[0.2em] italic ${darkMode ? 'text-slate-500' : 'text-blue-600'}`}>{isGeneratingDiagram ? t.drawing : t.thinking}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={`p-2 sm:p-3 border-t shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
        {!isExamMode ? (
          <div className="max-w-5xl mx-auto w-full">
            <div className="flex items-center space-x-2 overflow-x-auto pb-2 mb-1 no-scrollbar">
              <span className={`text-[8px] font-black uppercase tracking-widest whitespace-nowrap px-1 ${darkMode ? 'text-slate-600' : 'text-gray-400'}`}><i className="fa-solid fa-lightbulb mr-1.5 text-amber-500"></i> {lang === 'hi' ? 'सुझाव:' : 'Try:'}</span>
              {SUGGESTED_DIAGRAMS.map((topic, i) => (
                <button key={i} onClick={() => handleGenerateDiagram(topic[lang])} disabled={isLoading || isGeneratingDiagram} className={`whitespace-nowrap px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:border-blue-500 hover:text-blue-400' : 'bg-white border-gray-200 text-gray-500 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 shadow-sm'} disabled:opacity-20`}>{topic[lang]}</button>
              ))}
            </div>

            {uploadedFile && (
              <div className={`mb-2 p-2 rounded-xl flex items-center justify-between animate-fadeIn border ${darkMode ? 'bg-slate-800/50 border-slate-700 shadow-inner' : 'bg-blue-50 border-blue-100 shadow-inner'}`}>
                <div className="flex items-center space-x-2 overflow-hidden">
                   {uploadedFile.mimeType.startsWith('image/') ? (
                      <img src={uploadedFile.data} alt="Preview" className="w-8 h-8 rounded-lg object-cover shadow-lg border border-white dark:border-slate-800" />
                   ) : (
                      <div className="w-8 h-8 rounded-lg bg-blue-200 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 shadow-inner"><i className="fa-solid fa-file-lines text-sm"></i></div>
                   )}
                   <div className="min-w-0">
                      <span className="text-[9px] block truncate font-black uppercase tracking-tight text-blue-700 dark:text-blue-400">{uploadedFile.name}</span>
                   </div>
                </div>
                <button onClick={() => setUploadedFile(null)} className="w-6 h-6 rounded-full flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all"><i className="fa-solid fa-circle-xmark text-sm"></i></button>
              </div>
            )}
            
            <div className="flex items-center space-x-1.5">
              <button 
                onClick={startLiveSession}
                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-500 shadow-md ${
                  isLiveSession ? 'bg-red-500 text-white animate-pulse scale-105 shadow-red-500/50' : (darkMode ? 'bg-slate-800 text-blue-400 hover:bg-slate-700 border border-slate-700' : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100')
                }`}
                title={lang === 'hi' ? 'आवाज से बात करें' : 'Talk with Voice'}
              >
                <i className={`fa-solid ${isLiveSession ? 'fa-phone-slash' : 'fa-microphone'} text-base`}></i>
              </button>
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isLiveSession}
                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all shadow-md ${
                  darkMode ? 'bg-slate-800 text-blue-400 hover:bg-slate-700 border border-slate-700' : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100'
                } disabled:opacity-20`}
                title={t.uploadButton}
              >
                <i className="fa-solid fa-paperclip text-base"></i>
              </button>
              
              <div className="flex-1 relative group">
                <input 
                  type="text" 
                  placeholder={isLiveSession ? (lang === 'hi' ? 'बोलिए...' : 'Say something...') : t.diagramPrompt}
                  className={`w-full pl-4 pr-10 py-2 border-none rounded-xl shadow-inner transition-all outline-none font-medium text-xs md:text-sm ${darkMode ? 'bg-slate-800 text-slate-100' : 'bg-gray-100 text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20'}`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  disabled={isLiveSession}
                />
                <button onClick={() => handleSend()} disabled={isLoading || isLiveSession || (!input.trim() && !uploadedFile)} className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded-lg shadow-md hover:scale-105 active:scale-95 disabled:opacity-10 transition-all"><i className="fa-solid fa-paper-plane text-[10px]"></i></button>
              </div>
              
              <button onClick={() => handleGenerateDiagram()} disabled={!input.trim() || isGeneratingDiagram || isLiveSession} className={`w-10 h-10 flex flex-col items-center justify-center rounded-xl transition-all shadow-sm ${darkMode ? 'bg-slate-800 text-emerald-400 hover:bg-slate-700 border border-slate-700' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100'} disabled:opacity-10`}>
                <i className="fa-solid fa-chart-line text-sm"></i><span className="text-[6px] font-black mt-0.5 uppercase tracking-tighter">{t.draw}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-2"><p className="text-[9px] text-gray-400 font-black uppercase tracking-[0.3em] flex items-center justify-center"><i className="fa-solid fa-shield-halved mr-2 text-blue-500 text-sm animate-pulse"></i> AI Practice Active</p></div>
        )}
        <div className="mt-2 text-center"><p className="text-[8px] text-gray-400 font-black uppercase tracking-widest opacity-40">{t.voiceActive}</p></div>
      </div>
    </div>
  );
};

export default SmartTutor;