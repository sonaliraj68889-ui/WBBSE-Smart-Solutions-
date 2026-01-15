
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SamplePaper, ExamTerm } from "../types";

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 1): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const status = error?.status || error?.error?.status;
      if (status !== 429 && status < 500) break;
      const delay = 500 + Math.random() * 500; // Faster retry for "fast" feel
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

// Fixed: Initializing strictly as per guidelines
const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const SAMPLE_PAPER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    subject: { type: Type.STRING },
    classLabel: { type: Type.STRING },
    term: { type: Type.STRING },
    fullMarks: { type: Type.NUMBER },
    timeAllowed: { type: Type.STRING },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          instructions: { type: Type.STRING },
          passage: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                text: { type: Type.STRING },
                marks: { type: Type.NUMBER },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                answer: { type: Type.STRING }
              },
              required: ["id", "text", "marks", "answer"]
            }
          }
        },
        required: ["title", "instructions", "questions"]
      }
    }
  },
  required: ["title", "subject", "classLabel", "term", "fullMarks", "timeAllowed", "sections"]
};

// FLASH-FIRST Strategy for all tutoring tasks
export const solveProblem = async (problem: string, context?: string, fileData?: { data: string, mimeType: string }) => {
  return withRetry(async () => {
    const ai = getAIClient();
    const model = 'gemini-3-flash-preview'; // Switched to Flash for speed
    const contents = fileData 
      ? { parts: [{ inlineData: { data: fileData.data.split(',')[1], mimeType: fileData.mimeType } }, { text: problem }] }
      : problem;

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: `Expert WBBSE Hindi Medium Tutor. Solve fast. Use Hindi/English. No Bengali. Use Google Search for real-time facts if needed.`,
        tools: [{ googleSearch: {} }]
      },
    });
    return {
      text: response.text || "Solution unavailable.",
      grounding: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  });
};

export const generateSamplePaper = async (subject: string, classLabel: string, term: ExamTerm): Promise<SamplePaper> => {
  const isEnglish = subject.toLowerCase().includes('english');
  const isMadhyamik = classLabel.includes('10');
  const marks = isMadhyamik ? 90 : (term === 'Summative 3' ? 70 : 40);
  const time = isMadhyamik ? "3 Hours 15 Minutes" : (term === 'Summative 3' ? "2 Hours 30 Minutes" : "1 Hour 30 Minutes");

  const prompt = `Generate an authentic WBBSE Sample Paper JSON. 
  Subject: ${subject}, Class: ${classLabel}, Term: ${term}, Full Marks: ${marks}, Time: ${time}. 
  Language: ${isEnglish ? 'English' : 'Hindi'}. NO BENGALI. 
  Follow WBBSE patterns strictly. Ensure valid JSON response.`;

  // Strategy: Direct Flash for 5x faster generation
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: SAMPLE_PAPER_SCHEMA,
      temperature: 0.1
    }
  });
  return JSON.parse(response.text || "{}");
};

export const summarizeChapter = async (title: string, sub: string, len: string, id?: string) => {
  const ai = getAIClient();
  const res = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Summarize WBBSE Hindi chapter: ${title} (${sub}). Detail: ${len}. No Bengali.`,
    config: { thinkingConfig: { thinkingBudget: 0 } } // Disable thinking for max speed
  });
  return res.text || "";
};

export const translateContent = async (text: string, lang: string) => {
  const ai = getAIClient();
  const res = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Translate to ${lang}: ${text}`,
    config: { thinkingConfig: { thinkingBudget: 0 } }
  });
  return res.text || text;
};

export const generateSpeech = async (text: string, voice: string = 'Kore') => {
  const ai = getAIClient();
  const res = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } }
  });
  return res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
};

export const generateDiagram = async (topic: string) => {
  const ai = getAIClient();
  const res = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: `Diagram for school: ${topic}. Clean labels. White background.` }] }
  });
  const part = res.candidates?.[0]?.content.parts.find(p => p.inlineData);
  return part ? `data:image/png;base64,${part.inlineData.data}` : null;
};

export const fetchChapterQuestions = async (title: string, sub: string, sum: string, id: string) => {
  const ai = getAIClient();
  const res = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `5 Board-style Q&A for WBBSE chapter: ${title}. JSON format.`,
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(res.text || "[]");
};

export const fetchExamQuestions = async (sub: string, level: string, term: ExamTerm) => {
  const ai = getAIClient();
  const res = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `5 MCQs for WBBSE ${sub} Class ${level} ${term}. JSON.`,
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(res.text || "[]");
};
