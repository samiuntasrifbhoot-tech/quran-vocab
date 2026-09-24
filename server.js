import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(express.json());

// Enable CORS and headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Explicit static routes for data files with correct JSON headers
app.use('/data', express.static(path.join(__dirname, 'data'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
  }
}));

// Support sub-path /quran-vocab if referenced
app.use('/quran-vocab/data', express.static(path.join(__dirname, 'data'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
  }
}));
app.use('/quran-vocab', express.static(__dirname));

// Serve static assets from root directory
app.use(express.static(__dirname));

// AI Tutor Proxy Route
app.post('/api/tutor', async (req, res) => {
  const { word_id, lemma_ar, root, pos, word_type, meaning_bn, meaning_en, verse_context, user_question, prompt_type } = req.body || {};

  // Build grounded fallback response
  const generateFallbackResponse = () => {
    let response = `### 📖 শব্দ ব্যাখ্যা: ${lemma_ar || ''} (${meaning_bn || ''})\n\n`;
    response += `**১. অর্থ ও প্রয়োগ:**\n`;
    response += `শব্দটি কুরআনে **${meaning_bn || ''}** (ইংরেজি: *${meaning_en || ''}*) অর্থে ব্যবহৃত হয়েছে। শব্দশ্রেণি: **${word_type || pos || 'শব্দ'}**।\n\n`;
    
    if (root) {
      response += `**২. মূলধাতু ও রূপতত্ত্ব (Root & Morphology):**\n`;
      response += `এর মূলধাতু বা রুট হলো **[ ${root} ]**। কুরআনিক আরবিতে একই মূলধাতুর শব্দগুলো একটি সাধারণ ভাবগত অর্থ শেয়ার করে। যেমন এই মূল থেকে সম্পর্কিত বিভিন্ন পদ গঠিত হয়।\n\n`;
    } else {
      response += `**২. ব্যাকরণগত মর্যাদা:**\n`;
      response += `এটি একটি গুরুত্বপূর্ণ অব্যয় বা ব্যাকরণিক পদ (Function word), যা বাক্য গঠনে এবং বাক্যের অন্যান্য অংশের সাথে অর্থ সংযোগে অপরিহার্য ভূমিকা রাখে।\n\n`;
    }

    if (verse_context && verse_context.text_ar) {
      response += `**৩. কুরআনিক প্রেক্ষাপট (সূরা ${verse_context.surah || ''}, আয়াত ${verse_context.ayah || ''}):**\n`;
      response += `> *${verse_context.text_ar}*\n\n`;
      response += `অর্থ: "${verse_context.text_bn || verse_context.text_en || ''}"\n\n`;
      response += `**৪. কেন এই অর্থ প্রযোজ্য:**\n`;
      response += `এই আয়াতে শব্দটি বিশেষভাবে প্রসঙ্গ অনুযায়ী স্পষ্ট ভাব প্রকাশ করেছে। ব্যাকরণিক কাঠামোর সাথে সঙ্গতি রেখে এর অর্থ সরাসরি বাক্যের মূল বার্তাকে সুস্পষ্ট করে।\n\n`;
    }

    response += `**৫. মনে রাখার সহজ কৌশল:**\n`;
    response += `শব্দটির অর্থ [**${meaning_bn || ''}**] মনে রাখতে এই শব্দ দিয়ে কুরআনের চেনা আয়াতটি বা এর মূলধাতুটি প্রতিদিনের রিভিউ সেশনে সক্রিয়ভাবে স্মরণ (Active Recall) করুন।`;
    return response;
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.json({
      success: true,
      source: 'grounded_rules_engine',
      explanation: generateFallbackResponse()
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const systemPrompt = `You are a respectful, knowledgeable, and pedagogically focused Quranic Arabic tutor for Bengali-speaking learners.
CRITICAL RULES:
1. Ground your answer strictly on the verified data provided. NEVER invent Quranic verses, never hallucinate statistics, and never alter Quranic Arabic text.
2. Structure your response in clean, easy-to-read Bengali with clear headings:
   - ১. অর্থ ও তাৎপর্য (Meaning & Connotation)
   - ২. ব্যাকরণ ও রূপতত্ত্ব (Grammar & Morphology)
   - ৩. কুরআনিক প্রেক্ষাপট (Contextual analysis of the given verse)
   - ৪. কেন এই অর্থ প্রযোজ্য (Why this meaning fits here)
   - ৫. মনে রাখার সহজ টিপস (Memory tip)
3. Keep the language natural, encouraging, and concise. Avoid unnecessary academic jargon.
4. If the user asks a specific question ("${user_question || ''}"), answer it directly and warmly.`;

    const userContent = `শব্দ তথ্য:
- আরবি শব্দ (Lemma): ${lemma_ar || ''}
- মূলধাতু (Root): ${root || 'N/A'}
- শব্দশ্রেণি: ${word_type || pos || ''}
- বাংলা অর্থ: ${meaning_bn || ''}
- ইংরেজি অর্থ: ${meaning_en || ''}
${verse_context ? `- আয়াত প্রেক্ষাপট: [সূরা ${verse_context.surah}:${verse_context.ayah}] "${verse_context.text_ar}" - অনুবাদ: "${verse_context.text_bn}"` : ''}
${user_question ? `- ব্যবহারকারীর প্রশ্ন: ${user_question}` : ''}

অনুরোধ: এই শব্দটির অর্থ, প্রেক্ষাপট এবং ব্যাকরণ বুঝিয়ে দিন যাতে একজন শিক্ষার্থী সহজেই কুরআনে এর ভাবার্থ ধরতে পারে।`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userContent}` }] }
      ],
      config: {
        temperature: 0.3,
        maxOutputTokens: 800,
      }
    });

    const explanation = response.text || generateFallbackResponse();
    res.json({
      success: true,
      source: 'gemini-3.8-flash',
      explanation
    });
  } catch (err) {
    console.error('Error generating AI explanation:', err);
    res.json({
      success: true,
      source: 'grounded_rules_engine',
      explanation: generateFallbackResponse()
    });
  }
});

// SPA fallback for HTML navigation routes only
app.get('*', (req, res) => {
  // If the request is for data, API, or has a file extension, return a 404 JSON instead of HTML
  if (req.path.startsWith('/api/') || req.path.startsWith('/data/') || path.extname(req.path)) {
    return res.status(404).json({ error: `Not found: ${req.path}` });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
