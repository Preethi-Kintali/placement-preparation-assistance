# Resume ATS Analyzer Prototype

Minimal standalone prototype using Node.js + Express backend and React + Tailwind frontend.

## Structure

- `backend/` API and ATS pipeline
- `frontend/` standalone UI page (`src/ResumeATS.jsx`)
- `software_resumes_1000.csv` and `software_job_descriptions_1000.csv` are used by backend scoring logic

## Backend Features

- `POST /api/analyze`
- Form-data fields:
  - `resumePdf` (required)
  - `jobDescriptionPdf` (optional)
- PDF parsing via `pdf-parse`
- Text preprocessing (lowercase, punctuation removal, stopword removal, tokenization)
- Skill extraction and comparison using predefined technical skill list
- TF-IDF + cosine similarity using `natural` and `compute-cosine-similarity`
- Trained ML vector model pipeline built from both datasets (`software_resumes_1000.csv`, `software_job_descriptions_1000.csv`)
- ATS score calculation:
  - With JD: `0.6 * skillMatchScore + 0.4 * semanticScore`
  - Without JD: score from section coverage, keyword richness, and structure/length quality
- Recommendations generation

## Frontend Features

- Single page: `ResumeATS.jsx`
- Upload Resume PDF and optional JD PDF
- Analyze button
- Displays ATS score, semantic similarity, matched/missing/extra skills, and recommendations

## Run Locally

### 1) Backend

```powershell
cd backend
npm install
npm run train:model
npm run dev
```

Backend default port: `5000`

### 2) Frontend

```powershell
cd ../frontend
npm install
npm run dev
```

Frontend default port: `5173`

## Notes

- Max upload size is 7 MB per file.
- Endpoint validates PDF mimetype.
- CORS enabled for local prototype development.
- This prototype uses a trained TF-IDF vector model persisted at `backend/src/models/ats-model.json`.
- Datasets are used to train vocabulary, IDF weights, centroids, and similarity normalization ranges.
- Optional Gemini recommendations: set `GEMINI_API_KEY` before starting backend.

### Optional Gemini Setup (Windows PowerShell)

```powershell
$env:GEMINI_API_KEY="your_key_here"
cd backend
npm run dev
```
