import type { ResumeData, Questions, Evaluation, CompanyProfile } from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "http://127.0.0.1:8000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      message = body.detail || body.message || message;
    } catch {
      // ignore json parse errors and keep fallback message
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function fetchCompanies(): Promise<CompanyProfile[]> {
  return apiFetch<CompanyProfile[]>("/api/companies");
}

export async function createSession(difficulty: string): Promise<string> {
  const data = await apiFetch<{ id: string }>("/api/sessions", {
    method: "POST",
    body: JSON.stringify({ difficulty }),
  });
  return data.id;
}

export async function parseResume(file: File): Promise<ResumeData> {
  // Resume parsing is optional in local mode; return a minimal profile.
  return {
    name: file.name,
    skills: [],
    projects: [],
    experience: [],
    education: [],
  };
}

export async function generateQuestions(
  resumeData: ResumeData,
  company: string,
  difficulty: string
): Promise<Questions> {
  return apiFetch<Questions>("/api/questions", {
    method: "POST",
    body: JSON.stringify({ resumeData, company, difficulty }),
  });
}

export async function evaluateAnswer(
  question: string,
  answer: string
): Promise<Evaluation> {
  return apiFetch<Evaluation>("/api/evaluate", {
    method: "POST",
    body: JSON.stringify({ question, answer }),
  });
}

export async function generateRoadmap(
  evaluations: Evaluation[],
  company: string,
  resumeData: ResumeData
): Promise<string> {
  const data = await apiFetch<{ roadmap: string }>("/api/roadmap", {
    method: "POST",
    body: JSON.stringify({ evaluations, company, resumeData }),
  });
  return data.roadmap as string;
}

export async function updateSession(
  sessionId: string,
  updates: Record<string, unknown>
) {
  await apiFetch<{ status: string }>(`/api/sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify({ updates }),
  });
}
