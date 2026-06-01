
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SamplePaper, ExamTerm, ExamQuestion } from "../types.ts";
import { CLASSES } from "../constants.ts";

export type ApiErrorCode = 'QUOTA_EXCEEDED' | 'SAFETY_BLOCKED' | 'SERVER_ERROR' | 'INVALID_KEY' | 'UNKNOWN' | 'NETWORK_ERROR' | 'PARSE_ERROR';

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

      // If error is already ApiError, handle accordingly
      if (error instanceof ApiError) {
         if (error.code === 'INVALID_KEY' || error.code === 'SAFETY_BLOCKED' || error.code === 'QUOTA_EXCEEDED') {
            throw error; // Don't retry fatal errors
         }
      }

      const errorStr = error?.message || error?.toString() || "";
      const status = error?.status || error?.error?.status;
      
      console.error(`[API Attempt ${i + 1} Failed]:`, {
        status,
        message: errorStr,
        details: error
      });

      // Handle Quota
      if (status === 429 || errorStr.includes('429') || errorStr.includes('quota') || errorStr.includes('exhausted')) {
        if (i === maxRetries - 1) throw new ApiError("Daily usage limit reached.", "QUOTA_EXCEEDED", error);
        const delay = 2000 * Math.pow(2, i) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Handle Invalid Key
      if (status === 400 || status === 401 || status === 403 || errorStr.includes('400') || errorStr.includes('401') || errorStr.includes('403') || errorStr.includes('API key')) {
         throw new ApiError("Invalid or missing API Key.", "INVALID_KEY", error);
      }
      
      // Handle Server Errors
      if (status >= 500 || errorStr.includes('500') || errorStr.includes('503') || errorStr.includes('504') || errorStr.includes('overloaded') || errorStr.includes('404') || errorStr.includes('408') || errorStr.includes('413') || errorStr.includes('422')) {
        if (i === maxRetries - 1) throw new ApiError("AI service is currently busy.", "SERVER_ERROR", error);
        const delay = 1000 * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Handle Safety Blocks (Immediate failure, no retry)
      if (errorStr.includes('safety') || errorStr.includes('blocked') || errorStr.includes('candidate')) {
         throw new ApiError("Content blocked by safety filters.", "SAFETY_BLOCKED", error);
      }

      // Handle Network and Parsing Errors (Retryable)
      if (errorStr.includes('Failed to fetch') || errorStr.includes('fetch failed') || errorStr.includes('NetworkError') || errorStr.includes('AbortError') || errorStr.includes('TimeoutError') || errorStr.includes('timeout') || errorStr.includes('network') || errorStr.includes('connection') || errorStr.includes('Failed to parse') || errorStr.includes('Invalid sample paper') || errorStr.includes('JSON')) {
        if (i === maxRetries - 1) {
           if (errorStr.includes('Failed to fetch') || errorStr.includes('fetch failed') || errorStr.includes('NetworkError') || errorStr.includes('AbortError') || errorStr.includes('TimeoutError') || errorStr.includes('timeout') || errorStr.includes('network') || errorStr.includes('connection')) {
              throw new ApiError("Network error. Please check your connection.", "NETWORK_ERROR", error);
           } else {
              throw new ApiError("Failed to parse AI response.", "PARSE_ERROR", error);
           }
        }
        const delay = 1000 * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Other unrecoverable errors
      if (i === maxRetries - 1) {
        throw new ApiError(errorStr || "An unexpected error occurred", "UNKNOWN", error);
      }
      const delay = 1000 * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new ApiError(lastError?.message || "An unexpected error occurred", "UNKNOWN", lastError);
}

export const getAIClient = () => {
  let apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || localStorage.getItem('user_provided_api_key');
  if (!apiKey && typeof process !== 'undefined' && process.env) {
    apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  }
  if (!apiKey) {
    throw new ApiError("API Key is missing. Please set VITE_GEMINI_API_KEY in your environment variables or provide it in the app settings.", "INVALID_KEY");
  }
  return new GoogleGenAI({ apiKey: apiKey });
};

const MATH_NOTATION_RULE = `
**CRITICAL: MATHEMATICAL NOTATION RULES**
- Use plain text for simple expressions (e.g., x² + y² = z²). DO NOT use caret (^) for superscripts.
- Use Unicode characters for common symbols (e.g., √, π, θ, ±, ×, ÷, ≤, ≥, ≠).
- For fractions, use the slash symbol (e.g., 1/2, (x+1)/(x-1)).
- For subscripts, use Unicode subscript characters (e.g., H₂O, CO₂, aₙ). DO NOT use underscores for subscripts.
- For complex formulas, write them out clearly in plain text.
- **DO NOT** use LaTeX notation (e.g., \\frac, \\sqrt, $...$, $$...$$).
- **DO NOT** use MathML or any other markup language.
- Ensure all mathematical expressions are easily readable without a math renderer.
`;

const parseJSONResponse = (text: string | undefined, defaultVal: any = {}) => {
  if (!text) return defaultVal;
  try {
    // Try parsing directly first
    return JSON.parse(text);
  } catch (e) {
    // If it fails, try to extract JSON from markdown code blocks
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      try {
        return JSON.parse(match[1]);
      } catch (e2) {
        // Ignore and fall through
      }
    }
    // If still failing, try to find the first { or [ and last } or ]
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    
    let jsonStr = text;
    if (firstBrace !== -1 && lastBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      jsonStr = text.substring(firstBrace, lastBrace + 1);
    } else if (firstBracket !== -1 && lastBracket !== -1) {
      jsonStr = text.substring(firstBracket, lastBracket + 1);
    }
    
    try {
      return JSON.parse(jsonStr);
    } catch (e3) {
      console.error("Failed to parse JSON response:", text.substring(0, 100) + "...");
      throw new Error("Failed to parse AI response as JSON.");
    }
  }
};

export const solveProblem = async (problem: string, context?: string, fileData?: { data: string, mimeType: string }[], history?: { role: 'user' | 'model', parts: any[] }[]) => {
  return withRetry(async () => {
    const ai = getAIClient();
    
    let contents: any[] = [];
    if (history && history.length > 0) {
      contents = [...history];
    }
    
    const currentParts: any[] = [];
    if (fileData && fileData.length > 0) {
      for (const file of fileData) {
        currentParts.push({ inlineData: { data: file.data.split(',')[1] || file.data, mimeType: file.mimeType } });
      }
    }
    currentParts.push({ text: problem });
    
    contents.push({ role: 'user', parts: currentParts });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents,
      config: {
        systemInstruction: `You are an expert WBBSE (West Bengal Board of Secondary Education) Tutor for Class 5 to 10.
Your task is to provide detailed, step-by-step solutions and explanations to the user's query for ANY subject and ANY topic within the WBBSE Class 5-10 curriculum.

**Guidelines:**
1. **Identify the Subject & Topic:** Automatically detect the subject (Math, Science, History, Geography, English, Hindi, etc.) and the likely academic level (Class 5-10).
2. **Bilingual Support:** You MUST be able to answer in both **Hindi** and **English**.
   - If the user asks in Hindi, respond in Hindi (or Hinglish).
   - If the user asks in English, respond in English.
   - If the user asks for a specific language, strictly follow it.
3. **Step-by-Step Solutions:** For problems (Math, Physics, etc.), provide logical, numbered steps.
4. **Clear Explanations:** Explain concepts clearly, suitable for school students.
5. **Formatting:** Use Markdown for structure (bold, lists, etc.).
6. **Math Notation:**
${MATH_NOTATION_RULE}
7. **Scope:** Your primary focus is WBBSE Class 5-10, but you can answer general academic questions related to these levels.
`,
        tools: [{ googleSearch: {} }],
        maxOutputTokens: 4096,
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
    const isHindi = id === 'hindi' || sub.toLowerCase().includes('hindi');
    const targetLang = isEnglish ? 'English' : isHindi ? 'strictly Hindi (Devanagari script)' : 'Hindi';
    
    const res = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: `Provide a ${len} comprehensive board-standard solution for WBBSE chapter: "${title}" in ${sub}. Language: ${targetLang}. NO BENGALI. ${isHindi ? 'DO NOT use any English words or Roman script.' : ''} Focus on key concepts and logical explanations. ${MATH_NOTATION_RULE}`,
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
    const isEnglish = id === 'english' || sub.toLowerCase().includes('english');
    const isHindi = id === 'hindi' || sub.toLowerCase().includes('hindi');
    const targetLang = isEnglish ? 'English' : isHindi ? 'strictly Hindi (Devanagari script)' : 'Hindi';
    
    const res = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: `Generate 5 important WBBSE Q&A for: ${title} (${sub}). Language: ${targetLang}. NO BENGALI. ${isHindi ? 'DO NOT use any English words or Roman script.' : ''} Return JSON array with "question" and "answer" properties. Ensure all mathematical expressions in questions and answers follow: ${MATH_NOTATION_RULE}`,
      config: { 
        responseMimeType: "application/json",
        maxOutputTokens: 4096, 
      }
    });
    return parseJSONResponse(res.text, []);
  });
};

