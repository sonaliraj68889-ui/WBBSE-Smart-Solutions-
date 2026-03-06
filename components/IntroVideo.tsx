import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { translations } from '../translations.ts';

interface IntroVideoProps {
  darkMode: boolean;
  lang: 'en' | 'hi';
  onClose: () => void;
}

const loadingMessages = [
  "Initializing video generation engine...",
  "Writing the script for the WBBSE Smart Solutions app...",
  "Designing the visual elements and scenes...",
  "Rendering the video frames (this may take a few minutes)...",
  "Adding the final touches to the video...",
  "Almost there, finalizing the video...",
];

const IntroVideo: React.FC<IntroVideoProps> = ({ darkMode, lang, onClose }) => {
  const t = translations[lang];
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      interval = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % loadingMessages.length);
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleGenerateVideo = async () => {
    try {
      setIsGenerating(true);
      setError(null);

      // Check for API key
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await (window as any).aistudio.openSelectKey();
        // Assume successful selection
      }

      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("API key is missing.");
      }

      const ai = new GoogleGenAI({ apiKey });

      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: 'A high-quality, engaging promotional video for an educational app called "WBBSE Smart Solutions". The app helps students with WBBSE board exams, featuring smart tutoring, sample papers, and offline notes. Show a modern, sleek interface with students learning happily.',
        config: {
          numberOfVideos: 1,
          resolution: '1080p',
          aspectRatio: '16:9'
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) {
        throw new Error("Failed to get video URL from the response.");
      }

      const response = await fetch(downloadLink, {
        method: 'GET',
        headers: {
          'x-goog-api-key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch the video file.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);

    } catch (err: any) {
      console.error("Video generation error:", err);
      if (err.message?.includes("Requested entity was not found")) {
        setError("API key error. Please select a valid paid Google Cloud project API key.");
        // Reset key selection state if needed
        await (window as any).aistudio.openSelectKey();
      } else {
        setError(err.message || "An error occurred while generating the video.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className={`relative w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl ${darkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>

        <div className="p-8 md:p-12">
          <h2 className={`text-3xl font-black mb-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            WBBSE Smart Solutions Intro
          </h2>

          {!videoUrl && !isGenerating && !error && (
            <div className="text-center py-12">
              <div className="w-24 h-24 mx-auto bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-4xl mb-6">
                <i className="fa-solid fa-film"></i>
              </div>
              <p className={`text-lg mb-8 max-w-lg mx-auto ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>
                Generate a stunning, AI-powered promotional video for the app using Google's Veo model. This process takes a few minutes.
              </p>
              <button 
                onClick={handleGenerateVideo}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/30 transition-all hover:scale-105 active:scale-95 flex items-center mx-auto space-x-3"
              >
                <i className="fa-solid fa-wand-magic-sparkles"></i>
                <span>Generate Video</span>
              </button>
            </div>
          )}

          {isGenerating && (
            <div className="text-center py-16 space-y-8">
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-blue-600 text-2xl">
                  <i className="fa-solid fa-video"></i>
                </div>
              </div>
              <div>
                <h3 className={`text-xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Generating Masterpiece...
                </h3>
                <p className={`text-sm font-medium animate-pulse ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  {loadingMessages[loadingMessageIndex]}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto bg-red-100 text-red-600 rounded-full flex items-center justify-center text-3xl mb-4">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <h3 className="text-xl font-bold text-red-600 mb-2">Generation Failed</h3>
              <p className={`text-sm mb-6 ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>{error}</p>
              <button 
                onClick={handleGenerateVideo}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-3 rounded-xl font-bold transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {videoUrl && (
            <div className="rounded-2xl overflow-hidden bg-black aspect-video shadow-inner">
              <video 
                src={videoUrl} 
                controls 
                autoPlay 
                className="w-full h-full object-contain"
              >
                Your browser does not support the video tag.
              </video>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IntroVideo;
