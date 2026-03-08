# Job Search Module (Standalone)

Standalone module with:
- Role input textbox
- Fetch jobs from RapidAPI (JSearch)
- Optional role suggestions from Naukri discovery endpoint

## 1) Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env example:
   ```bash
   copy .env.example .env
   ```
3. Put your `RAPIDAPI_KEY` in `.env`.
4. Start server:
   ```bash
   npm start
   ```
5. Open:
   - `http://localhost:5001`

## 2) API Endpoints

- `GET /api/roles?q=full stack`
- `GET /api/jobs?role=full stack developer`

## 3) Integration into MERN app later

- Move `server.js` route handlers into your existing backend routes.
- Reuse frontend form logic from `public/app.js` in your React component.

## 4) Security

- Never hardcode API keys.
- Keep `.env` private.
- If key was shared publicly, regenerate it in RapidAPI dashboard.
