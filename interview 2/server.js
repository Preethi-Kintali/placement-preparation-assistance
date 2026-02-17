import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const allowedOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const serveFrontend = process.env.SERVE_FRONTEND !== 'false';

app.use(cors(
  allowedOrigins.length
    ? {
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('CORS blocked for origin'));
      }
    }
    : undefined
));
app.use(express.json({ limit: '1mb' }));
if (serveFrontend) {
  app.use(express.static(path.join(__dirname, 'public')));
}

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
const gemini = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';

const ROUND_CONFIG = [
  { name: 'Frontend Expert', company: 'Google', provider: { id: 'groq', model: 'llama-3.3-70b-versatile' }, focus: 'React/JavaScript' },
  { name: 'Backend Architect', company: 'Amazon', provider: { id: 'gemini', model: 'gemini-2.5-flash' }, focus: 'Node/Python' },
  { name: 'DSA Expert', company: 'MAANG', provider: { id: 'groq', model: 'llama-3.3-70b-versatile' }, focus: 'Data Structures & Algorithms' },
  { name: 'System Design Lead', company: 'MAANG', provider: { id: 'gemini', model: 'gemini-2.5-flash' }, focus: 'Distributed Systems' }
];

const FALLBACK_QUESTIONS = [
  [
    'Explain useEffect dependency array? Give example.',
    'How to prevent memory leaks in React apps?',
    'Build custom hook for movie API + caching'
  ],
  [
    'Difference between JWT and Session auth?',
    'How Node.js handles 10K concurrent users?',
    'Design e-commerce cart with inventory locks'
  ],
  [
    'Reverse a linked list - write code',
    'Find duplicate in array O(n) time O(1) space',
    'Implement LRU Cache get/put O(1)'
  ],
  [
    'Design URL shortener like bit.ly',
    'Twitter timeline for 300M users',
    'WhatsApp chat system 1B msg/day'
  ]
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPrompt({ role, company, question, answer, topics }) {
  const topicLine = topics ? `Interview topics to focus on: "${topics}"\n` : '';
  return `You are ${role} @${company} with 15+ years experience conducting MAANG interviews.

${topicLine}
Current question: "${question}"
Student answered: "${answer}"

Respond like a real interviewer in 4 short parts:
1) Score: X/10 (Correctness 4pts + Depth 3pts + Communication 3pts)
2) 1-2 lines of feedback: what was good + what was missing
3) Quick tip: "Next time mention..."
4) End with a conversational transition like "Ready for the next question?"

Keep the tone natural, direct, and encouraging. Be concise.`;
}

function buildQuestionPrompt({ role, focus, topics }) {
  const topicGuard = topics
    ? `The candidate requested these custom topics: "${topics}". All 3 questions must stay strictly inside these topics while still fitting ${focus}.`
    : `Use standard ${focus} interview themes.`;

  return `You are a ${role} running a MAANG mock technical interview focused on ${focus}.

${topicGuard}

Generate exactly 3 oral interview questions with increasing difficulty:
1) basic
2) medium
3) hard

Rules:
- One line per question
- No numbering, no markdown, no explanations
- Keep each question short and realistic for a live interview`;
}

function parseQuestions(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\d+[).:-]?\s*/, '').trim())
    .filter(Boolean)
    .filter((line) => line.length > 8)
    .slice(0, 3);
  return lines;
}

function makeTopicFallbackQuestions(roundIndex, topics) {
  const requested = String(topics || '').trim();
  if (!requested) return FALLBACK_QUESTIONS[roundIndex];

  const roundLabel = ['frontend', 'backend', 'dsa', 'system design'][roundIndex] || 'technical';
  return [
    `Basic ${roundLabel} question on ${requested}: explain core concepts and one practical example.`,
    `Medium ${roundLabel} problem on ${requested}: design or solve with trade-offs and complexity discussion.`,
    `Hard ${roundLabel} scenario on ${requested}: propose a production-grade approach with edge cases.`
  ];
}

function parseScore(text) {
  const match = text.match(/(score\s*[:\-]?\s*)(\d+(?:\.\d+)?)/i) || text.match(/(\d+(?:\.\d+)?)\s*\/\s*10/i);
  if (!match) return 7;
  const raw = Number(match[2] || match[1]);
  if (Number.isNaN(raw)) return 7;
  return Math.max(0, Math.min(10, Math.round(raw * 10) / 10));
}

