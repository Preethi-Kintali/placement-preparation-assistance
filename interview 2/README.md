# MAANG AI Technical Interview Simulator

Real-time AI mock interview app with:
- Dynamic topic-based questions
- Voice-first interview flow (AI speaks, app listens)
- 4 rounds x 3 questions with scoring and final report
- Groq + Gemini provider routing

## Tech Stack

- Frontend: Vanilla HTML/CSS/JS (PWA)
- Backend: Node.js + Express
- AI Providers: Groq, Gemini

## Run Locally

1) Install dependencies

```bash
npm install
```

2) Create `.env` from `.env.example`

```env
PORT=3000
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
OLLAMA_HOST=http://localhost:11434
CLIENT_ORIGIN=http://localhost:5173
SERVE_FRONTEND=true
```

3) Start server

```bash
npm start
```

4) Open

```text
http://localhost:3000
```

## MERN / Main-Stack Integration

Use this project as an **AI interview microservice** in your existing MERN app.

### Option A: Keep this frontend too (quick demo)

- Keep `SERVE_FRONTEND=true`
- Your backend serves both API and interview UI

### Option B: Integrate with your existing React frontend (recommended for MERN)

1) Set:

```env
SERVE_FRONTEND=false
CLIENT_ORIGIN=http://localhost:5173
```

2) Run this service on a separate port (example: `3010`)

3) From your React app, call these APIs:

- `GET /api/health`
- `GET /api/round-questions?roundIndex=0&topics=graphs,communication`
- `POST /api/ask`

`POST /api/ask` payload:

```json
{
	"roundIndex": 0,
	"questionIndex": 0,
	"question": "Explain BFS",
	"answer": "...candidate response...",
	"topics": "graphs, communication"
}
```

Response:

```json
{
	"score": 8,
	"feedback": "Excellent...",
	"next_question": true,
	"source": "groq"
}
```

## What Changed for Integration

- Added dynamic topic-based question generation endpoint (`/api/round-questions`)
- Added topic-aware scoring feedback in `/api/ask`
- Added configurable CORS using `CLIENT_ORIGIN`
- Added optional frontend hosting toggle with `SERVE_FRONTEND`
- Updated UI start screen to accept custom topics before interview

## Notes

- API keys stay server-side only.
- If AI providers fail temporarily, fallback questions/feedback are used.
- Voice features require Chrome/Edge with microphone permission.
