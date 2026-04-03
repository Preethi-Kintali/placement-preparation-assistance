from __future__ import annotations

from collections import Counter
from pathlib import Path
from typing import Any
from uuid import uuid4
import re

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.data_loader import discover_dataset_root, load_company_question_bank
from src.interview_model import DIFFICULTY_TO_LEVEL


STOP_WORDS = {
    "the",
    "a",
    "an",
    "to",
    "of",
    "in",
    "and",
    "or",
    "for",
    "with",
    "on",
    "is",
    "are",
    "you",
    "your",
    "this",
    "that",
    "from",
    "using",
}

PROJECT_HINT_WORDS = {
    "design",
    "system",
    "api",
    "service",
    "database",
    "cache",
    "scalable",
    "distributed",
    "architecture",
    "stream",
    "queue",
    "graph",
}


class SessionCreateRequest(BaseModel):
    difficulty: str = "Medium"


class SessionUpdateRequest(BaseModel):
    updates: dict[str, Any] = Field(default_factory=dict)


class QuestionsRequest(BaseModel):
    company: str
    difficulty: str = "Medium"
    resumeData: dict[str, Any] | None = None


class EvaluateRequest(BaseModel):
    question: str
    answer: str


class EvalItem(BaseModel):
    question: str
    answer: str
    score: float
    feedback: str
    improvement: str


class RoadmapRequest(BaseModel):
    evaluations: list[EvalItem]
    company: str
    resumeData: dict[str, Any] | None = None