function fallbackFeedback({ question, answer }) {
  const length = answer.trim().split(/\s+/).filter(Boolean).length;
  let score = 5.5;
  if (length > 40) score += 1.2;
  if (length > 90) score += 1;
  if (/example|trade[\s-]?off|complexity|scale|edge case|cleanup|cache|lock/i.test(answer)) score += 1;
  score = Math.min(9.2, Math.round(score * 10) / 10);

  const feedback = `Score: ${score}/10. Solid attempt on "${question}". You explained core ideas, but sharpen structure and include explicit trade-offs and edge cases. Quick tip: state assumptions first, then solution, then pitfalls. Ready for the next question?`;
  return { score, feedback, source: 'fallback' };
}

async function callGroq(prompt, model) {
  if (!groq) throw new Error('GROQ API key missing');
  const response = await groq.chat.completions.create({
    model: model || 'llama-3.3-70b-versatile',
    temperature: 0.5,
    messages: [{ role: 'user', content: prompt }]
  });
  return response.choices?.[0]?.message?.content?.trim() || '';
}

async function callOpenAI(prompt, model) {
  if (!openai) throw new Error('OpenAI API key missing');
  const response = await openai.chat.completions.create({
    model: model || 'gpt-4o-mini',
    temperature: 0.5,
    messages: [{ role: 'user', content: prompt }]
  });
  return response.choices?.[0]?.message?.content?.trim() || '';
}

async function callAnthropic(prompt, model) {
  if (!anthropic) throw new Error('Anthropic API key missing');
  const response = await anthropic.messages.create({
    model: model || 'claude-3-5-sonnet-latest',
    max_tokens: 350,
    temperature: 0.5,
    messages: [{ role: 'user', content: prompt }]
  });
  const first = response.content?.[0];
  return first?.type === 'text' ? first.text.trim() : '';
}

async function callGemini(prompt, model) {
  if (!gemini) throw new Error('Gemini API key missing');
  const genModel = gemini.getGenerativeModel({ model: model || 'gemini-1.5-flash' });
  const response = await genModel.generateContent(prompt);
  return response.response?.text()?.trim() || '';
}

async function callOllama(prompt, model) {
  const response = await fetch(`${ollamaHost}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || 'llama3.2',
      stream: false,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama error: ${response.status} ${text}`);
  }
  const data = await response.json();
  return data?.message?.content?.trim() || '';
}

async function callWithRetry(provider, prompt) {
  const config = typeof provider === 'string' ? { id: provider } : provider || {};
  const fnMap = {
    groq: callGroq,
    openai: callOpenAI,
    anthropic: callAnthropic,
    gemini: callGemini,
    ollama: callOllama
  };
  const call = fnMap[config.id];
  if (!call) throw new Error(`Unknown provider: ${config.id}`);

  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      if (attempt > 0) await delay(500);
      return await call(prompt, config.model);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

app.get('/api/health', (_, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

app.get('/api/round-questions', async (req, res) => {
  const roundIndex = Number(req.query.roundIndex);
  const topics = typeof req.query.topics === 'string' ? req.query.topics.trim() : '';
  if (!Number.isInteger(roundIndex) || roundIndex < 0 || roundIndex > 3) {
    return res.status(400).json({ error: 'Invalid round index' });
  }

  const round = ROUND_CONFIG[roundIndex];
  const prompt = buildQuestionPrompt({ role: round.name, focus: round.focus, topics });

  try {
    const raw = await callWithRetry(round.provider, prompt);
    const questions = parseQuestions(raw);
    if (questions.length === 3) {
      return res.json({ questions, source: round.provider.id, dynamic: true });
    }
  } catch (error) {
    // fallback below
  }

  return res.json({
    questions: makeTopicFallbackQuestions(roundIndex, topics),
    source: 'fallback',
    dynamic: false
  });
});

app.post('/api/ask', async (req, res) => {
  const { roundIndex, questionIndex, answer, question, topics } = req.body || {};
  if (typeof roundIndex !== 'number' || typeof questionIndex !== 'number' || !question || typeof answer !== 'string') {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const round = ROUND_CONFIG[roundIndex];
  if (!round) return res.status(400).json({ error: 'Invalid round index' });

  const prompt = buildPrompt({
    role: round.name,
    company: round.company,
    question,
    answer,
    topics: typeof topics === 'string' ? topics.trim() : ''
  });

  try {
    const feedback = await callWithRetry(round.provider, prompt);
    const score = parseScore(feedback);
    return res.json({ score, feedback, next_question: true, source: round.provider.id });
  } catch (error) {
    const fallback = fallbackFeedback({ question, answer });
    return res.json({ ...fallback, next_question: true, error: 'AI unavailable, fallback used' });
  }
});

if (serveFrontend) {
  app.get('*', (_, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Interview simulator running at http://localhost:${port}`);
});
