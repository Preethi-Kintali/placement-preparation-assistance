# PlacePrep Server

Backend for the Placement Assistance System.

## Setup

1. Copy env file:
   - `server/.env.example` -> `server/.env`

2. Fill in:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - optional: `YOUTUBE_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`

3. Install deps:
   - `cd server`
   - `npm install`

4. Run dev server:
   - `npm run dev`

Health check:
- `GET http://localhost:4000/health`

## API (current)

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/exams/status`
- `GET /api/exams/:examType/questions?count=15&labelCol=Level&labelValue=Beginner`
- `POST /api/exams/submit`
- `GET /api/roadmap`
- `GET /api/admin/stats` (admin only)

Note: AI + YouTube endpoints are scaffolded but not implemented yet.
