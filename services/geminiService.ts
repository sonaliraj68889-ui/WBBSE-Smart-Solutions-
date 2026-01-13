import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SamplePaper, ExamTerm } from "../types";

/**
 * Utility for exponential backoff retries.
 * Retries on 429 (Rate Limit) and 5xx (Server Errors).
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const status = error?.status || error?.error?.status;
      const isRetryable = status === 429 || (status >= 500 && status <= 599);
      
      if (!isRetryable || i === maxRetries - 1) break;
      
      const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY environment variable is not defined.");
  }
  return new GoogleGenAI({ apiKey });
};

export const solveProblem = async (problem: string, context?: string, fileData?: { data: string, mimeType: string }) => {
  return withRetry(async () => {
    const ai = getAIClient();
    const systemInstruction = `
      You are an expert WBBSE (West Bengal Board of Secondary Education) tutor specializing in Hindi Medium education. 
      Your goal is to provide clear, step-by-step solutions to student queries for Classes 5-10.
      Respond strictly in Hindi or English. NO BENGALI.
      Context: ${context || 'General WBBSE Hindi Medium Curriculum'}
    `;

    const parts: any[] = [{ text: problem }];
    if (fileData) {
      parts.push({
        inlineData: {
          data: fileData.data.split(',')[1],
          mimeType: fileData.mimeType
        }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts },
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
        temperature: 0.7,
      },
    });

    return {
      text: response.text || "क्षमस्व, मैं अभी समाधान उत्पन्न नहीं कर सका।",
      grounding: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  });
};

export const summarizeChapter = async (chapterTitle: string, subjectName: string, length: 'short' | 'medium' | 'long' = 'medium', subjectId?: string) => {
  return withRetry(async () => {
    const ai = getAIClient();
    const lengthPrompt = {
      short: "a very brief 1-paragraph summary with 3 key takeaway bullet points.",
      medium: "a standard summary with main concepts, definitions, and 5-7 bullet points.",
      long: "a comprehensive detailed summary with sub-headings, full explanations of concepts, and extensive bullet points for study notes."
    }[length];

    const isEnglishSubject = subjectId === 'english';
    const languageTarget = isEnglishSubject ? "English" : "Hindi";

    const prompt = `Summarize the WBBSE textbook chapter: "${chapterTitle}" in the subject "${subjectName}" for Hindi Medium students.
    
    Provide ${lengthPrompt}
    
    Strict Rules:
    - Language: Strictly ${languageTarget}.
    - NO BENGALI.
    - Focus on WBBSE exam-relevant points.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: `You are a specialized WBBSE Hindi Medium academic content curator. You generate summaries in ${languageTarget}.`,
        temperature: 0.3,
      }
    });
    return response.text || "सारांश तैयार करने में विफल।";
  });
};

export const translateContent = async (text: string, targetLang: 'Hindi' | 'English') => {
  return withRetry(async () => {
    const ai = getAIClient();
    const prompt = `Translate the following text for a WBBSE student into ${targetLang}. Text: ${text}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "You are a professional translator for WBBSE board students. NO BENGALI.",
        temperature: 0.2,
      }
    });
    return response.text || text;
  });
};

export const generateSpeech = async (text: string, voiceName: string = 'Kore') => {
  return withRetry(async () => {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  });
};

export const generateDiagram = async (topic: string) => {
  return withRetry(async () => {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `Professional educational labeled scientific diagram for WBBSE school students: ${topic}. Hindi and English labels. NO BENGALI.` }]
      }
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  });
};

export const fetchChapterQuestions = async (chapterTitle: string, subjectName: string, summary: string, subjectId: string) => {
  return withRetry(async () => {
    const ai = getAIClient();
    const langRule = subjectId === 'english' ? "Strictly English" : "Strictly Hindi";
    const prompt = `Based on the following chapter summary for WBBSE, generate 5 descriptive practice questions AND their detailed model answers.
    Chapter: ${chapterTitle}
    Subject: ${subjectName}
    Summary: ${summary}
    Instructions: Language: ${langRule}. NO BENGALI.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              answer: { type: Type.STRING }
            },
            required: ["question", "answer"]
          }
        }
      }
    });
    return JSON.parse(response.text || "[]") as { question: string, answer: string }[];
  });
};

export const fetchExamQuestions = async (subject: string, level: string, term: ExamTerm = 'Summative 3') => {
  return withRetry(async () => {
    const ai = getAIClient();
    const prompt = `Generate 5 conceptual multiple choice questions (MCQs) for WBBSE students in Hindi medium. Subject: ${subject}, Class: ${level}, Term: ${term}. Strictly Hindi. NO BENGALI.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.NUMBER },
              explanation: { type: Type.STRING }
            },
            required: ["question", "options", "correctAnswer", "explanation"]
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  });
};

export const generateSamplePaper = async (subject: string, classLabel: string, term: ExamTerm): Promise<SamplePaper> => {
  return withRetry(async () => {
    const ai = getAIClient();
    const isEnglish = subject.toLowerCase().includes('english');

    // WBBSE Specific Marking Logic
    const isMadhyamik = classLabel.includes('10');
    const marks = isMadhyamik ? 90 : (term === 'Summative 3' ? 70 : 40);
    const time = isMadhyamik ? "3 Hours 15 Minutes" : (term === 'Summative 3' ? "2 Hours 30 Minutes" : "1 Hour 30 Minutes");

    const englishPattern = isEnglish ? `
      For English (Second Language), follow this official WBBSE pattern:
      1. Section A (Reading Comprehension - Seen): Use Google Search to find an authentic excerpt from a WBBSE Class ${classLabel} textbook (e.g., 'Bliss'). Marks: 20.
      2. Section A (Reading Comprehension - Unseen): Find a realistic news report or contemporary passage. Marks: 20.
      3. Section B (Grammar and Vocabulary): Focus on voice change, narration, and phrasal verbs. Marks: 20.
      4. Section C (Writing): Paragraph, Informal Letter, or Notice. Marks: 30.
    ` : `Use Google Search to find current WBBSE Class ${classLabel} syllabus topics for ${subject}. Maintain authentic board question types (MCQ, VSA, Short, Long).`;

    const prompt = `Generate an authentic WBBSE (West Bengal Board) Sample Question Paper.
    Subject: ${subject}
    Class: ${classLabel}
    Term: ${term}
    Full Marks: ${marks}
    Time Allowed: ${time}
    
    Instructions:
    - Language: Primary Hindi (except English papers). Strictly NO BENGALI.
    - Content: Must be conceptual and board-standard.
    ${englishPattern}
    
    The output must be a valid JSON object.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
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
    return JSON.parse(response.text || "{}") as SamplePaper;
  });
};