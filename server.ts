import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let aiClient: GoogleGenAI | null = null;
function getAiClient() {
  if (!aiClient) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set. Please provide a valid API key.");
    }
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.post('/api/generate', async (req, res) => {
    try {
      const { subject } = req.body;
      const ai = getAiClient();
      
      const prompt = `Generate a mock WBBSE Madhyamik sample question paper for ${subject}.
      
      CRITICAL REQUIREMENT:
      You MUST provide alternative questions (internal choice) for some of the questions, exactly as found in real WBBSE Madhyamik papers.
      Use the word "**OR**" (for English/others) or "**अथवा**" (for Hindi) to indicate an alternative question clearly.
      Separate the alternative questions visually.

      Example format:
      **Q1. What is X?**
      > **OR**
      >
      > **Q1. What is Y?**

      The full paper should be exactly 90 marks. Structure it accurately according to the ${subject} WBBSE Madhyamik syllabus (Groups, Sections, Marks per question).
      Return the output as nicely formatted Markdown. 
      Do NOT include any preamble, just return the exam paper starting with a <h2> title.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt
      });

      res.json({ text: response.text });
    } catch (err: any) {
      console.error('Error generating paper:', err);
      res.status(500).json({ error: err.message || 'Failed to generate paper' });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  const port = 3000;
  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
}

startServer().catch(console.error);