export const generateSamplePaper = async (subjectId: string, subjectName: string, classLabel: string, classId: string, term: ExamTerm): Promise<SamplePaper> => {
  return withRetry(async () => {
    const ai = getAIClient();
    const subjectLower = subjectId.toLowerCase();
    const isMadhyamik = classId === 'class-10' || classLabel.includes('10');
    const isClass9 = classId === 'class-9' || classLabel.includes('9');
    const isClass5678 = ['class-5', 'class-6', 'class-7', 'class-8'].includes(classId) || !!classLabel.match(/[5-8]/);
    const isEnglish = subjectLower.includes('english');
    
    let marks = 40;
    let time = "1 Hour 30 Minutes";
    let syllabusTopics = "";

    if (isClass5678) {
      if (term === 'Summative 1') { marks = 30; time = "1 Hour"; }
      else if (term === 'Summative 2') { marks = 50; time = "1 Hour 30 Minutes"; }
      else { marks = 70; time = "2 Hours 30 Minutes"; }
    } else if (isMadhyamik) {
      if (term === 'Summative 1') { marks = 40; time = "1 Hour 30 Minutes"; }
      else if (term === 'Summative 2') { marks = 40; time = "1 Hour 30 Minutes"; }
      else { marks = 90; time = "3 Hours 15 Minutes"; }
    } else if (isClass9) {
      if (term === 'Summative 1') { marks = 40; time = "1 Hour 30 Minutes"; }
      else if (term === 'Summative 2') { marks = 40; time = "1 Hour 30 Minutes"; }
      else { marks = 90; time = "3 Hours 15 Minutes"; }
    }

    // --- SYLLABUS MAPPING FOR SUMMATIVE 1 & 2 (Based on WBBSE 2026 Images) ---
    if (isClass9) {
      if (term === 'Summative 1') {
         if (subjectLower.includes('math')) {
            syllabusTopics = `
            1. वास्तविक संख्या (Real Numbers)
            2. घातांक के नियम (Laws of Indices)
            3. लेखाचित्र (Graph)
            4. स्थानांक ज्यामिति: दूरी निकालने का सूत्र (Coordinate Geometry: Distance Formula)
            5. सरल युगपत समीकरण (Linear Simultaneous Equations)
            6. समांतर चतुर्भुज के गुण (Properties of Parallelogram)
            7. बहुपदी व्यंजक (Polynomials)
            `;
         } else if (subjectLower.includes('physci') || subjectLower.includes('physical')) {
            syllabusTopics = `
            1. मापन (Measurement)
            2. बल एवं गति (Force and Motion)
            3. परमाणु संरचना (Atomic Structure)
            `;
         } else if (subjectLower.includes('english')) {
            syllabusTopics = `
            Lesson -- Chapter 1 to 4
            Grammar -- Textual Grammar, Article and Preposition, Voice change, Forms of Verbs, Sentences -- Simple, Compound, Complex.
            Writing Skill -- Dialogue Writing, Story Writing, Process Writing, Biography Writing.
            `;
         } else if (subjectLower.includes('hindi')) {
            syllabusTopics = `
            1.) पद्य: विनय के पद, धीरे-धीरे उत्तर क्षितिज से
            2.) गद्य: स्त्री शिक्षा के विरोधी कुतर्कों का खण्डन, हिंसा परमो धर्म
            3.) सहायक पाठ: गुरुनानक, आचार्य जगदीश चन्द्र बोस
            4.) व्याकरण: उच्चारण स्थान के आधार पर ध्वनियों का वर्गीकरण, ध्वनि तथा परिवर्तन के कारण, ध्वनि परिवर्तन के रीतियों, दिशाएँ, संधि
            5.) रचना - भावार्थ
            `;
         }
      } else if (term === 'Summative 2') {
         if (subjectLower.includes('math')) {
            syllabusTopics = `
            8) गुणनखंड करना (Factorisation)
            9. तिर्यक और मध्य बिन्दु युक्त प्रमेय (Transversal and Mid-Point Theorem)
            10. लाभ और हानि (Profit and Loss)
            11. सांख्यिकी (Statistics)
            12. क्षेत्रफल वाले प्रमेय (Theorems on Area)
            13. निर्मेय (Construction)
            14. निर्मेय- एक चतुर्भुज के क्षेत्रफल के बराबर त्रिभुज का निर्माण (Construction of a triangle equal in area to a quadrilateral)
            15. त्रिभुज और चतुर्भुज की परिसीमा (Perimeter and Area of Triangle and Quadrilateral)
            `;
         } else if (subjectLower.includes('physci') || subjectLower.includes('physical')) {
            syllabusTopics = `
            1. मोल धरना (Mole Concept)
            2. पदार्थ गठन तथा अनु (Matter, Structure and Properties)
            3. घोल (Solution)
            4. अम्ल क्षार और लवण (Acids, Bases and Salts)
            5. कार्य शक्ति तथा ऊर्जा (Work, Power and Energy)
            `;
         } else if (subjectLower.includes('english')) {
            syllabusTopics = `
            Lesson -- Chapter 5 to 8
            Grammar -- Textual Grammar, Transformation of Sentences, Adverb, Phrasal Verb, Clauses.
            Writing Skill -- Report Writing, Summary Writing, Story Writing, Letter Writing (Formal), Paragraph Writing.
            `;
         } else if (subjectLower.includes('hindi')) {
            syllabusTopics = `
            1.) पद्य: पेड़ का दर्द, जरूरतों के नाम पर
            2.) गद्य: संस्कृति है क्या, ठेले पर हिमालय
            3) सहायक पाठक: गोपाल कृष्ण गोखले, लाला लाजपत राय
            4) व्याकरण: व्युत्पत्ति के आधार पर शब्दों का वर्गीकरण, उपसर्ग, प्रत्यय, शब्द एवं पद विचार, संज्ञा
            5.) निबंध - विभिन्न विषयों पर
            `;
         }
      } else if (term === 'Summative 3') {
         if (subjectLower.includes('math')) {
            syllabusTopics = `
            16.) वृत्त की परिधि (Circumference of Circle)
            17) संगामी रेखाओं वाले प्रमेय (Theorems on Concurrence)
            18) वृत्त का क्षेत्रफल (Area of Circle)
            19) स्थानांक ज्यामिति : सरल रेखा खंड का आंतरिक और वहीं विभाजन (Coordinate Geometry: Internal and External Division of Straight Line Segment)
            20) स्थानांक ज्यामिति : त्रिभुजाकृति क्षेत्र का क्षेत्रफल (Coordinate Geometry: Area of Triangular Region)
            21) Logarithm.
            NOTE:- 3rd Summative Evaluation में 1st Summative एव 2nd summative के सारे Chapter को जोड़ा जाएगा।
            `;
         } else if (subjectLower.includes('physci') || subjectLower.includes('physical')) {
            syllabusTopics = `
            1. ध्वनि (Sound)
            2. ऊष्मा (Heat)
            3. मिजीवों के अवयबो का पृथक करना (Separation of Components of Mixtures)
            4. जल (Water).
            Note : जो विषय प्रथम तथा द्वितीय परीक्षा में दिया गया है तृतीय परीक्षा में भी शामिल है
            `;
         } else if (subjectLower.includes('english')) {
            syllabusTopics = `
            Lesson -- chapter 9 to 12 (Whole Book).
            Grammar -- Same as 1st Unit Test and 2nd Unit Test.
            Writing Skill -- Same as 1st Unit Test and 2nd Unit Test.
            `;
         } else if (subjectLower.includes('hindi')) {
            syllabusTopics = `
            1.) पद्य: कलकत्ता, सबसे खतरनाक, यमराज की दिशा, कर चले हम फिदा
            2.) गद्य: भोलाराम का जीव, वापसी, पर्यावरण संरक्षण, गिरगिट
            3.) एकांकी: बहु की विदा
            4.) सहायक पाठ: डॉ. राजेन्द्र प्रसाद, मौलाना अबुल कलाम आजाद
            5.) व्याकरण: सर्वनाम, विशेषण, क्रिया, अव्यय
            6.) रचना: निबंध (विभिन्न विषयों पर)
            (नोट: वार्षिक परीक्षा में प्रथम एवं द्वितीय पर्यायक्रमिक जाँच के सभी पाठ सम्मिलित हैं।)
            `;
         }
      }
    } else if (isMadhyamik) {
      if (term === 'Summative 1') {
         if (subjectLower.includes('math')) {
            syllabusTopics = `
            1. एक चर वाले द्विघात समीकरण (Quadratic Equation with one variable)
            2. सरल ब्याज (Simple Interest)
            3. वृत्त से संबंधित प्रमेय (Theorem related to circle)
            4. आयताकार समांतर षट्फलक या घनाभ (Rectangular Parallelopiped as Cuboid)
            5. अनुपात और समानुपात (Ratio and proportion)
            6. चक्रवृद्धि ब्याज और समान वृद्धि या ह्रास दर (Compound interest and uniform rate of increase and decrease)
            7. वृत्तस्थ कोण संबंधित प्रमेय (Theorems related to angle in a circle)
            8. लंब वृत्ताकार बेलन (Right circular cylinder)
            9. द्विघात करणी (Quadratic Surd)
            10. चक्रीय चतुर्भुज संबंधित प्रमेय (Theorems related to cyclic Quadrilateral)
            `;
         } else if (subjectLower.includes('physci') || subjectLower.includes('physical')) {
            syllabusTopics = `
            1. Concerns about our environment (हमारे पर्यावरण के प्रति अभिरुचियां)
            2. Behaviour of Gases (गैसों का आचरण)
            3. Light (प्रकाश)
            4. Periodic Table and Periodicity of the properties of elements (तत्वों के गुण धर्मों की आवर्तनी - आवर्त सारणी)
            5. Ionic and co-valent Bonding (आयनिक तथा सहसंयोजक बंधन)
            `;
         } else if (subjectLower.includes('lifesci') || subjectLower.includes('life')) {
            syllabusTopics = `
            1. Control and Co-ordination in living organism (जीव जगत में नियंत्रण एवं समन्वय)
            2. Continuity of life: Cell division and Cell cycle (जीवन की निरंतरता: कोशिका विभाजन और कोशिका चक्र)
            `;
         } else if (subjectLower.includes('hist')) {
            syllabusTopics = `
            1. Ideas of History (इतिहास की अवधारणा)
            2. Reform: Characteristics and Observations (सुधार: विशेषताएँ और अवलोकन)
            3. Resistance and Rebellion: Characteristics and Analyses (प्रतिरोध और आंदोलन: विशेषताएँ एवं निरीक्षण)
            `;
         } else if (subjectLower.includes('geo')) {
            syllabusTopics = `
            1. Exogenetic processes and resultant landforms (बहिर्जात प्रक्रिया और उससे बनने वाली स्थलाकृतियाँ)
            2. India: Introduction, Physical environment (भारत: परिचय, प्राकृतिक परिवेश)
            `;
         } else if (subjectLower.includes('english')) {
            syllabusTopics = `
            1. Father's Help
            2. Fable
            3. The Passing Away of Bapu
            Grammar: Textual Grammar, Correct forms of verbs, Articles and Prepositions, Phrasal verbs.
            Writing: Informal Letter, Paragraph, Biography.
            `;
         } else if (subjectLower.includes('hindi')) {
            syllabusTopics = `
            पद्य खण्ड: रैदास के पद, नीड़ का निर्माण फिर-फिर, आत्मत्राण, मनुष्य और सर्प.
            गद्य खण्ड: धूमकेतु, उसने कहा था, नन्हा संगीतकार.
            सहायक पाठ: तीसरी कसम.
            एकांकी: दीपदान.
            व्याकरण: कारक, समास, अंग्रेजी से हिन्दी अनुवाद.
            रचना: निबंध : विभिन्न विषयों पर.
            `;
         }
      } else if (term === 'Summative 2') {
         if (subjectLower.includes('math')) {
            syllabusTopics = `
            11. एक चर वाले द्विघात समीकरण (Quadratic equation in one variable)
            12. रचना: त्रिभुज के परिवृत्त और अंतर्वृत्त की रचना (Construction: Construction of circum circle and incircle of a triangle)
            13. गोलक (Sphere)
            14. भेद (Variation)
            15. साझा व्यापार (Partnership Business)
            16. वृत्त की स्पर्श रेखा संबंधित प्रमेय (Theorems related to tangent to a circle)
            17. लंब वृत्ताकार शंकु (Right circular cone)
            18. सदृशता (Similarity)
            `;
         } else if (subjectLower.includes('physci') || subjectLower.includes('physical')) {
            syllabusTopics = `
            1. Chemical Calculations (रासायनिक गणनाएं)
            2. Thermal Phenomena (ऊष्मीय घटना)
            3. Current Electricity (विद्युत धारा)
            4. Electricity and Chemical Reactions (विद्युत एवं रासायनिक अभिक्रिया)
            5. Inorganic chemistry in the laboratory and in Industry (प्रयोगशाला एवं उद्योग में अ कार्बनिक रसायन)
            6. Metallurgy (धातु कर्म)
            `;
         } else if (subjectLower.includes('lifesci') || subjectLower.includes('life')) {
            syllabusTopics = `
            1. Continuity of life: Reproduction, Sexual Reproduction in Flowering Plants, Growth and Development (जीवन की निरंतरता: जनन, पौधों में वृद्धि और विकास)
            2. Heredity and some common genetic diseases (आनुवंशिकता और कुछ सामान्य आनुवंशिक रोग)
            3. Evolution and Adaptation (अभिव्यक्ति और अनुकूलन)
            `;
         } else if (subjectLower.includes('hist')) {
            syllabusTopics = `
            4. Early stages of collective action: Characteristics and Analyses (सामूहिक कार्य का प्रथम चरण: विशेषताएं एवं विश्लेषण)
            5. Alternative Ideas and Initiatives (From Mid 19th Century to the Early 20th Century): Characteristics and Analyses (वैकल्पिक विचार एवं प्रयास: 19 बी शताब्दी के मध्य से 20 बी शताब्दी के प्रारंभ तक)
            6. Peasant, Working class and Leftist movements in 20th Century India: Characteristics and Analyses (20 बी शताब्दी के कृषक, श्रमिक वर्ग एवं वामपंथी आंदोलन: विशेषताएं एवं निरीक्षण)
            `;
         } else if (subjectLower.includes('geo')) {
            syllabusTopics = `
            1. Atmosphere (वायुमण्डल)
            2. Hydrosphere (जलमंडल)
            3. India: Economic Geography (Agriculture, Industry, Population, Transport, Communication) (भारत: आर्थिक परिवेश - कृषि, उद्योग, जनसंख्या, परिवहन)
            `;
         } else if (subjectLower.includes('english')) {
            syllabusTopics = `
            4. My Own True Family
            5. Our Runaway Kite
            6. Sea Fever
            7. The Cat
            8. The Snail
            Grammar: Textual Grammar, Transformation of Sentences, Voice Change, Narration.
            Writing: Newspaper Report, Notice, Summary.
            `;
         } else if (subjectLower.includes('hindi')) {
            syllabusTopics = `
            पद्य खण्ड: रामदास, नौरंगिया, देश-प्रेम.
            गद्य खण्ड: नौबत खाने में इबादत, चप्पल, नमक, धावक.
            सहायक पाठ: कर्मनाशा की हार, जाँच अभी जारी है.
            व्याकरण: वाक्य, वाच्य, प्रतिवेदन रचना, संवाद लेखन.
            रचना: निबंध : विभिन्न विषयों पर.
            `;
         }
      }
    } else {
      // For non-Madhyamik classes, extract syllabus from constants.ts
      const classData = CLASSES.find(c => c.id === classId);
      if (classData) {
        const subjectData = classData.subjects.find(s => s.id === subjectLower);
        if (subjectData && subjectData.chapters) {
          let selectedChapters: typeof subjectData.chapters = [];

          if (subjectLower.includes('hindi') && isMadhyamik) {
             if (term === 'Summative 1') {
               const s1Ids = [
                 '10-h-p1', '10-h-p2', '10-h-p3', '10-h-p4', // पद्य: रैदास, आत्मत्राण, नीड़, मनुष्य और सर्प
                 '10-h-g1', '10-h-s1', '10-h-s2', // गद्य: धूमकेतु, उसने कहा था, नन्हा संगीतकार
                 '10-h-sup1', // सहायक पाठ: तीसरी कसम
                 '10-h-e1', // एकांकी: दीपदान
                 '10-h-v1', '10-h-v2', '10-h-w2', // व्याकरण: कारक, समास, अंग्रेजी से हिन्दी अनुवाद
                 '10-h-w1' // निबंध
               ];
               selectedChapters = subjectData.chapters.filter(ch => s1Ids.includes(ch.id));
             } else if (term === 'Summative 2') {
               const s2Ids = [
                 '10-h-p5', '10-h-p6', '10-h-p7', // पद्य: रामदास, नौरंगिया, देश-प्रेम
                 '10-h-g2', '10-h-s3', '10-h-s4', '10-h-s5', // गद्य: नौबत खाने में इबादत, चप्पल, नमक, धावक
                 '10-h-sup2', '10-h-sup3', // सहायक पाठ: कर्मनाशा की हार, जाँच अभी जारी है
                 '10-h-v3', '10-h-v4', '10-h-w3', '10-h-w4', // व्याकरण: वाक्य, वाच्य, प्रतिवेदन रचना, संवाद लेखन
                 '10-h-w1' // निबंध
               ];
               selectedChapters = subjectData.chapters.filter(ch => s2Ids.includes(ch.id));
             } else {
               selectedChapters = subjectData.chapters;
             }
          } else if (subjectLower.includes('hindi')) {
            // Group Hindi chapters by prefix for class 9 etc
            const groups: Record<string, typeof subjectData.chapters> = {};
            const noPrefixGroup: typeof subjectData.chapters = [];
            
            subjectData.chapters.forEach(ch => {
              const match = ch.title.match(/^([^:]+):/);
              if (match) {
                const prefix = match[1];
                if (!groups[prefix]) groups[prefix] = [];
                groups[prefix].push(ch);
              } else {
                noPrefixGroup.push(ch);
              }
            });

            const getSlice = (arr: any[]) => {
              const len = arr.length;
              let start = 0;
              let end = len;
              if (term === 'Summative 1') {
                end = Math.ceil(len / 3);
              } else if (term === 'Summative 2') {
                start = Math.ceil(len / 3);
                end = Math.ceil((len * 2) / 3);
              }
              return arr.slice(start, end);
            };

            Object.values(groups).forEach(group => {
              selectedChapters.push(...getSlice(group));
            });
            selectedChapters.push(...getSlice(noPrefixGroup));
          } else {
            // Standard slicing for other subjects
            const totalChapters = subjectData.chapters.length;
            let startIdx = 0;
            let endIdx = totalChapters;
            
            if (term === 'Summative 1') {
              endIdx = Math.ceil(totalChapters / 3);
            } else if (term === 'Summative 2') {
              startIdx = Math.ceil(totalChapters / 3);
              endIdx = Math.ceil((totalChapters * 2) / 3);
            }
            
            selectedChapters = subjectData.chapters.slice(startIdx, endIdx);
          }
          
          syllabusTopics = selectedChapters.map((ch, idx) => `${idx + 1}. ${ch.title}`).join('\n');
        }
      }
    }

    let promptInstructions = "";
    
    if (isClass5678) {
        let structureText = "";
        if (marks === 30) {
            structureText = `
            1. **Group A (MCQ):** 5 questions (1 mark each).
            2. **Group B (VSA):** 5 questions (1 mark each) (Fill blanks, True/False, one word).
            3. **Group C (Short Answer):** 5 questions (2 marks each).
            4. **Group D (Long Answer):** 2 questions (5 marks each).
            `;
        } else if (marks === 50) {
            structureText = `
            1. **Group A (MCQ):** 10 questions (1 mark each).
            2. **Group B (VSA):** 10 questions (1 mark each) (Fill blanks, True/False, one word).
            3. **Group C (Short Answer):** 5 questions (2 marks each).
            4. **Group D (Long Answer):** 4 questions (5 marks each).
            `;
        } else {
            structureText = `
            1. **Group A (MCQ):** 14 questions (1 mark each).
            2. **Group B (VSA):** 16 questions (1 mark each) (Fill blanks, True/False, one word).
            3. **Group C (Short Answer):** 10 questions (2 marks each).
            4. **Group D (Long Answer):** 4 questions (5 marks each).
            `;
        }

        promptInstructions = `
        **STRICT WBBSE CLASS ${classLabel} ${subjectName.toUpperCase()} PATTERN**
        Structure the 'sections' array appropriately for Class ${classLabel} ${term} examination.
        Total Marks: ${marks}.
        Ensure questions are strictly from the Class ${classLabel} syllabus for ${subjectName}.
        Do NOT include any Class 9, 10 or Madhyamik level questions.
        
        **OFFICIAL CLASS ${classLabel} ${subjectName.toUpperCase()} SYLLABUS CHAPTERS TO USE FOR THIS TERM:**
        ${syllabusTopics}
        
        Ensure ALL questions are derived strictly from these chapters.
        
        **STRUCTURE:**
        ${structureText}
        `;
        
        if (subjectLower.includes('hindi')) {
            promptInstructions += `
            
            **CRITICAL FOR HINDI:** You MUST use the official WBBSE Hindi syllabus for Class ${classLabel}.
            DO NOT use Class 9 or 10 chapters like 'Raidas ke pad', 'Dhumketu', 'Tisari Kasam', 'Ramdas', 'Naurangiya', 'Naubat khane mein ibadat', etc.
            Use age-appropriate chapters, poems, and grammar specifically meant for Class ${classLabel} Hindi students.
            Make sure to include questions from all sections present in the syllabus for this term (e.g., पद्य खण्ड/काव्य-खण्ड, गद्य खण्ड/गद्य-खण्ड, एकांकी, सहायक पाठ, व्याकरण).
            
            **CRITICAL LANGUAGE INSTRUCTION:** The ENTIRE JSON output (including section titles, question text, options, and answers) MUST be in Hindi (Devanagari script). DO NOT use any English words or Roman script.
            `;
        }
    } else {
        // --- FULL SYLLABUS LOGIC (Summative 3 / Selection / Madhyamik) ---
        if (term === 'Summative 3' || term === 'Madhyamik Selection' || (isMadhyamik && term !== 'Summative 1' && term !== 'Summative 2')) {
            if (subjectLower.includes('math')) {
          promptInstructions = `
          **STRICT WBBSE CLASS ${classLabel} MATHEMATICS (2026 ORIGINAL PAPER PATTERN)**
          Generate a paper strictly following this structure (Total 90 Marks):
          1. **Q1. MCQ:** 6 compulsory questions (1 mark each).
          2. **Q2. Fill in the blanks:** 5 questions to answer out of 6 provided (1 mark each).
          3. **Q3. True/False:** 5 questions to answer out of 6 provided (1 mark each).
          4. **Q4. Short Answer (SA):** 10 questions to answer out of 12 provided (2 marks each).
          5. **Q5. Arithmetic:** 1 question to answer out of 2 (5 marks). (Topics: Simple/Compound Interest, Partnership).
          6. **Q6. Algebra (Quadratic Equations etc):** 1 question to answer out of 2 (3 marks).
          7. **Q7. Surds/Variation:** 1 question to answer out of 2 (3 marks).
          8. **Q8. Ratio & Proportion:** 1 question to answer out of 2 (3 marks).
          9. **Q9. Geometry (Theorems):** 1 question to answer out of 2 (5 marks).
          10. **Q10. Geometry (Rider/Application):** 1 question to answer out of 2 (3 marks).
          11. **Q11. Construction:** 1 question to answer out of 2 (5 marks). (e.g., Incircle, Circumcircle).
          12. **Q12. Trigonometry:** 2 questions to answer out of 3 (3 marks each).
          13. **Q13. Heights & Distances:** 1 question to answer out of 2 (5 marks).
          14. **Q14. Mensuration:** 2 questions to answer out of 3 (4 marks each).
          15. **Q15. Statistics:** 2 questions to answer out of 3 (4 marks each). (Mean, Median, Ogive, Mode).
          `;
        } else if (subjectLower.includes('english')) {
          promptInstructions = `
          **STRICT WBBSE CLASS ${classLabel} ENGLISH (SECOND LANGUAGE) (2027 ORIGINAL PAPER PATTERN & VVI QUESTIONS)**
          Generate highly probable, "Very Very Important" (VVI) questions based on the last 5 years' WBBSE original question paper trends. This is targeted for the upcoming 2027 Madhyamik Exam.
          **JSON STRUCTURE:** Create separate 'sections' array items for Prose, Poetry, Unseen, Grammar, and Writing to ensure passage text is near questions.
          
          **STRUCTURE (Total 90 Marks):**
          
          **Section 1: Reading Comprehension (Seen) - Prose (12 Marks)**
          - title: "Section A: Reading Comprehension (Seen) - Prose"
          - passage: [Generate a SUBSTANTIAL Prose passage from highly probable chapters for 2027 like Father's Help, The Passing Away of Bapu, Our Runaway Kite, etc.]
          - questions: 
             - 5 MCQs (1 mark). Options: "(a) ...", "(b) ...".
             - 3 Complete the sentences (1 mark).
             - 2 True/False with Supporting Statement (2 marks).
          
          **Section 2: Reading Comprehension (Seen) - Poetry (8 Marks)**
          - title: "Section A: Reading Comprehension (Seen) - Poetry"
          - passage: [Generate a FULL Poem/Stanza from highly probable chapters for 2027 like Fable, My Own True Family, Sea Fever, The Snail, etc.]
          - questions: 
             - 4 MCQs (1 mark). Options: "(a) ...", "(b) ...".
             - 2 SAQs (2 marks).
             
          **Section 3: Reading Comprehension (Unseen) (20 Marks)**
          - title: "Section B: Reading Comprehension (Unseen)"
          - passage: [Generate a news report or article on a recent relevant topic, similar to WBBSE standard]
          - questions: 6 MCQs, 3 True/False w/ Support, 4 SAQs.
          
          **Section 4: Grammar and Vocabulary (20 Marks)**
          - title: "Section B: Grammar and Vocabulary"
          - questions: Verb Forms (3 marks), Articles/Prepositions (3 marks), Do as Directed (3 marks - including Voice Change, Narration Change, Clause/Sentence transformation), Phrasal Verbs (3 marks), Vocabulary (Find 4 words from Unseen Passage) (8 marks).
          
          **Section 5: Writing (30 Marks)**
          - title: "Section C: Writing Skills"
          - questions: 3 questions (10 marks each). Choose highly important topics for 2027 from: Paragraph Writing, Notice Writing, Editorial Letter, Personal Letter, Story Writing, Biography, Newspaper Report, or Process Writing. Include detailed hints/points for each writing task as seen in original WBBSE papers.
          `;
        } else if (subjectLower.includes('history')) {
          promptInstructions = `
          **STRICT WBBSE CLASS ${classLabel} HISTORY (2026 ORIGINAL PAPER PATTERN)**
          Structure the 'sections' array exactly as follows (Total 90 Marks):
          1. **Group A (MCQ):** 20 compulsory questions (1x20=20).
          2. **Group B (VSA) (16 Marks):** Answer 16 out of 20 (taking at least one from each sub-group).
             - Sub-group 2.1: Answer in one sentence (4 qs).
             - Sub-group 2.2: True or False (4 qs).
             - Sub-group 2.3: Match Column A with B (4 items).
             - Sub-group 2.4: Map Pointing (4 items).
             - Sub-group 2.5: Statement & Interpretation (4 qs).
          3. **Group C (Short Answer - 2 Marks):** Answer 11 questions out of 16 (2x11=22).
          4. **Group D (Analytical - 4 Marks):** Answer 6 questions out of 8 (4x6=24).
          5. **Group E (Essay - 8 Marks):** Answer 1 question out of 3 (8x1=8).
          `;
        } else if (subjectLower.includes('geography')) {
          promptInstructions = `
          **STRICT WBBSE CLASS ${classLabel} GEOGRAPHY (2026 ORIGINAL PAPER PATTERN)**
          Structure the 'sections' array exactly as follows (Total 90 Marks):
          1. **Group A (MCQ):** 14 compulsory questions (1x14=14).
          2. **Group B (VSA) (22 Marks):** Answer 22 out of 26.
             - 2.1 True/False (Answer 6).
             - 2.2 Fill in blanks (Answer 6).
             - 2.3 Answer in one or two words (Answer 6).
             - 2.4 Match Columns (4 matches).
          3. **Group C (Short Answer - 2 Marks):** Answer 6 questions out of 12 (2x6=12). (Definitions/Concepts).
          4. **Group D (Explanatory - 3 Marks):** Answer 4 questions out of 8 (3x4=12). (Reasoning/Differences).
          5. **Group E (Long Answer - 5 Marks) (20 Marks):**
             - 5.1 Physical Geography: Answer 2 out of 4 (5x2=10).
             - 5.2 Economic/Regional Geography: Answer 2 out of 4 (5x2=10).
          6. **Group F (Map Pointing):** 10 items on Map of India (1x10=10).
          `;
        } else if (subjectLower.includes('hindi')) {
          promptInstructions = `
          **STRICT WBBSE CLASS ${classLabel} HINDI (FIRST LANGUAGE) (2026 ORIGINAL PAPER PATTERN)**
          Structure the 'sections' array exactly as follows (Total 90 Marks):
          1. **खंड क (बहुविकल्पीय प्रश्न):** 17 अनिवार्य प्रश्न (1x17=17). (व्याकरण और साहित्य मिश्रित).
          2. **खंड ख (अति लघु उत्तरीय प्रश्न):** 19 प्रश्नों के उत्तर दें (1x19=19). (लगभग 20-25 शब्द).
          3. **खंड ग (लघु व्याख्यात्मक प्रश्न - 3 अंक):** 2 प्रश्नों के उत्तर दें (1 गद्य, 1 पद्य) (3x2=6). (अधिकतम 60 शब्द).
          4. **खंड घ (दीर्घ उत्तरीय प्रश्न - साहित्य):** 
             - पद्य खण्ड: 2 में से 1 का उत्तर दें (5 अंक).
             - गद्य खण्ड: 2 में से 1 का उत्तर दें (5 अंक).
             - गद्य खण्ड: 2 में से 1 का उत्तर दें (5 अंक).
             - एकांकी: 2 में से 1 का उत्तर दें (4 अंक).
          5. **खंड ङ (सहायक पाठ - 5 अंक):** 3 में से 2 प्रश्नों के उत्तर दें (5x2=10). (अधिकतम 150 शब्द).
          6. **खंड च (निबंध):** 1 निबंध लिखें (10 अंक). (अधिकतम 300 शब्द).
          7. **खंड छ (अनुवाद):** अंग्रेजी से हिंदी (4 अंक). (एक अंग्रेजी वाक्य दें और हिंदी अनुवाद पूछें).
          8. **खंड ज (प्रतिवेदन/संवाद):** 2 में से 1 प्रश्न का उत्तर दें (5 अंक). (अधिकतम 150 शब्द).
          
          ${isMadhyamik ? `**OFFICIAL CLASS 10 HINDI SYLLABUS CHAPTERS TO USE:**
          - पद्य खण्ड: रैदास के पद, नीड़ का निर्माण फिर-फिर, आत्मत्राण, मनुष्य और सर्प, रामदास, नौरंगिया, देश-प्रेम.
          - गद्य खण्ड: धूमकेतु, उसने कहा था, नन्हा संगीतकार, नौबत खाने में इबादत, चप्पल, नमक, धावक.
          - सहायक पाठ: तीसरी कसम, कर्मनाशा की हार, जाँच अभी जारी है.
          - एकांकी: दीपदान.
          - व्याकरण: कारक, समास, वाक्य, वाच्य.
          - रचना: निबंध, अनुवाद, प्रतिवेदन, संवाद.
          
          Ensure ALL questions are derived strictly from these chapters.` : `**SYLLABUS TO USE:**\n${syllabusTopics}\nEnsure ALL questions are derived strictly from these chapters.`}
          
          **CRITICAL LANGUAGE INSTRUCTION:** The ENTIRE JSON output (including section titles, question text, options, and answers) MUST be in Hindi (Devanagari script). DO NOT use any English words or Roman script, except for the English sentence to be translated in Khand Chha.
          `;
        } else if (subjectLower.includes('life science') || subjectLower.includes('lifesci')) {
            promptInstructions = `
            **STRICT WBBSE CLASS ${classLabel} LIFE SCIENCE (2026 ORIGINAL PAPER PATTERN)**
            Structure the 'sections' array exactly as follows (Total 90 Marks):
            1. **Group A (MCQ):** 15 compulsory questions (1x15=15).
            2. **Group B (VSA) (21 Marks):** Answer 21 out of 26.
               - Fill in the blanks (Answer 5).
               - True/False (Answer 5).
               - Match Columns (Answer 5).
               - Answer in one word/sentence (Answer 6).
            3. **Group C (Short Answer - 2 Marks):** Answer 12 questions out of 17 (2x12=24).
            4. **Group D (Long Answer - 5 Marks):** Answer 6 questions or their alternatives (5x6=30).
               - Marks can be divided as 3+2, 2+3, or 5.
               - Q4.1 must be a Diagram question.
            `;
        } else if (subjectLower.includes('physical science') || subjectLower.includes('physci')) {
            promptInstructions = `
            **STRICT WBBSE CLASS ${classLabel} PHYSICAL SCIENCE (2026 ORIGINAL PAPER PATTERN)**
            Structure the 'sections' array exactly as follows (Total 90 Marks):
            1. **Group A (MCQ):** 15 compulsory questions (1x15=15).
            2. **Group B (VSA) (21 Marks):** Answer 21 questions.
               - Answer in one word/sentence.
               - True/False.
               - Match Columns.
               - Fill in the blanks.
            3. **Group C (Short Answer - 2 Marks):** Answer 9 questions out of 12 (2x9=18).
            4. **Group D (Long Answer - 3 Marks):** Answer 12 questions (3x12=36).
               - Questions can be split (e.g., 2+1).
               - Includes numerical problems.
            `;
        }
        
        if (isClass9 && syllabusTopics) {
            promptInstructions += `
            
            **OFFICIAL CLASS ${classLabel} SYLLABUS CHAPTERS TO USE:**
            ${syllabusTopics}
            
            Ensure ALL questions are derived strictly from these chapters. Do NOT include Class 10/Madhyamik questions.
            `;
        }
    } else {
        // --- SUMMATIVE 1 & 2 (40 Marks Pattern) ---
        if (subjectLower.includes('english')) {
             promptInstructions = `
             **STRICT WBBSE CLASS ${classLabel} ENGLISH UNIT TEST PATTERN (40 MARKS)**
             **SYLLABUS:** ${syllabusTopics}
             
             **JSON STRUCTURE INSTRUCTIONS:**
             You must generate separate objects in the 'sections' array for Prose and Poetry so that the text appears right above its questions.
             
             **Section 1: Reading Comprehension (Seen) - Prose (5 Marks)**
             - title: "Section A: Reading Comprehension (Seen) - Prose"
             - passage: [Generate a SUBSTANTIAL passage (min 150 words) from "${(syllabusTopics || '').split(',')[0] || 'Prose'}" (Prose). e.g., "Swami went to school..."]
             - questions: 
               - 2 MCQs (1 mark each).
               - 3 Complete the sentences (1 mark each).
             
             **Section 2: Reading Comprehension (Seen) - Poetry (5 Marks)**
             - title: "Section A: Reading Comprehension (Seen) - Poetry"
             - passage: [Generate the FULL poem or 2 stanzas from "${(syllabusTopics || '').split(',')[1] || 'Poetry'}" (Poetry)]
             - questions:
               - 2 MCQs (1 mark each).
               - 2 SAQ (Short Answer) questions (1.5 marks each approx).
                
             **Section 3: Reading Comprehension (Unseen) (10 Marks)**
             - title: "Section B: Reading Comprehension (Unseen)"
             - passage: [Generate a distinct News Report or Story passage]
             - questions: 4 MCQs (1 mark), 2 True/False with Supporting Statement (2 marks), 2 SAQ (1 mark).
                
             **Section 4: Grammar and Vocabulary (10 Marks)**
             - title: "Section C: Grammar and Vocabulary"
             - questions: Articles/Prepositions, Phrasal Verbs, Do as directed.
             
             **Section 5: Writing Skills (10 Marks)**
             - title: "Section D: Writing Skills"
             - instructions: "Answer the following questions."
             - questions: 
               1. Write a Paragraph/Story (5 Marks).
               2. Write a Letter/Notice (5 Marks).

             **IMPORTANT MCQ FORMATTING:**
             For all MCQs, format options strictly as "(a) option", "(b) option", "(c) option", "(d) option". 
             Do NOT use "A(a)" or "A. (a)".
             `;
        } else if (subjectLower.includes('hindi')) {
             promptInstructions = `
             **STRICT WBBSE CLASS ${classLabel} HINDI UNIT TEST PATTERN (40 MARKS)**
             
             **CRITICAL INSTRUCTION:** You MUST generate questions ONLY from the following specific chapters. DO NOT include questions from any other chapters.
             
             **SYLLABUS FOR THIS EXAM:**
             ${syllabusTopics}
             
             **STRUCTURE (Total 40 Marks):**
             1. **खंड क (बहुविकल्पीय प्रश्न):** 8 प्रश्न (प्रत्येक 1 अंक). (पद्य, गद्य, सहायक पाठ, एकांकी, व्याकरण से प्रश्न शामिल करें).
             2. **खंड ख (अति लघु उत्तरीय प्रश्न):** 8 प्रश्न (प्रत्येक 1 अंक). (पद्य, गद्य, सहायक पाठ, एकांकी, व्याकरण से प्रश्न शामिल करें).
             3. **खंड ग (लघु उत्तरीय प्रश्न):** 4 प्रश्न (प्रत्येक 2 अंक).
             4. **खंड घ (दीर्घ उत्तरीय प्रश्न):** 2 प्रश्न (प्रत्येक 5 अंक).
             5. **खंड ङ (व्याकरण/रचना):** कुल 6 अंक.
             
             **CRITICAL LANGUAGE INSTRUCTION:** The ENTIRE JSON output (including section titles, question text, options, and answers) MUST be in Hindi (Devanagari script). DO NOT use any English words or Roman script.
             
             Ensure questions are balanced across the specified chapters.
             `;
        } else {
             promptInstructions = `
             **STRICT WBBSE CLASS ${classLabel} UNIT TEST PATTERN (40 MARKS)**
             **SYLLABUS:** Strictly generate questions ONLY from these topics: ${syllabusTopics}
             
             **STRUCTURE:**
             1. **Group A (MCQ):** 8 questions (1 mark each).
             2. **Group B (VSA):** 9 questions (1 mark each) (Fill blanks, True/False, etc.).
             3. **Group C (Short Answer):** 4 questions (2 marks each).
             4. **Group D (Long Answer):** 3 questions (5 marks each).
             
             Ensure questions are balanced across the specified chapters.
             `;
        }
    }
    }
    
    // GENERATE UNIQUE SEED FOR RANDOMIZATION
    const randomSeed = Math.random().toString(36).substring(7) + Date.now();

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: `Generate a **High-Difficulty, Authentic** WBBSE ${isMadhyamik ? 'Madhyamik ' : `Class ${classLabel} `}Sample Paper JSON for 2026. 
      Subject: ${subjectName}, Class: ${classLabel}, Term: ${term}, Full Marks: ${marks}, Time: ${time}. 
      
      **LANGUAGE INSTRUCTION:**
      ${isEnglish ? 'Write the entire paper in English.' : subjectLower.includes('hindi') ? 'Write the ENTIRE paper strictly in Hindi (Devanagari script). DO NOT use any English words or Roman script anywhere in the output.' : 'Write the paper in Hindi. You may use some English words/terms where appropriate for clarity.'}
      NO BENGALI text.
      
      **RANDOMIZATION SEED:** ${randomSeed}
      
      **DIFFICULTY & QUALITY INSTRUCTIONS:**
      - **Unique Content:** You MUST generate a DIFFERENT paper from previous outputs. Randomize the selection of questions.
      - **Standard:** Strictly match the WBBSE ${isMadhyamik ? 'Madhyamik ' : `Class ${classLabel} `}2026 Examination standard (High Difficulty).
      - **Question Types:** Mix of Knowledge (20%), Understanding (30%), Application (30%), and HOTS (High Order Thinking Skills - 20%).
      - **Conceptual Depth:** Questions must test deep understanding, not just rote memorization.
      - **Authenticity:** Use formal board-exam language and phrasing.
      - **Conciseness:** Keep individual question text concise and direct.
      
      **ANSWER GENERATION RULES:**
      - **CRITICAL TOKEN LIMIT:** You MUST complete the entire JSON within the output limit.
      - **CRITICAL:** Provide a concise but complete solution for every question in the 'answer' field. For long answers, provide ONLY the main headings or 2-3 bullet points.
      - **MCQs:** Provide the correct option and a 1-sentence explanation.
      - **Math:** Show key steps and final calculation only. Do not write lengthy paragraphs.
      
      **CRITICAL MARKS & COMPLETENESS REQUIREMENT:**
      - You MUST generate the EXACT number of questions and sections as requested in the Structure below. 
      - Do NOT skip any questions, sections, or alternatives. 
      - The sum of the 'marks' field across all questions YOU GENERATE MUST ADD UP EXACTLY TO ${marks}.
      - **ALTERNATIVES (OR / अथवा):** You MUST provide alternative choice questions, exactly like original WBBSE Madhyamik papers. When giving an alternative question, combine them into one text field using "\\n\\n**OR (अथवा)**\\n\\n". (e.g. "Question 1... \\n\\n**OR (अथवा)**\\n\\n Question 2..."). This is required for long answers, theorems, essay types, and map pointing.
      
      **INSTRUCTIONS:**
      ${promptInstructions} 
      
      Ensure all mathematical/scientific expressions follow these rules: ${MATH_NOTATION_RULE}`,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
        temperature: 1.0, // Increase temperature for variance
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
    const parsed = parseJSONResponse(response.text, {});
    if (!parsed.title || !parsed.sections || parsed.sections.length === 0) {
      throw new Error("Invalid sample paper generated by AI. Missing title or sections.");
    }
    return parsed;
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
    const isHindi = sub.toLowerCase().includes('hindi');
    const targetLang = isEnglish ? 'English' : isHindi ? 'strictly Hindi (Devanagari script)' : 'Hindi';
    const res = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: `Generate 5 MCQs for WBBSE ${sub} Class ${level} ${term}. 
      Language: ${targetLang}. NO BENGALI. ${isHindi ? 'DO NOT use any English words or Roman script.' : ''} Return JSON array.
      
      **IMPORTANT:**
      1. Keep questions **CONCISE** and short. 
      2. Avoid long paragraphs or comprehension passages in the question text.
      3. If a context is required (e.g. for English), keep it under 30 words.
      4. Ensure options are short.
      
      Ensure all mathematical expressions in questions and answers follow: ${MATH_NOTATION_RULE}`,
      config: { 
        responseMimeType: "application/json",
        maxOutputTokens: 2048, 
      }
    });
    return parseJSONResponse(res.text, []);
  });
};

