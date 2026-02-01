
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SamplePaper, ExamTerm } from "../types.ts";

export type ApiErrorCode = 'QUOTA_EXCEEDED' | 'SAFETY_BLOCKED' | 'SERVER_ERROR' | 'UNKNOWN';

export class ApiError extends Error {
  constructor(public message: string, public code: ApiErrorCode, public originalError?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorStr = error?.message || error?.toString() || "";
      const status = error?.status || error?.error?.status;
      
      console.error(`[API Attempt ${i + 1} Failed]:`, {
        status,
        message: errorStr,
        details: error
      });

      // Handle Quota
      if (status === 429 || errorStr.includes('429') || errorStr.includes('quota')) {
        if (i === maxRetries - 1) throw new ApiError("Daily usage limit reached.", "QUOTA_EXCEEDED", error);
        const delay = 2000 * Math.pow(2, i) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Handle Server Errors
      if (status >= 500 || errorStr.includes('500')) {
        if (i === maxRetries - 1) throw new ApiError("AI service is currently busy.", "SERVER_ERROR", error);
        const delay = 1000 * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Handle Safety Blocks (Immediate failure, no retry)
      if (errorStr.includes('safety') || errorStr.includes('blocked') || errorStr.includes('candidate')) {
         throw new ApiError("Content blocked by safety filters.", "SAFETY_BLOCKED", error);
      }
      
      // Other unrecoverable errors
      break;
    }
  }
  
  throw new ApiError(lastError?.message || "An unexpected error occurred", "UNKNOWN", lastError);
}

const getAIClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const MATH_NOTATION_RULE = `MATH NOTATION: Mathematical expressions MUST be presented in plain text format. DO NOT use any LaTeX delimiters (e.g., NO $$, NO $, NO \\frac, NO \\sqrt, NO \\left, NO \\right, NO \\cdot, NO \\div, NO ^). Use standard text-based representations:
- Exponents: x^2 (for x squared), x^3 (for x cubed).
- Fractions: numerator/denominator (e.g., 1/2, (a+b)/c). Use parentheses for clarity in complex denominators/numerators.
- Square Roots: sqrt(x) (e.g., sqrt(4), sqrt(x+y)).
- Other operations: Use * for multiplication and / for division.
- Equations and Inequalities: Use standard operators like =, <, >.
Ensure clarity for all steps in plain text.`;

export const solveProblem = async (problem: string, context?: string, fileData?: { data: string, mimeType: string }) => {
  return withRetry(async () => {
    const ai = getAIClient();
    const contents = fileData 
      ? { parts: [{ inlineData: { data: fileData.data.split(',')[1], mimeType: fileData.mimeType } }, { text: problem }] }
      : problem;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents,
      config: {
        systemInstruction: `You are an expert WBBSE Hindi Medium Math Tutor for Class 5-10. Your task is to provide detailed, step-by-step solutions to mathematical problems, strictly adhering to the WBBSE examination format.
**Format:**
1. Start by restating the problem clearly.
2. List 'Given:' details.
3. Provide 'To Find:' (if applicable).
4. Outline the 'Solution:' in logical, numbered steps.
5. Each step must be clearly explained.
6. Mathematical expressions should be presented clearly.
7. Conclude with 'Final Answer:'.
**Language:** Use a mix of Hindi and English as is common in WBBSE Hindi Medium. NO BENGALI.
**Accuracy:** Ensure all calculations are accurate and logical.
${MATH_NOTATION_RULE}`,
        tools: [{ googleSearch: {} }],
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingBudget: 1024 } 
      },
    });
    return {
      text: response.text || "Solution unavailable.",
      grounding: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  });
};

export const summarizeChapter = async (title: string, sub: string, len: string, id?: string) => {
  return withRetry(async () => {
    const ai = getAIClient();
    const isEnglish = id === 'english' || sub.toLowerCase().includes('english');
    const targetLang = isEnglish ? 'English' : 'Hindi';
    
    const res = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: `Provide a ${len} comprehensive board-standard solution for WBBSE chapter: "${title}" in ${sub}. Language: ${targetLang}. NO BENGALI. ${MATH_NOTATION_RULE}`,
      config: {
        maxOutputTokens: 4096, 
      }
    });
    return res.text || "";
  });
};

export const fetchChapterQuestions = async (title: string, sub: string, sum: string, id: string) => {
  return withRetry(async () => {
    const ai = getAIClient();
    const isEnglish = id === 'english';
    const targetLang = isEnglish ? 'English' : 'Hindi';
    
    const res = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: `Generate 5 important WBBSE Q&A for: ${title} (${sub}). Language: ${targetLang}. NO BENGALI. Return JSON array with "question" and "answer" properties. Ensure all mathematical expressions in questions and answers follow: ${MATH_NOTATION_RULE}`,
      config: { 
        responseMimeType: "application/json",
        maxOutputTokens: 4096, 
      }
    });
    return JSON.parse(res.text || "[]");
  });
};

export const generateSamplePaper = async (subject: string, classLabel: string, term: ExamTerm): Promise<SamplePaper> => {
  return withRetry(async () => {
    const isEnglish = subject.toLowerCase().includes('english');
    const isMadhyamik = classLabel.includes('10');
    
    let marks = 40;
    let time = "1 Hour 30 Minutes";

    if (term === 'Summative 3') {
      marks = isMadhyamik ? 90 : 70;
      time = isMadhyamik ? "3 Hours 15 Minutes" : "2 Hours 30 Minutes";
    } else if (term === 'Madhyamik Selection') {
      marks = 90;
      time = "3 Hours 15 Minutes";
    }

    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: `Generate a WBBSE Sample Paper JSON. Subject: ${subject}, Class: ${classLabel}, Term: ${term}, Full Marks: ${marks}, Time: ${time}. Language: ${isEnglish ? 'English' : 'Hindi'}. NO BENGALI. No negative marking. Ensure all mathematical expressions in questions and answers follow: ${MATH_NOTATION_RULE}`,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192, 
        thinkingConfig: { thinkingBudget: 2048 }, 
        responseSchema: {
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
        }
      }
    });
    return JSON.parse(response.text || "{}");
  });
};

export const translateContent = async (text: string, lang: string) => {
  return withRetry(async () => {
    const ai = getAIClient();
    const res = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: `Translate to ${lang}: ${text}`,
      config: {
        maxOutputTokens: 2000, 
      }
    });
    return res.text || text;
  });
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
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { 
        parts: [{ 
          text: `Highly detailed, scientifically accurate academic diagram of "${topic}" for a school textbook. The illustration must be clear and realistic with precise anatomical or structural details. Professional scientific illustration style on a clean background.` 
        }] 
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });
    
    for (const part of res.candidates?.[0]?.content.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error: any) {
    throw error;
  }
};

export const fetchExamQuestions = async (sub: string, level: string, term: ExamTerm) => {
  return withRetry(async () => {
    const ai = getAIClient();
    const isEnglish = sub.toLowerCase().includes('english');
    const targetLang = isEnglish ? 'English' : 'Hindi';
    const res = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: `Generate 5 MCQs for WBBSE ${sub} Class ${level} ${term}. Language: ${targetLang}. NO BENGALI. Return JSON array. Ensure all mathematical expressions in questions and answers follow: ${MATH_NOTATION_RULE}`,
      config: { 
        responseMimeType: "application/json",
        maxOutputTokens: 2048, 
      }
    });
    return JSON.parse(res.text || "[]");
  });
};
