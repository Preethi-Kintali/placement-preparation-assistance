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

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw { error: "Cannot reach backend server. Start the backend on http://localhost:4000." };
  }

  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) throw data ?? { error: `Request failed (${res.status})` };
  return data as T;
}

export const api = {
  metaCareerPaths: () => request<{ careerPaths: string[] }>("/api/meta/career-paths"),

  signup: (payload: any) => request<{ token: string; user: any }>("/api/auth/signup", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload: any) => request<{ token: string; user: any }>("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request<any>("/api/auth/me"),
  updateProfile: (payload: any) => request<any>("/api/auth/profile", { method: "PATCH", body: JSON.stringify(payload) }),
  forgotPassword: (email: string) => request<{ ok: boolean; message: string }>("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  verifyOtp: (email: string, otp: string) => request<{ valid: boolean }>("/api/auth/verify-otp", { method: "POST", body: JSON.stringify({ email, otp }) }),
  resetPassword: (email: string, otp: string, newPassword: string) => request<{ ok: boolean; message: string }>("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ email, otp, newPassword }) }),

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

  studyChat: (payload: {
    provider: "groq" | "gemini";
    message: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    threadId?: string;
    useMultiQuery?: boolean;
  }) =>
    request<any>("/api/study-assistant/chat", { method: "POST", body: JSON.stringify(payload) }),
  studyContext: () => request<any>("/api/study-assistant/context"),
  studySessions: (limit = 10) => request<any>(`/api/study-assistant/sessions?limit=${limit}`),
  studyThreads: () => request<any>("/api/study-assistant/threads"),
  ragStatus: () => request<any>("/api/study-assistant/rag-status"),
  ragSources: (query: string, topK = 5) =>
    request<any>("/api/study-assistant/rag-sources", { method: "POST", body: JSON.stringify({ query, topK }) }),
  clearRagCache: () => request<any>("/api/study-assistant/clear-cache", { method: "POST" }),

  // ── Personalization ──
  personalization: () => request<any>("/api/study-assistant/personalization"),

  // ── Smart Alerts ──
  alerts: (unread = false) => request<any>(`/api/alerts?unread=${unread}`),
  alertsCount: () => request<any>("/api/alerts/count"),
  alertsCheck: () => request<any>("/api/alerts/check", { method: "POST" }),
  alertMarkRead: (id: string) => request<any>(`/api/alerts/${id}/read`, { method: "PATCH" }),
  alertsMarkAllRead: () => request<any>("/api/alerts/read-all", { method: "PATCH" }),

  // ── Knowledge Base ──
  knowledgeDocuments: () => request<any>("/api/knowledge/documents"),
  knowledgeStatus: () => request<any>("/api/knowledge/status"),
  knowledgeEvaluation: () => request<any>("/api/knowledge/evaluation"),
  knowledgeDelete: (source: string) => request<any>(`/api/knowledge/${encodeURIComponent(source)}`, { method: "DELETE" }),
  knowledgeUpload: async (file: File, tags?: string) => {
    const token = getToken();
    const form = new FormData();
    form.append("file", file);
    if (tags) form.append("tags", tags);
    const headers: Record<string, string> = {};
    if (token) headers["authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/api/knowledge/upload`, {
      method: "POST",
      headers,
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  },

  activitySummary: () => request<any>("/api/activity/summary"),
  dailyLearningSubmit: (text: string) =>
    request<any>("/api/activity/daily-learning", { method: "POST", body: JSON.stringify({ text }) }),
  newTechLearnedSubmit: (tech: string) =>
    request<any>("/api/activity/new-tech", { method: "POST", body: JSON.stringify({ tech }) }),
  leaderboard: (careerPath?: string) =>
    request<any>(`/api/activity/leaderboard${careerPath ? `?careerPath=${encodeURIComponent(careerPath)}` : ""}`),

  // ── Job Search ──
  jobRoles: (q: string) => request<{ query: string; roles: string[] }>(`/api/jobs/roles?q=${encodeURIComponent(q)}`),
  jobSearch: (role: string) => request<{ role: string; count: number; jobs: any[]; source: string }>(`/api/jobs/search?role=${encodeURIComponent(role)}`),

  // ── Resume ATS Analyzer ──
  resumeAnalyze: async (resumeFile: File, jdFile?: File | null) => {
    const token = getToken();
    const form = new FormData();
    form.append("resume", resumeFile);
    if (jdFile) form.append("jd", jdFile);
    const headers: Record<string, string> = {};
    if (token) headers["authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/api/resume/analyze`, {
      method: "POST",
      headers,
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  },
  resumeHistory: () => request<any>("/api/resume/history"),
};