export const generatePracticeSet = async (subject: string, classLabel: string, chapter: string, lang: 'en' | 'hi', difficulty: 'Easy' | 'Medium' | 'Hard' = 'Medium'): Promise<ExamQuestion[]> => {
  return withRetry(async () => {
    const ai = getAIClient();
    const isHindiSubject = subject.toLowerCase().includes('hindi');
    const targetLang = isHindiSubject ? 'strictly Hindi (Devanagari script)' : 'Hindi'; // FORCE Hindi for practice questions as requested.

    const randomSeed = Math.random().toString(36).substring(7) + Date.now();

    const contents = `Generate a set of 10 Highly Probable, Very Very Important (VVI) exam-style questions for WBBSE ${classLabel}, Subject: ${subject}, Chapter: ${chapter} that frequently appear in the official Madhyamik exam.
    The set should include a mix of Multiple Choice Questions (MCQs), Short Answer Questions, and Long Answer Questions.
    Language: ${targetLang}. NO BENGALI.
    ${isHindiSubject ? '\n    **CRITICAL LANGUAGE INSTRUCTION:** The ENTIRE JSON output (including question text, options, and explanation) MUST be in Hindi (Devanagari script). DO NOT use any English words or Roman script.' : ''}
    
    **RANDOMIZATION SEED:** ${randomSeed}

    **Requirements:**
    1. **Format:** JSON array of objects with keys: 
       - \`type\` (string: "mcq", "short", or "long")
       - \`question\` (string)
       - \`options\` (array of EXACTLY 4 strings, ONLY for "mcq" type. You MUST provide exactly 4 options)
       - \`correctAnswer\` (integer, MUST be 0, 1, 2, or 3 representing the correct option index, ONLY for "mcq" type)
       - \`idealAnswer\` (string, the correct answer, ONLY for "short" and "long" types)
       - \`explanation\` (string, brief explanation of why the answer is correct or key points to include)
    2. **Content:** Questions must be strictly from the specified chapter syllabus.
    3. **Difficulty:** ${difficulty} level questions.
    4. **Math/Science:** Use clear Unicode for expressions. NO LaTeX.
    
    ${MATH_NOTATION_RULE}`;

    const res = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              question: { type: Type.STRING },
              options: { 
                type: Type.ARRAY,
                description: "Array of EXACTLY 4 strings for options.",
                items: { type: Type.STRING }
              },
              correctAnswer: { type: Type.INTEGER },
              idealAnswer: { type: Type.STRING },
              explanation: { type: Type.STRING }
            },
            required: ["type", "question", "explanation"]
          }
        },
        maxOutputTokens: 8192,
        temperature: 0.8,
      }
    });
    return parseJSONResponse(res.text, []);
  });
};