app = FastAPI(title="Company Interview API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_dataset_root = discover_dataset_root(Path(__file__).resolve().parents[1])
_df = load_company_question_bank(_dataset_root)
_company_map = {company: subset.reset_index(drop=True) for company, subset in _df.groupby("Company", sort=True)}
_sessions: dict[str, dict[str, Any]] = {}


def _normalize_company_name(name: str) -> str:
    return name.strip().lower().replace(" ", "-")


def _difficulty_value(difficulty: str) -> int:
    return DIFFICULTY_TO_LEVEL.get(difficulty.strip().title(), 2)


def _tokenize(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-zA-Z]{3,}", text.lower()) if t not in STOP_WORDS]


def _top_focus_areas(company: str) -> list[str]:
    subset = _company_map.get(company)
    if subset is None or subset.empty:
        return ["DSA"]
    tokens: list[str] = []
    for title in subset["Title"].head(150).tolist():
        tokens.extend(_tokenize(str(title)))
    common = [w for w, _ in Counter(tokens).most_common(4)]
    return common or ["arrays", "graphs", "dynamic-programming"]


def _company_difficulty(company: str) -> str:
    subset = _company_map.get(company)
    if subset is None or subset.empty:
        return "Medium"
    levels = subset["Difficulty"].map(DIFFICULTY_TO_LEVEL).fillna(2)
    avg = float(levels.mean())
    if avg >= 2.4:
        return "Hard"
    if avg <= 1.6:
        return "Easy"
    return "Medium"


def _question_buckets(company: str, difficulty: str) -> tuple[list[str], list[str], list[str]]:
    subset = _company_map.get(company)
    if subset is None or subset.empty:
        return [], [], []

    target = _difficulty_value(difficulty)
    scoped = subset.copy()
    scoped["Level"] = scoped["Difficulty"].map(DIFFICULTY_TO_LEVEL).fillna(2).astype(int)
    scoped["gap"] = (scoped["Level"] - target).abs()
    scoped = scoped.sort_values(["gap", "Frequency"], ascending=[True, False]).reset_index(drop=True)

    technical: list[str] = []
    project: list[str] = []
    seen: set[str] = set()

    for _, row in scoped.iterrows():
        title = str(row["Title"]).strip()
        lowered = title.lower()
        if not title or lowered in seen:
            continue
        seen.add(lowered)
        if any(word in lowered for word in PROJECT_HINT_WORDS):
            if len(project) < 3:
                project.append(title)
        elif len(technical) < 6:
            technical.append(title)
        if len(technical) >= 6 and len(project) >= 3:
            break

    if len(project) < 2:
        extras = [q for q in technical if q not in project][: 2 - len(project)]
        project.extend(extras)

    behavioral = [
        f"Tell me about a challenging problem you solved and how your approach matches {company.title()}'s engineering style.",
        f"Describe a time you received critical feedback and improved your implementation quality for a {company.title()}-like interview bar.",
        f"How would you explain trade-offs and edge cases to an interviewer at {company.title()}?",
    ]

    return technical[:6], project[:3], behavioral


def _evaluate_answer(question: str, answer: str) -> tuple[float, str, str]:
    q_tokens = set(_tokenize(question))
    a_tokens = set(_tokenize(answer))
    if not answer.strip():
        return 1.0, "No meaningful answer detected.", "State your approach first, then add complexity and edge cases."

    coverage = 0.0
    if q_tokens:
        coverage = len(q_tokens.intersection(a_tokens)) / len(q_tokens)

    word_count = max(1, len(answer.split()))
    length_score = min(1.0, word_count / 110)
    structure_bonus = 0.0
    answer_lower = answer.lower()
    for cue in ["approach", "complexity", "time", "space", "edge", "trade-off", "test"]:
        if cue in answer_lower:
            structure_bonus += 0.1

    score = 2.0 + (coverage * 4.5) + (length_score * 2.5) + min(1.0, structure_bonus)
    score = round(max(1.0, min(10.0, score)), 1)

    if score >= 8.0:
        feedback = "Strong answer with good structure and relevant technical depth."
        improvement = "Sharpen with one concrete optimization or constraint trade-off."
    elif score >= 6.0:
        feedback = "Good baseline answer that covers core parts of the question."
        improvement = "Add clearer complexity analysis and explicitly discuss edge cases."
    else:
        feedback = "Partial answer; important parts are missing or under-explained."
        improvement = "Use a step-by-step format: idea, algorithm, complexity, edge cases, and tests."

    return score, feedback, improvement


def _build_roadmap(evaluations: list[EvalItem], company: str) -> str:
    if not evaluations:
        return "## 2-Week Plan\n\nNo evaluations available yet. Start with 3 company-specific questions daily."

    avg = sum(e.score for e in evaluations) / len(evaluations)
    weak = [e for e in evaluations if e.score < 6.5]

    weak_topics: list[str] = []
    for item in weak[:4]:
        weak_topics.extend(_tokenize(item.question))
    focus = [w for w, _ in Counter(weak_topics).most_common(5)] or ["arrays", "graphs", "dp"]

    intensity = "high" if avg < 6 else "moderate" if avg < 8 else "advanced"

    return f"""## {company.title()} Interview Prep Roadmap (2 Weeks)

### Performance Snapshot
- Average score: **{avg:.1f}/10**
- Practice intensity: **{intensity}**
- Priority topics: **{', '.join(focus)}**

### Week 1
- Day 1-2: Revisit fundamentals for {focus[0]} and {focus[1] if len(focus) > 1 else focus[0]}.
- Day 3-4: Solve 4 timed medium questions from {company.title()} question list.
- Day 5: 1 mock round (45 min) + written post-mortem.
- Day 6-7: Strengthen weak patterns and repeat top missed question types.

### Week 2
- Day 8-9: Mixed set of medium-hard questions with strict time limits.
- Day 10: Explain 3 solved questions aloud (communication round simulation).
- Day 11-12: Company-style mock interview: approach + complexity + edge cases.
- Day 13: Review all incorrect answers and create a quick revision sheet.
- Day 14: Final mock and readiness check.

### Daily Interview Answer Template
1. Clarify assumptions.
2. Explain brute-force and optimized approach.
3. State time and space complexity.
4. Cover edge cases.
5. Summarize trade-offs.
"""


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/companies")
def companies() -> list[dict[str, Any]]:
    response: list[dict[str, Any]] = []
    for company in sorted(_company_map.keys()):
        response.append(
            {
                "id": company,
                "name": company.replace("-", " ").replace("_", " ").title(),
                "focus_areas": _top_focus_areas(company),
                "behavioral_model": "STAR",
                "difficulty": _company_difficulty(company),
            }
        )
    return response


@app.post("/api/sessions")
def create_session(payload: SessionCreateRequest) -> dict[str, str]:
    session_id = str(uuid4())
    _sessions[session_id] = {
        "difficulty": payload.difficulty.title(),
        "status": "created",
    }
    return {"id": session_id}


@app.patch("/api/sessions/{session_id}")
def update_session(session_id: str, payload: SessionUpdateRequest) -> dict[str, str]:
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    _sessions[session_id].update(payload.updates)
    return {"status": "updated"}


@app.post("/api/questions")
def generate_questions(payload: QuestionsRequest) -> dict[str, list[str]]:
    company_key = _normalize_company_name(payload.company)
    if company_key not in _company_map:
        raise HTTPException(status_code=404, detail=f"Unknown company: {payload.company}")

    technical, project, behavioral = _question_buckets(company_key, payload.difficulty)
    if not technical and not project:
        raise HTTPException(status_code=500, detail="Unable to generate questions from dataset")

    return {
        "technical": technical,
        "project": project,
        "behavioral": behavioral,
    }


@app.post("/api/evaluate")
def evaluate(payload: EvaluateRequest) -> dict[str, Any]:
    score, feedback, improvement = _evaluate_answer(payload.question, payload.answer)
    return {
        "question": payload.question,
        "answer": payload.answer,
        "score": score,
        "feedback": feedback,
        "improvement": improvement,
    }


@app.post("/api/roadmap")
def generate_roadmap(payload: RoadmapRequest) -> dict[str, str]:
    roadmap = _build_roadmap(payload.evaluations, _normalize_company_name(payload.company))
    return {"roadmap": roadmap}
