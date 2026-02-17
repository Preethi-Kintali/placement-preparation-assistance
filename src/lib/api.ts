const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export type ApiError = { error: string } | { error: string; details?: string } | any;

export function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

export function setToken(token: string) {
  localStorage.setItem("auth_token", token);
}

export function clearToken() {
  localStorage.removeItem("auth_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(options.headers as any),
  };
  if (token) headers["authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw data;
  return data as T;
}

export const api = {
  metaCareerPaths: () => request<{ careerPaths: string[] }>("/api/meta/career-paths"),

  signup: (payload: any) => request<{ token: string; user: any }>("/api/auth/signup", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload: any) => request<{ token: string; user: any }>("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request<any>("/api/auth/me"),
  updateProfile: (payload: any) => request<any>("/api/auth/profile", { method: "PATCH", body: JSON.stringify(payload) }),

  examStatus: () => request<any>("/api/exams/status"),
  examQuestions: (examType: string, count = 15) => request<any>(`/api/exams/${examType}/questions?count=${count}`),
  careerQuestions: (count = 15) => request<any>(`/api/exams/career/questions?count=${count}`),
  submitExam: (payload: any) => request<any>("/api/exams/submit", { method: "POST", body: JSON.stringify(payload) }),

  roadmap: () => request<any>("/api/roadmap"),
  roadmapCompleteDay: (week: number, day: number) => request<any>("/api/roadmap/days/complete", { method: "POST", body: JSON.stringify({ week, day }) }),
  roadmapWeeklyTestQuestions: (week: number) => request<any>(`/api/roadmap/weeks/${week}/test`),
  roadmapWeeklyTestSubmit: (week: number, payload: any) => request<any>(`/api/roadmap/weeks/${week}/test/submit`, { method: "POST", body: JSON.stringify(payload) }),
  roadmapCheckNewTech: () => request<any>("/api/roadmap/check-new-tech", { method: "POST" }),
  roadmapGrandTest: () => request<any>("/api/roadmap/grand-test"),
  roadmapGrandTestSubmit: (payload: any) => request<any>("/api/roadmap/grand-test/submit", { method: "POST", body: JSON.stringify(payload) }),
  roadmapCertificate: () => request<any>("/api/roadmap/certificate"),
  roadmapResources: (topic: string, maxResults = 3) => request<any>(`/api/roadmap/resources?topic=${encodeURIComponent(topic)}&maxResults=${maxResults}`),
  roadmapTopicInfo: (topic: string) => request<any>("/api/roadmap/topic-info", { method: "POST", body: JSON.stringify({ topic }) }),

  interviewHealth: () => request<any>("/api/interview/health"),
  interviewContext: () => request<any>("/api/interview/context"),
  interviewQuestions: () => request<any>("/api/interview/questions"),
  interviewScore: (payload: { topic: string; question: string; answer: string }) =>
    request<any>("/api/interview/score", { method: "POST", body: JSON.stringify(payload) }),
  interviewSessions: () => request<any>("/api/interview/sessions"),
  interviewSaveSession: (payload: any) => request<any>("/api/interview/sessions", { method: "POST", body: JSON.stringify(payload) }),
  interviewRoundQuestions: (roundIndex: number) => request<any>(`/api/interview/round-questions?roundIndex=${roundIndex}`),
  interviewAsk: (payload: any) => request<any>("/api/interview/ask", { method: "POST", body: JSON.stringify(payload) }),

  placementPrediction: () => request<any>("/api/prediction/placement"),

  adminStudents: () => request<any>("/api/admin/students"),
  adminStats: () => request<any>("/api/admin/stats"),
  adminGenerateRequirements: (userId: string) => request<any>(`/api/admin/requirements/${userId}`, { method: "POST" }),
  adminStudentRoadmap: (userId: string) => request<any>(`/api/admin/students/${userId}/roadmap`),
  adminStudentResults: (userId: string) => request<any>(`/api/admin/students/${userId}/results`),
  adminPlacementReport: () => request<any>("/api/admin/ml/placement-report"),

  aiChat: (provider: "groq" | "gemini", message: string) =>
    request<any>("/api/ai/chat", { method: "POST", body: JSON.stringify({ provider, message }) }),

  studyChat: (payload: { provider: "groq" | "gemini"; message: string; history?: Array<{ role: "user" | "assistant"; content: string }> }) =>
    request<any>("/api/ai/study/chat", { method: "POST", body: JSON.stringify(payload) }),
  studyContext: () => request<any>("/api/ai/study/context"),
  studySessions: (limit = 10) => request<any>(`/api/ai/study/sessions?limit=${limit}`),
};
