<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/Gemini-AI-4285F4?logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind-CSS-06B6D4?logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/Expo-React_Native-000020?logo=expo&logoColor=white" />
</p>

# 🎓 PlacePrep — Personalized Placement Assistance System

> An AI-powered, full-stack platform that helps engineering students prepare for campus placements through **ML-based prediction**, **RAG-powered study assistants**, **AI mock interviews**, **adaptive roadmaps**, and **gamified learning** — all in one unified web + mobile experience.

---

## 📋 Table of Contents

- [Problem Statement](#-problem-statement)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [AI & ML Implementation](#-ai--ml-implementation)
- [RAG Pipeline](#-rag-pipeline-advanced)
- [Screenshots](#-screenshots)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Project Structure](#-project-structure)
- [API Endpoints](#-api-endpoints)
- [Datasets & Models](#-datasets--models)
- [Deployment](#-deployment)
- [Contributing](#-contributing)

---

## 🎯 Problem Statement

Engineering students in India face a **fragmented placement preparation experience** — they juggle between LeetCode for DSA, YouTube for concepts, random PDFs for aptitude, mock interview apps, and separate resume tools. There's no single platform that:

- **Predicts** their placement probability using ML
- **Personalizes** study plans based on their career path
- **Evaluates** their progress across aptitude, DSA, soft skills, and technical knowledge
- **Simulates** real company interviews with AI
- **Analyzes** their resume against job descriptions (ATS scoring)

**PlacePrep** solves this by combining all these capabilities into one AI-driven platform, personalized to each student's profile, career goals, and current skill level.

---

## ✨ Key Features

### 🤖 AI-Powered Features

| Feature | Description |
|---------|-------------|
| **ML Placement Prediction** | Pure TypeScript Random Forest (100 trees, trained from 8000+ student records) predicts placement probability using 10 academic/experience features |
| **RAG Study Assistant** | 12-step Retrieval-Augmented Generation pipeline with multi-query expansion, re-ranking, guardrails, and grounded responses from a placement knowledge base |
| **AI Mock Interview** | 3 modes — Resume-based (upload PDF, AI generates personalized questions), Company-based (40+ companies with LeetCode data), Weekly (roadmap-aligned) |
| **Live Learn (Notes Q&A)** | Upload your class notes (PDF) → system embeds and indexes them → ask questions answered ONLY from your uploaded notes (RAG-filtered) |
| **Resume ATS Analyzer** | Upload resume + job description → 150+ skill pattern matching + semantic similarity (Gemini embeddings) → ATS score + missing skills + AI recommendations |
| **Company Prep Roadmaps** | Select from 40+ companies → AI generates a 4-week preparation roadmap based on that company's most-asked LeetCode topics |
| **Smart Alerts** | Automated notifications: streak risk, weak subject warnings, roadmap behind alerts — triggered on every login with 24h cooldown |
| **Personalization Engine** | Cross-module skill gap analysis combining exam scores, interview performance, roadmap progress, and profile data → daily task recommendations + readiness score |

### 📚 Core Features

| Feature | Description |
|---------|-------------|
| **12-Week Adaptive Roadmap** | Generated from a 4.6 MB skills dataset, sorted by learning priority/difficulty. Weekly tests (60% pass) gate access to next week. Grand test + certificate on completion |
| **MCQ Exam System** | Timed exams across 4 types: Aptitude, DSA, Soft Skills, Career-specific (13 domains). Questions from 15 CSV datasets with ML-predicted difficulty |
| **Gamification** | Health Points (HP), daily streaks, 7 badge types, leaderboard. HP awarded for check-ins, exams, interviews, roadmap completion |
| **Job Search** | Naukri API integration via RapidAPI + daily automated email alerts for subscribed roles |
| **Admin Dashboard** | Student management, platform analytics, ML placement reports, per-student roadmap/results view |
| **Multi-Platform** | React web app (18 pages) + React Native/Expo mobile app (12 screens) |

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        USER (Browser / Mobile App)                │
└───────────────┬──────────────────────────────────────────────────┘
                │ HTTPS + JWT Auth
                ▼
┌──────────────────────────────────────────────────────────────────┐
│                     EXPRESS REST API (:4000)                       │
│                                                                    │
│  Auth         → bcrypt + JWT (7-day tokens)                       │
│  Prediction   → TypeScript Random Forest (trained from CSV)       │
│  Study Chat   → 12-step RAG Pipeline (embeddings + re-rank)      │
│  Interview    → LLM question generation + answer scoring          │
│  Roadmap      → Skills CSV → 12-week plan + weekly tests         │
│  Exams        → 15 CSV question banks → random quiz + grading    │
│  Resume ATS   → PDF parse → 150-skill matcher → AI suggestions   │
│  Knowledge    → User PDF upload → embed → filtered RAG Q&A       │
│  Jobs         → Naukri RapidAPI + daily email cron                │
│  Gamification → HP, streaks, badges, leaderboard                 │
│  Alerts       → Automated checks (streak, weak areas, roadmap)   │
│  Admin        → Analytics + student management                   │
└───────────┬──────────────────┬──────────────────┬────────────────┘
            │                  │                  │
            ▼                  ▼                  ▼
     ┌──────────┐    ┌─────────────────┐   ┌──────────────┐
     │ MongoDB  │    │  AI Providers   │   │ External APIs│
     │ Atlas    │    │                 │   │              │
     │ 17 colls │    │ Google Gemini   │   │ RapidAPI     │
     │ + vector │    │ Groq (Llama 3) │   │ YouTube API  │
     │ storage  │    │ OpenRouter      │   │ Gmail SMTP   │
     └──────────┘    └─────────────────┘   └──────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Web Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Shadcn/UI | SPA with glassmorphism design system |
| **Mobile App** | React Native, Expo, TypeScript | Cross-platform Android/iOS |
| **Backend** | Node.js, Express, TypeScript | REST API (50+ endpoints) |
| **Database** | MongoDB Atlas + Mongoose ODM | 17 collections including vector storage |
| **ML Training** | Python, scikit-learn, joblib | Offline model training |
| **ML Inference** | Pure TypeScript (no Python dependency) | Real-time placement prediction |
| **GenAI — LLM** | Google Gemini Pro, Groq (Llama 3.3 70B) | Interviews, chatbot, roadmaps |
| **GenAI — Embeddings** | Gemini embedding-001 (3072-dim) | RAG vector search |
| **Auth** | JWT + bcrypt (12 salt rounds) | Stateless authentication |
| **Email** | Nodemailer (Gmail SMTP) | OTP, job alerts |
| **Job API** | RapidAPI (Naukri) | Job listing aggregation |
| **Deployment** | Vercel (frontend) + Render (backend) | Cloud hosting |

---

## 🧠 AI & ML Implementation

### 1. Placement Prediction — Random Forest (Pure TypeScript)

A complete Random Forest classifier implemented from scratch in TypeScript (~460 lines):

- **Training data**: `placementdata.csv` — 8,000+ historical student records
- **Features (10)**: CGPA, Internships, Projects, Workshops, Aptitude Score, Soft Skills Rating, Extracurricular, Placement Training, SSC Marks, HSC Marks
- **Algorithm**: 100 decision trees, Gini impurity splits, max depth 15, √features random subset
- **Output**: Placement probability (0–100%) + feature importance rankings
- **Key fact**: Model trains from CSV on first API call and caches in memory — zero Python dependency at runtime

### 2. AI Provider Chain (Auto-Fallback)

```
Gemini Key 1 → 429? → Gemini Key 2 → 429? → Groq Key 1 → 429? → Groq Key 2 → OpenRouter
```

- Auto-detects rate-limit errors (429, quota, 503, overloaded)
- Pools multiple API keys across services (up to 5 Gemini + 4 Groq)
- Ensures 99.9% AI availability even under heavy usage

### 3. Guardrails & Safety

- **15+ regex patterns** for prompt injection detection (jailbreak, DAN mode, ignore instructions, etc.)
- **Query sanitization**: Strip HTML/JS, normalize whitespace, cap at 2000 chars
- **Output validation**: Detect fabricated URLs, ungrounded statistics, missing source citations
- **Grounding enforcement**: System prompt forces LLM to cite `[Source N]` and never invent facts

### 4. Pre-Trained Python Models (Offline)

| Model | Algorithm | Dataset | Purpose |
|-------|-----------|---------|---------|
| Question Difficulty (×13) | TF-IDF → SVD → Random Forest | 13 domain CSVs | Classify question difficulty per domain |
| Resume Classifier | TF-IDF → LinearSVC | UpdatedResumeDataSet.csv | Classify resume category (25+ types) |

---

## 📚 RAG Pipeline (Advanced)

The Study Assistant uses a custom-built **12-step RAG pipeline**:

```
User Query
  → Step 1:  Guardrails (injection detection + sanitization)
  → Step 2:  Knowledge Base check (397 chunks in MongoDB)
  → Step 3:  Multi-Query Generation (LLM creates 3 query variations)
  → Step 4:  Embedding (Gemini embedding-001, 3072 dimensions)
  → Step 5:  Similarity Search (cosine similarity, threshold ≥ 0.25)
  → Step 6:  Re-Ranking (70% semantic + 30% keyword overlap)
  → Step 7:  Context Compression (top 3–5 chunks, ≤ 3000 chars)
  → Step 8:  Student Context (profile, scores, career path from DB)
  → Step 9:  Chat Memory (previous conversation turns)
  → Step 10: Grounded LLM Call (Gemini/Groq with strict system prompt)
  → Step 11: Output Validation (hallucination check, source citation)
  → Step 12: Final Response (answer + sources + confidence score)
```

**Extras**: LRU cache (100 entries, 10-min TTL), batch embedding with rate-limit delays, configurable threshold/topK.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- MongoDB Atlas account (free tier works)
- Google Gemini API key ([Get one here](https://aistudio.google.com/app/apikey))
- Groq API key ([Get one here](https://console.groq.com/keys))

### 1. Clone the Repository

```bash
git clone https://github.com/sudhher1s/PERSONALIZED-PLACEMENT-ASSISTANCE-SYSTEM.git
cd personalizedplacementasssistancesystem-main
```

### 2. Install Dependencies

```bash
# Frontend
npm install

# Backend
cd server
npm install
cd ..
```

### 3. Configure Environment Variables

Create `server/.env` (see [Environment Variables](#-environment-variables) section below).

### 4. Start Development Servers

```bash
# Terminal 1 — Backend (port 4000)
cd server
npm run dev

# Terminal 2 — Frontend (port 8080)
npm run dev
```

### 5. Open the App

Navigate to `http://localhost:8080` in your browser.

---

## 🔐 Environment Variables

Create a `server/.env` file with these keys:

```env
# ── Database ──
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/placement-prep

# ── Auth ──
JWT_SECRET=your-secret-key-here

# ── AI Providers (at least one Gemini + one Groq required) ──
GEMINI_API_KEY=your-gemini-api-key
STUDY_GEMINI_API_KEY=your-second-gemini-key
GROQ_API_KEY=your-groq-api-key
STUDY_GROQ_API_KEY=your-second-groq-key

# ── Optional: Additional AI keys for higher rate limits ──
GEMINI_API_KEY_2=optional-third-gemini-key
INTERVIEW_GEMINI_API_KEY=optional-interview-gemini-key
RESUME_GEMINI_API_KEY=optional-resume-gemini-key
INTERVIEW_GROQ_API_KEY=optional-interview-groq-key
GROQ_API_KEY_2=optional-second-groq-key
OPENROUTER_API_KEY=optional-openrouter-key

# ── Job Search (optional) ──
RAPIDAPI_KEY=your-rapidapi-key
NAUKRI_BASE_URL=https://naukri-com.p.rapidapi.com
NAUKRI_HOST=naukri-com.p.rapidapi.com

# ── Email Notifications (optional) ──
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# ── Server ──
PORT=4000
NODE_ENV=development
```

For the frontend, create a `.env` file in the project root (optional — defaults to localhost:4000):

```env
VITE_API_BASE=http://localhost:4000
```

---

## 📁 Project Structure

```
personalizedplacementasssistancesystem-main/
│
├── src/                              # 🌐 REACT WEB FRONTEND (18 pages)
│   ├── pages/
│   │   ├── Index.tsx                 # Landing page with hero + features
│   │   ├── Login.tsx                 # Student ID + password login
│   │   ├── Signup.tsx                # 4-step registration wizard
│   │   ├── Dashboard.tsx             # ML prediction, stats, quick actions
│   │   ├── Roadmap.tsx               # 12-week adaptive study plan
│   │   ├── Interview.tsx             # AI mock interview (3 modes)
│   │   ├── StudyAssistant.tsx        # RAG-powered chatbot
│   │   ├── LiveLearn.tsx             # Upload notes → Q&A from notes only
│   │   ├── Exam.tsx                  # Timed MCQ exams (4 types)
│   │   ├── CompanyPrep.tsx           # 40+ company prep with AI roadmaps
│   │   ├── ResumeAnalyzer.tsx        # ATS scoring + AI recommendations
│   │   ├── JobSearch.tsx             # Job search via Naukri API
│   │   ├── Profile.tsx               # Profile + gamification badges
│   │   ├── Leaderboard.tsx           # HP-based student rankings
│   │   └── AdminDashboard.tsx        # Admin analytics panel
│   ├── components/                   # Navbar, Footer, UI components
│   ├── context/                      # AuthContext, ThemeContext
│   ├── lib/api.ts                    # API client (50+ endpoints)
│   └── index.css                     # Design system (glassmorphism)
│
├── server/                           # 🔧 NODE.JS BACKEND
│   └── src/
│       ├── index.ts                  # Express entry point
│       ├── routes/                   # 16 REST API route files
│       │   ├── auth.ts               # Login, signup, forgot-password
│       │   ├── prediction.ts         # ML placement prediction
│       │   ├── studyAssistant.ts     # RAG chatbot endpoints
│       │   ├── interviewV2.ts        # AI interview (company/resume/weekly)
│       │   ├── roadmap.ts            # Roadmap CRUD + tests
│       │   ├── exams.ts              # MCQ exam endpoints
│       │   ├── resumeAnalyzer.ts     # ATS analysis endpoints
│       │   ├── knowledge.ts          # Live Learn upload + chat
│       │   ├── jobs.ts               # Job search
│       │   └── ...                   # alerts, activity, admin, ai, meta
│       ├── services/                 # 24 business logic modules
│       │   ├── aiChain.ts            # Multi-provider LLM fallback
│       │   ├── ragPipeline.ts        # 12-step RAG pipeline (500 lines)
│       │   ├── guardrails.ts         # Prompt injection + output validation
│       │   ├── placementModel.ts     # Pure-TS Random Forest (460 lines)
│       │   ├── resumeAnalyzer.ts     # ATS engine (920 lines, 150+ skills)
│       │   ├── personalization.ts    # Skill gap analysis + daily tasks
│       │   ├── gamification.ts       # HP, streaks, badges logic
│       │   ├── alertEngine.ts        # Smart automated alerts
│       │   ├── roadmapGenerator.ts   # 12-week plan from skills CSV
│       │   ├── questionBank.ts       # CSV question loader
│       │   └── ...                   # studyRag, jobSearch, mailer, youtube
│       ├── models/                   # 17 Mongoose schemas
│       └── middleware/auth.ts        # JWT verification
│
├── PlacementApp/                     # 📱 REACT NATIVE MOBILE APP
│   ├── app/(auth)/                   # Login, signup, forgot-password
│   ├── app/(tabs)/                   # Dashboard, exams, study, profile, jobs
│   └── app/                          # Exam, resume-ats, study-assistant
│
├── ml/                               # 🤖 MACHINE LEARNING (Python)
│   ├── train_models.py               # Question difficulty RF training
│   ├── train_resume_model.py         # Resume TF-IDF + LinearSVC
│   └── models/                       # 17 trained .joblib artifacts
│
├── datasets/                         # 📊 QUESTION DATASETS (15 CSVs)
│   ├── dsa_questions.csv
│   ├── artificial_intelligence_questions.csv
│   ├── job_domain_skills_dataset.csv  # 4.6 MB skills dataset for roadmap
│   └── ...                           # 12 more domain-specific CSVs
│
├── lunchpad/                         # 📋 LEETCODE COMPANY DATA (40+ CSVs)
├── placementdata.csv                 # 📈 8000+ student placement records
└── Placement_Assistance_RAG_System.pdf  # 📄 RAG knowledge base document
```

---

## 🔌 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new student (4-step profile) |
| POST | `/api/auth/login` | Login with student ID + password |
| GET | `/api/auth/me` | Get current user profile |
| PATCH | `/api/auth/profile` | Update profile |
| POST | `/api/auth/forgot-password` | Send OTP to email |
| POST | `/api/auth/reset-password` | Reset password with OTP |

### ML & AI
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/prediction/placement` | ML placement probability prediction |
| POST | `/api/study-assistant/chat` | RAG-powered study chatbot |
| POST | `/api/ai/chat` | General AI chat (Gemini/Groq) |
| GET | `/api/study-assistant/rag-status` | RAG index status |
| POST | `/api/study-assistant/personalization` | Skill gap analysis |

### Interviews
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/interview-v2/companies` | List 40+ companies with question counts |
| POST | `/api/interview-v2/resume-upload` | Upload resume for interview |
| POST | `/api/interview-v2/resume-questions` | Generate resume-based questions |
| POST | `/api/interview-v2/company-prep` | AI company prep roadmap |
| POST | `/api/interview-v2/save-session` | Save interview session |

### Roadmap & Exams
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/roadmap` | Get 12-week roadmap |
| POST | `/api/roadmap/days/complete` | Mark day complete |
| GET | `/api/roadmap/weeks/:week/test` | Get weekly test questions |
| GET | `/api/exams/:type/questions` | Get exam questions |
| POST | `/api/exams/submit` | Submit exam answers |

### Resume & Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/resume/analyze` | ATS resume analysis (multipart) |
| GET | `/api/jobs/search` | Search jobs via Naukri |
| POST | `/api/knowledge/upload` | Upload notes for Live Learn |
| POST | `/api/knowledge/chat` | Chat with uploaded notes |

---

## 📊 Datasets & Models

### Question Datasets (15 files)

| Domain | File | Questions |
|--------|------|-----------|
| DSA | `dsa_questions.csv` | ~500+ |
| Aptitude | `quantitative_aptitude_questions.csv` | ~500+ |
| Soft Skills | `soft_skills_questions.csv` | ~500+ |
| Full Stack | `full_stack_development_questions.csv` | ~500+ |
| Data Science | `data_science_questions.csv` | ~500+ |
| Machine Learning | `machine_learning_questions.csv` | ~500+ |
| AI | `artificial_intelligence_questions.csv` | ~500+ |
| Generative AI | `generative_ai_questions.csv` | ~500+ |
| Cybersecurity | `cybersecurity_questions.csv` | ~500+ |
| Blockchain | `blockchain_development_questions.csv` | ~500+ |
| IoT | `iot_development_questions.csv` | ~500+ |
| Cloud/DevOps | `cloud_computing_devops_questions.csv` | ~500+ |
| Mobile Dev | `mobile_app_development_questions.csv` | ~500+ |
| AR/VR | `ar_vr_development_questions.csv` | ~500+ |
| Skills Roadmap | `job_domain_skills_dataset.csv` | 20,000+ skills |

### Trained Models (17 files)

- 13 domain-specific Random Forest classifiers (`.joblib`)
- 1 Resume classifier pipeline (TF-IDF + LinearSVC)
- 1 Resume label encoder
- 1 Resume categories mapping

---

## 🌐 Deployment

| Component | Platform | URL |
|-----------|----------|-----|
| Frontend | Vercel | `placeprep-ten.vercel.app` |
| Backend | Render | Auto-deploys from GitHub |
| Database | MongoDB Atlas | Cloud cluster (free tier) |
| Mobile | Expo Build | Android APK via EAS |

### Deploy Your Own

**Frontend (Vercel):**
```bash
npm run build
# Deploy dist/ folder to Vercel
```

**Backend (Render):**
- Connect GitHub repo → set root directory to `server/`
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Add all environment variables

---

## 📈 Project Stats

| Metric | Count |
|--------|-------|
| Source files | 120+ TypeScript/TSX |
| Backend services | 24 modules |
| API endpoints | 50+ |
| Database models | 17 collections |
| Frontend pages | 18 (web) + 12 (mobile) |
| ML models | 15 trained artifacts |
| Question datasets | 15 CSV files |
| Company data | 40+ LeetCode CSVs |
| Skills in ATS DB | 150+ with pattern matching |
| RAG embedding dims | 3072 (Gemini) |
| Career paths | 11 supported |

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m "Add amazing feature"`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

This project is built for educational purposes as part of a B.Tech final year project.

---

<p align="center">
  Built with ❤️ for Indian engineering students
</p>
