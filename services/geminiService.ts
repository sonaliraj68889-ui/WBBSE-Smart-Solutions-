
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SamplePaper, ExamTerm, ExamQuestion } from "../types.ts";

export type ApiErrorCode = 'QUOTA_EXCEEDED' | 'SAFETY_BLOCKED' | 'SERVER_ERROR' | 'INVALID_KEY' | 'UNKNOWN';

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
      if (status === 429 || errorStr.includes('429') || errorStr.includes('quota')) {
        if (i === maxRetries - 1) throw new ApiError("Daily usage limit reached.", "QUOTA_EXCEEDED", error);
        const delay = 2000 * Math.pow(2, i) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Handle Invalid Key
      if (status === 400 || status === 403 || errorStr.includes('400') || errorStr.includes('403') || errorStr.includes('API key')) {
         throw new ApiError("Invalid or missing API Key.", "INVALID_KEY", error);
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

export const getAIClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY || localStorage.getItem('user_provided_api_key');
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

export const solveProblem = async (problem: string, context?: string, fileData?: { data: string, mimeType: string }) => {
  return withRetry(async () => {
    const ai = getAIClient();
    // ... rest of function
    const contents = fileData && fileData.data
      ? { parts: [{ inlineData: { data: fileData.data.split(',')[1] || fileData.data, mimeType: fileData.mimeType } }, { text: problem }] }
      : problem;

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
    const targetLang = isEnglish ? 'English' : 'Hindi';
    
    const res = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: `Provide a ${len} comprehensive board-standard solution for WBBSE chapter: "${title}" in ${sub}. Language: ${targetLang}. NO BENGALI. Focus on key concepts and logical explanations. ${MATH_NOTATION_RULE}`,
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
    const ai = getAIClient();
    const subjectLower = subject.toLowerCase();
    const isMadhyamik = classLabel.includes('10');
    const isEnglish = subjectLower.includes('english');
    
    let marks = 40;
    let time = "1 Hour 30 Minutes";
    let syllabusTopics = "";

    if (term === 'Summative 3' || term === 'Madhyamik Selection') {
      marks = isMadhyamik ? 90 : 70;
      time = isMadhyamik ? "3 Hours 15 Minutes" : "2 Hours 30 Minutes";
    }

    // --- SYLLABUS MAPPING FOR SUMMATIVE 1 & 2 (Based on WBBSE 2026 Images) ---
    if (term === 'Summative 1') {
       if (subjectLower.includes('math')) {
          syllabusTopics = `
          1. Quadratic Equation with one variable (एक चर वाले द्विघात समीकरण)
          2. Simple Interest (सरल ब्याज)
          3. Theorem related to circle (वृत्त से संबंधित प्रमेय)
          4. Rectangular Parallelopiped or Cuboid (आयताकार समांतर षट्फलक या घनाभ)
          5. Ratio and proportion (अनुपात और समानुपात)
          6. Compound interest and uniform rate of increase or decrease (चक्रवृद्धि ब्याज और समान वृद्धि दर)
          7. Theorem related to angle in a circle (वृत्तस्थ कोण संबंधित प्रमेय)
          8. Right circular cylinder (लंब वृत्ताकार बेलन)
          9. Quadratic Surd (द्विघात करणी)
          10. Theorems related to cyclic quadrilateral (चक्रीय चतुर्भुज संबंधित प्रमेय)
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
          Pady (Poetry): Raidas ke pad (रैदास के पद), Need ka nirman phir-phir (नीड़ का निर्माण फिर-फिर), Aatmtran (आत्मत्राण), Manushya aur sarp (मनुष्य और सर्प).
          Gady (Prose): Dhumketu (धूमकेतु), Usne kaha tha (उसने कहा था), Nanha sangeetkar (नन्हा संगीतकार).
          Sahayak Path: Tisari Kasam (तीसरी कसम).
          Ekanki: Deepdan (दीपदान).
          Vyakaran: Karak (कारक), Samas (समास), Translation (अंग्रेजी से हिन्दी अनुवाद).
          Rachna: Essay Writing (निबंध : विभिन्न विषयों पर).
          `;
       }
    } else if (term === 'Summative 2') {
       if (subjectLower.includes('math')) {
          syllabusTopics = `
          11. Construction: Construction of circumcircle and incircle of a triangle (त्रिभुज के परिवृत्त और अंतर्वृत्त की रचना)
          12. Sphere (गोलक)
          13. Variation (भेद)
          14. Partnership Business (साझा व्यापार)
          15. Theorems related to Tangent to a circle (वृत्त की स्पर्श रेखा संबंधित प्रमेय)
          16. Right circular cone (लंब वृत्ताकार शंकु)
          17. Similarity (सादृश्यता)
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
          Pady (Poetry): Ramdas (रामदास), Naurangiya (नौरंगिया), Desh-Prem (देश-प्रेम).
          Gady (Prose): Naubat khane mein ibadat (नौबत खाने में इबादत), Chappal (चप्पल), Namak (नमक), Dhavak (धावक).
          Sahayak Path: Karmnasha ki haar (कर्मनाशा की हार), Jaanch abhi jaari hai (जाँच अभी जारी है).
          Vyakaran: Vakya (वाक्य), Vachya (वाच्य), Prativedan Rachna (प्रतिवेदन रचना), Samvad Lekhan (संवाद लेखन).
          Rachna: Essay Writing (निबंध : विभिन्न विषयों पर).
          `;
       }
    }

    let promptInstructions = "";
    
    // --- FULL SYLLABUS LOGIC (Summative 3 / Selection) ---
    if (term === 'Summative 3' || term === 'Madhyamik Selection') {
        if (subjectLower.includes('math')) {
          promptInstructions = `
          **STRICT WBBSE MATHEMATICS (2026 ORIGINAL PAPER PATTERN)**
          Generate a paper strictly following this structure (Total 90 Marks):
          1. **Q1. MCQ:** 6 compulsory questions (1 mark each).
          2. **Q2. Fill in the blanks:** 5 questions to answer out of 6 provided (1 mark each).
          3. **Q3. True/False:** 5 questions to answer out of 6 provided (1 mark each).
          4. **Q4. Short Answer (SA):** 10 questions to answer out of 12 provided (2 marks each).
          5. **Q5. Arithmetic:** 1 question to answer out of 2 (5 marks). (Topics: Simple/Compound Interest, Partnership).
          6. **Q6. Quadratic Equations:** 1 question to answer out of 2 (3 marks).
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
          **STRICT WBBSE ENGLISH (SECOND LANGUAGE) (2026 ORIGINAL PAPER PATTERN)**
          **JSON STRUCTURE:** Create separate 'sections' array items for Prose, Poetry, Unseen, Grammar, and Writing to ensure passage text is near questions.
          
          **STRUCTURE (Total 90 Marks):**
          
          **Section 1: Reading Comprehension (Seen) - Prose (12 Marks)**
          - title: "Section A: Reading Comprehension (Seen) - Prose"
          - passage: [Generate a SUBSTANTIAL Prose passage from Father's Help, The Passing Away of Bapu, etc.]
          - questions: 
             - 5 MCQs (1 mark). Options: "(a) ...", "(b) ...".
             - 3 Complete the sentences (1 mark).
             - 2 True/False with Supporting Statement (2 marks).
          
          **Section 2: Reading Comprehension (Seen) - Poetry (8 Marks)**
          - title: "Section A: Reading Comprehension (Seen) - Poetry"
          - passage: [Generate a FULL Poem/Stanza from Fable, My Own True Family, etc.]
          - questions: 
             - 4 MCQs (1 mark). Options: "(a) ...", "(b) ...".
             - 2 SAQs (2 marks).
             
          **Section 3: Reading Comprehension (Unseen) (20 Marks)**
          - title: "Section B: Reading Comprehension (Unseen)"
          - passage: [Generate a news report or story]
          - questions: 6 MCQs, 3 True/False w/ Support, 4 SAQs.
          
          **Section 4: Grammar and Vocabulary (20 Marks)**
          - title: "Section C: Grammar and Vocabulary"
          - questions: Verb Forms, Articles/Prepositions, Do as Directed, Phrasal Verbs, Vocabulary.
          
          **Section 5: Writing (30 Marks)**
          - title: "Section D: Writing Skills"
          - questions: Story, Letter, Report/Notice (10 marks each).
          `;
        } else if (subjectLower.includes('history')) {
          promptInstructions = `
          **STRICT WBBSE HISTORY (2026 ORIGINAL PAPER PATTERN)**
          Structure the 'sections' array exactly as follows (Total 90 Marks):
          1. **Group A (MCQ):** 20 compulsory questions (1x20=20).
          2. **Group B (VSA) (16 Marks):** Answer 16 out of 20.
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
          **STRICT WBBSE GEOGRAPHY (2026 ORIGINAL PAPER PATTERN)**
          Structure the 'sections' array exactly as follows (Total 90 Marks):
          1. **Group A (MCQ):** 14 compulsory questions (1x14=14).
          2. **Group B (VSA) (22 Marks):** Answer 22 out of 26.
             - True/False (Answer 6).
             - Fill in blanks (Answer 6).
             - Answer in one or two words (Answer 6).
             - Match Columns (4 matches).
          3. **Group C (Short Answer - 2 Marks):** Answer 6 questions out of 12 (2x6=12). (Definitions/Concepts).
          4. **Group D (Explanatory - 3 Marks):** Answer 4 questions out of 8 (3x4=12). (Reasoning/Differences).
          5. **Group E (Long Answer - 5 Marks) (20 Marks):**
             - Physical Geography: Answer 2 out of 4 (5x2=10).
             - Economic/Regional Geography: Answer 2 out of 4 (5x2=10).
          6. **Group F (Map Pointing):** 10 items on Map of India (1x10=10).
          `;
        } else if (subjectLower.includes('hindi')) {
          promptInstructions = `
          **STRICT WBBSE HINDI (FIRST LANGUAGE) (2026 ORIGINAL PAPER PATTERN)**
          Structure the 'sections' array exactly as follows (Total 90 Marks):
          1. **Q1. MCQ:** 17 compulsory questions (1x17=17). (Grammar & Literature mixed).
          2. **Q2. VSA:** Answer 19 questions (1x19=19). (Approx 20-25 words).
          3. **Q3. Short Explanatory (3 Marks):** Answer 2 questions (1 Prose, 1 Poetry) (3x2=6).
          4. **Q4. Long Answer (Literature - 5 Marks):** Answer 4 questions (5x4=20). (From Prose, Poetry, Essay, etc.).
          5. **Q5. Supplementary Long Answer (5 Marks):** Answer 2 questions (5x2=10).
          6. **Q6. Essay:** Write 1 essay (10 Marks).
          7. **Q7. Translation:** English to Hindi (4 Marks).
          8. **Q8. Report/Dialogue:** Answer 1 question (5 Marks).
          `;
        } else if (subjectLower.includes('life science') || subjectLower.includes('lifesci')) {
            promptInstructions = `
            **STRICT WBBSE LIFE SCIENCE (2026 ORIGINAL PAPER PATTERN)**
            Structure the 'sections' array exactly as follows (Total 90 Marks):
            1. **Group A (MCQ):** 15 compulsory questions (1x15=15).
            2. **Group B (VSA) (21 Marks):** Answer 21 out of 26.
               - Fill in the blanks (Answer 5).
               - True/False (Answer 5).
               - Match Columns (Answer 5).
               - Answer in one word/sentence (Answer 6).
            3. **Group C (Short Answer - 2 Marks):** Answer 12 questions out of 17 (2x12=24).
            4. **Group D (Long Answer - 5 Marks):** Answer 6 questions (5x6=30).
               - Internal choices provided.
               - Q4.1 must be a Diagram question.
            `;
        } else if (subjectLower.includes('physical science') || subjectLower.includes('physci')) {
            promptInstructions = `
            **STRICT WBBSE PHYSICAL SCIENCE (2026 ORIGINAL PAPER PATTERN)**
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
    } else {
        // --- SUMMATIVE 1 & 2 (40 Marks Pattern) ---
        if (subjectLower.includes('english')) {
             promptInstructions = `
             **STRICT WBBSE CLASS 10 ENGLISH UNIT TEST PATTERN (40 MARKS)**
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
        } else {
             promptInstructions = `
             **STRICT WBBSE UNIT TEST PATTERN (40 MARKS)**
             **SYLLABUS:** Strictly generate questions ONLY from these topics: ${syllabusTopics}
             
             **STRUCTURE:**
             1. **Group A (MCQ):** approx 6-8 marks.
             2. **Group B (VSA):** approx 4-6 marks (Fill blanks, True/False, etc.).
             3. **Group C (Short Answer):** approx 8-10 marks (2 marks each).
             4. **Group D (Long Answer):** approx 16-20 marks (3 or 5 marks each depending on subject nature).
             
             Ensure questions are balanced across the specified chapters.
             `;
        }
    }
    
    // GENERATE UNIQUE SEED FOR RANDOMIZATION
    const randomSeed = Math.random().toString(36).substring(7) + Date.now();

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: `Generate a **High-Difficulty, Authentic** WBBSE Madhyamik Sample Paper JSON for 2026. 
      Subject: ${subject}, Class: ${classLabel}, Term: ${term}, Full Marks: ${marks}, Time: ${time}. 
      Language: ${isEnglish ? 'English' : 'Hindi'}. NO BENGALI text.
      
      **RANDOMIZATION SEED:** ${randomSeed}
      
      **DIFFICULTY & QUALITY INSTRUCTIONS:**
      - **Unique Content:** You MUST generate a DIFFERENT paper from previous outputs. Randomize the selection of questions.
      - **Standard:** Strictly match the WBBSE Madhyamik 2026 Examination standard (High Difficulty).
      - **Question Types:** Mix of Knowledge (20%), Understanding (30%), Application (30%), and HOTS (High Order Thinking Skills - 20%).
      - **Conceptual Depth:** Questions must test deep understanding, not just rote memorization.
      - **Authenticity:** Use formal board-exam language and phrasing.
      - **Conciseness:** Keep individual question text concise and direct.
      
      **ANSWER GENERATION RULES:**
      - **CRITICAL:** You MUST provide a **FULL, DETAILED, STEP-BY-STEP SOLUTION** for every single question in the 'answer' field.
      - **MCQs:** Provide the correct option AND a brief explanation of *why* it is correct.
      - **Math:** Show formulas, steps, substitution, and final calculation.
      - **Long Answer:** Write the full model answer as a student should write in the exam (e.g., 5 points for 5 marks).
      
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
      contents: `Generate 5 MCQs for WBBSE ${sub} Class ${level} ${term}. 
      Language: ${targetLang}. NO BENGALI. Return JSON array.
      
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
    return JSON.parse(res.text || "[]");
  });
};

export const generatePracticeSet = async (subject: string, classLabel: string, chapter: string, lang: 'en' | 'hi'): Promise<ExamQuestion[]> => {
  return withRetry(async () => {
    const ai = getAIClient();
    const targetLang = 'Hindi'; // FORCE Hindi for practice questions as requested.

    const randomSeed = Math.random().toString(36).substring(7) + Date.now();

    const contents = `Generate 10 High-Quality Multiple Choice Questions (MCQs) for WBBSE ${classLabel}, Subject: ${subject}, Chapter: ${chapter}.
    Language: ${targetLang}. NO BENGALI.
    
    **RANDOMIZATION SEED:** ${randomSeed}

    **Requirements:**
    1. **Format:** JSON array of objects with keys: 
       - \`question\` (string)
       - \`options\` (array of 4 strings)
       - \`correctAnswer\` (number, index 0-3)
       - \`explanation\` (string, brief explanation of why the answer is correct)
    2. **Content:** Questions must be strictly from the specified chapter syllabus.
    3. **Difficulty:** Mix of easy, medium, and hard.
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
              question: { type: Type.STRING },
              options: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              correctAnswer: { type: Type.INTEGER },
              explanation: { type: Type.STRING }
            },
            required: ["question", "options", "correctAnswer", "explanation"]
          }
        },
        maxOutputTokens: 8192,
        temperature: 0.8,
      }
    });
    return JSON.parse(res.text || "[]");
  });
};
