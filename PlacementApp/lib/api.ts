import AsyncStorage from '@react-native-async-storage/async-storage';

// Production backend on Render
const API_BASE = 'https://placeprep-api.onrender.com';

export async function getToken(): Promise<string | null> {
    return AsyncStorage.getItem('auth_token');
}
export async function setToken(token: string) {
    await AsyncStorage.setItem('auth_token', token);
}
export async function clearToken() {
    await AsyncStorage.removeItem('auth_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await getToken();
    const headers: Record<string, string> = {
        'content-type': 'application/json',
        ...(options.headers as any),
    };
    if (token) headers['authorization'] = `Bearer ${token}`;

    let res: Response;
    try {
        res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    } catch {
        throw { error: `Cannot reach backend server. Make sure backend is running on ${API_BASE}` };
    }

    const text = await res.text();
    let data: any = null;
    if (text) {
        try { data = JSON.parse(text); }
        catch { data = { error: text }; }
    }
    if (!res.ok) throw data ?? { error: `Request failed (${res.status})` };
    return data as T;
}

export const api = {
    // ── Meta ──
    metaCareerPaths: () => request<{ careerPaths: string[] }>('/api/meta/career-paths'),

    // ── Auth ──
    signup: (payload: any) => request<{ token: string; user: any }>('/api/auth/signup', { method: 'POST', body: JSON.stringify(payload) }),
    login: (payload: any) => request<{ token: string; user: any }>('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
    me: () => request<any>('/api/auth/me'),
    updateProfile: (payload: any) => request<any>('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(payload) }),
    forgotPassword: (email: string) => request<{ ok: boolean; message: string }>('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    verifyOtp: (email: string, otp: string) => request<{ valid: boolean }>('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email, otp }) }),
    resetPassword: (email: string, otp: string, newPassword: string) => request<{ ok: boolean; message: string }>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, otp, newPassword }) }),

    // ── Exams ──
    examStatus: () => request<any>('/api/exams/status'),
    examQuestions: (examType: string, count = 15) => request<any>(`/api/exams/${examType}/questions?count=${count}`),
    careerQuestions: (count = 15) => request<any>(`/api/exams/career/questions?count=${count}`),
    submitExam: (payload: any) => request<any>('/api/exams/submit', { method: 'POST', body: JSON.stringify(payload) }),

    // ── Roadmap ──
    roadmap: () => request<any>('/api/roadmap'),
    roadmapCompleteDay: (week: number, day: number) => request<any>('/api/roadmap/days/complete', { method: 'POST', body: JSON.stringify({ week, day }) }),
    roadmapWeeklyTestQuestions: (week: number) => request<any>(`/api/roadmap/weeks/${week}/test`),
    roadmapWeeklyTestSubmit: (week: number, payload: any) => request<any>(`/api/roadmap/weeks/${week}/test/submit`, { method: 'POST', body: JSON.stringify(payload) }),
    roadmapCheckNewTech: () => request<any>('/api/roadmap/check-new-tech', { method: 'POST' }),
    roadmapGrandTest: () => request<any>('/api/roadmap/grand-test'),
    roadmapGrandTestSubmit: (payload: any) => request<any>('/api/roadmap/grand-test/submit', { method: 'POST', body: JSON.stringify(payload) }),
    roadmapCertificate: () => request<any>('/api/roadmap/certificate'),
    roadmapResources: (topic: string, maxResults = 3) => request<any>(`/api/roadmap/resources?topic=${encodeURIComponent(topic)}&maxResults=${maxResults}`),
    roadmapTopicInfo: (topic: string) => request<any>('/api/roadmap/topic-info', { method: 'POST', body: JSON.stringify({ topic }) }),

    // ── Interview ──
    interviewHealth: () => request<any>('/api/interview/health'),
    interviewContext: () => request<any>('/api/interview/context'),
    interviewQuestions: () => request<any>('/api/interview/questions'),
    interviewScore: (payload: { topic: string; question: string; answer: string }) =>
        request<any>('/api/interview/score', { method: 'POST', body: JSON.stringify(payload) }),
    interviewSessions: () => request<any>('/api/interview/sessions'),
    interviewSaveSession: (payload: any) => request<any>('/api/interview/sessions', { method: 'POST', body: JSON.stringify(payload) }),
    interviewRoundQuestions: (roundIndex: number) => request<any>(`/api/interview/round-questions?roundIndex=${roundIndex}`),
    interviewAsk: (payload: any) => request<any>('/api/interview/ask', { method: 'POST', body: JSON.stringify(payload) }),

    // ── Prediction ──
    placementPrediction: () => request<any>('/api/prediction/placement'),

    // ── AI Study ──
    studyChat: (payload: { provider: 'groq' | 'gemini'; message: string; history?: Array<{ role: 'user' | 'assistant'; content: string }> }) =>
        request<any>('/api/ai/study/chat', { method: 'POST', body: JSON.stringify(payload) }),
    studyContext: () => request<any>('/api/ai/study/context'),
    studySessions: (limit = 10) => request<any>(`/api/ai/study/sessions?limit=${limit}`),

    // ── Activity & Gamification ──
    activitySummary: () => request<any>('/api/activity/summary'),
    dailyLearningSubmit: (text: string) =>
        request<any>('/api/activity/daily-learning', { method: 'POST', body: JSON.stringify({ text }) }),
    newTechLearnedSubmit: (tech: string) =>
        request<any>('/api/activity/new-tech', { method: 'POST', body: JSON.stringify({ tech }) }),
    leaderboard: (careerPath?: string) =>
        request<any>(`/api/activity/leaderboard${careerPath ? `?careerPath=${encodeURIComponent(careerPath)}` : ''}`),

    // ── Job Search ──
    jobRoles: (q: string) => request<{ query: string; roles: string[] }>(`/api/jobs/roles?q=${encodeURIComponent(q)}`),
    jobSearch: (role: string) => request<{ role: string; count: number; jobs: any[]; source: string }>(`/api/jobs/search?role=${encodeURIComponent(role)}`),

    // ── Resume ATS Analyzer ──
    resumeAnalyze: async (resumeUri: string, resumeName: string, jdUri?: string, jdName?: string) => {
        const token = await getToken();
        const form = new FormData();
        form.append('resume', { uri: resumeUri, name: resumeName, type: 'application/pdf' } as any);
        if (jdUri && jdName) {
            form.append('jd', { uri: jdUri, name: jdName, type: 'application/pdf' } as any);
        }
        const headers: Record<string, string> = {};
        if (token) headers['authorization'] = `Bearer ${token}`;
        const res = await fetch(`${API_BASE}/api/resume/analyze`, {
            method: 'POST',
            headers,
            body: form,
        });
        const text = await res.text();
        let data: any = null;
        if (text) {
            try { data = JSON.parse(text); }
            catch { data = { error: text }; }
        }
        if (!res.ok) throw data ?? { error: `Request failed (${res.status})` };
        return data;
    },
    resumeHistory: () => request<any>('/api/resume/history'),
};
