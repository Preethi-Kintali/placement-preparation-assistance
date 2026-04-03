import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Volume2, Upload, Building2, FileText, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";

type InterviewQuestion = { topic: string; question: string };
type ChatMessage = { role: "ai" | "user"; text: string };
type AnswerRecord = { topic: string; question: string; answer: string; score: number; feedback: string; quickTip: string };
type InterviewSessionSummary = { id: string; currentWeek: number; topics: string[]; overallScore: number; communicationScore: number; dsaScore: number; technicalScore: number; durationSeconds: number; completedAt: string; answers: AnswerRecord[] };
type CompanyQuestion = { id: string; title: string; acceptance: string; difficulty: string; frequency: number; link: string };
type Company = { id: string; name: string; emoji: string; logo: string; totalQuestions: number; easy: number; medium: number; hard: number };
type TabId = "weekly" | "resume" | "company";

// ─── Shared voice interview engine ────────────────────────────
function useVoiceInterview() {
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("Voice ready.");
  const recognitionRef = useRef<any>(null);
  const micReadyRef = useRef(false);

  const addMessage = (role: "ai" | "user", text: string) => setChat(p => [...p, { role, text }]);

  const speakText = async (text: string) => {
    if (!("speechSynthesis" in window) || !text) return;
    await new Promise<void>(resolve => {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.95;
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      window.speechSynthesis.speak(utter);
    });
  };

  const initRecognition = () => {
    if (recognitionRef.current) return recognitionRef.current;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setVoiceStatus("Speech recognition not supported."); return null; }
    const recognition = new SR();
    recognition.lang = "en-US"; recognition.continuous = false; recognition.interimResults = true;
    recognition.onstart = () => { setListening(true); setVoiceStatus("Listening... speak now."); };
    recognition.onresult = (e: any) => { let f = ""; for (let i = 0; i < e.results.length; i++) if (e.results[i].isFinal) f += e.results[i][0]?.transcript ?? ""; if (f.trim()) setAnswerText(f.trim()); };
    recognition.onerror = (e: any) => setVoiceStatus(`Mic error: ${e?.error ?? "unknown"}`);
    recognition.onend = () => { setListening(false); setVoiceStatus("Voice captured."); };
    recognitionRef.current = recognition;
    return recognition;
  };

  const ensureMic = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return false;
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); micReadyRef.current = true; return true; } catch { setVoiceStatus("Mic permission denied."); return false; }
  };

  const startListening = () => {
    const r = initRecognition(); if (!r || !micReadyRef.current) return;
    setAnswerText(""); try { r.start(); } catch { setVoiceStatus("Could not start mic."); }
  };

  const overallScore = useMemo(() => answers.length ? Number((answers.reduce((s, a) => s + a.score, 0) / answers.length).toFixed(2)) : 0, [answers]);

  return { chat, setChat, answers, setAnswers, answerText, setAnswerText, submitting, setSubmitting, listening, voiceStatus, addMessage, speakText, ensureMic, startListening, overallScore };
}

// ─── Weekly Interview Tab (existing logic) ────────────────────
function WeeklyTab() {
  const v = useVoiceInterview();
  const [stage, setStage] = useState<"start" | "interview" | "final">("start");
  const [loadingCtx, setLoadingCtx] = useState(true);
  const [loadingQs, setLoadingQs] = useState(false);
  const [ctxError, setCtxError] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [topics, setTopics] = useState<string[]>([]);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [sessions, setSessions] = useState<InterviewSessionSummary[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [histLoad, setHistLoad] = useState(false);
  const [savingSession, setSavingSession] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);

  const current = questions[qIdx] ?? null;
  const total = questions.length;
  const pct = total ? Math.round((v.answers.length / total) * 100) : 0;

  useEffect(() => {
    (async () => {
      setLoadingCtx(true);
      try { const r = await api.interviewContext(); setCurrentWeek(r?.currentWeek ?? 1); setTopics(r?.topics ?? []); } catch (e: any) { setCtxError(e?.error ?? "Failed to load context."); } finally { setLoadingCtx(false); }
    })();
  }, []);

  const askQ = async (q: InterviewQuestion) => { v.addMessage("ai", `Topic: ${q.topic}\nQuestion: ${q.question}`); await v.speakText(q.question); v.startListening(); };

  const startInterview = async () => {
    setLoadingQs(true); setCtxError(null);
    try {
      await v.ensureMic();
      const r = await api.interviewQuestions();
      const qs = r?.questions ?? [];
      if (!qs.length) throw new Error("No questions");
      setQuestions(qs); setQIdx(0); v.setAnswers([]); v.setChat([]); v.setAnswerText(""); setStage("interview"); setStartedAt(Date.now()); setSaveMsg(null);
      v.addMessage("ai", `Interview starts. Week ${currentWeek}.`);
      await v.speakText(`Interview starts. Week ${currentWeek}.`);
      await askQ(qs[0]);
    } catch (e: any) { setCtxError(e?.error ?? e?.message ?? "Failed to generate questions."); } finally { setLoadingQs(false); }
  };

  const submitAnswer = async () => {
    if (!current || v.submitting) return;
    const answer = v.answerText.trim(); if (!answer) return;
    v.setSubmitting(true); v.addMessage("user", answer);
    try {
      const r = await api.interviewScore({ topic: current.topic, question: current.question, answer });
      const score = Number(r?.score ?? 0); const feedback = r?.feedback ?? ""; const quickTip = r?.quickTip ?? "";
      v.addMessage("ai", `Score: ${score}/10\n${feedback}\nTip: ${quickTip}`);
      const record = { topic: current.topic, question: current.question, answer, score, feedback, quickTip };
      const all = [...v.answers, record]; v.setAnswers(all); v.setAnswerText("");
      const next = qIdx + 1;
      if (next >= questions.length) {
        setSavingSession(true);
        try { await api.interviewSaveSession({ currentWeek, topics, durationSeconds: Math.floor((Date.now() - startedAt) / 1000), answers: all }); setSaveMsg("Saved!"); } catch { setSaveMsg("Save failed."); } finally { setSavingSession(false); }
        setStage("final"); return;
      }
      setQIdx(next); await askQ(questions[next]);
    } catch (e: any) { v.addMessage("ai", e?.error ?? "Evaluation failed."); } finally { v.setSubmitting(false); }
  };

  if (stage === "start") return (
    <div className="glass-card p-6">
      <h2 className="text-xl font-bold mb-2">📅 Weekly Interview</h2>
      <p className="text-sm text-muted-foreground mb-4">Based on your current roadmap week topics.</p>
      {loadingCtx && <p className="text-sm text-muted-foreground">Loading…</p>}
      {ctxError && <p className="text-sm text-destructive">{ctxError}</p>}
      {!loadingCtx && !ctxError && (<>
        <div className="rounded-xl bg-muted/40 p-4 mb-4">
          <div className="text-sm font-semibold">Week {currentWeek}</div>
          <div className="mt-1 text-sm">{topics.join(", ") || "No topics"}</div>
        </div>
        <div className="flex gap-2">
          <Button onClick={startInterview} disabled={loadingQs || !topics.length}>{loadingQs ? "Generating…" : "Start Interview"}</Button>
          <Button variant="outline" onClick={async () => { setShowHistory(!showHistory); if (!showHistory && !sessions.length) { setHistLoad(true); try { const r = await api.interviewSessions(); setSessions(r?.sessions ?? []); } finally { setHistLoad(false); } } }}>{showHistory ? "Hide History" : "History"}</Button>
        </div>
        {showHistory && (<div className="mt-4 space-y-2">{histLoad ? <p className="text-xs text-muted-foreground">Loading…</p> : sessions.length === 0 ? <p className="text-xs text-muted-foreground">No history yet.</p> : sessions.map(s => (
          <div key={s.id} className="rounded-lg bg-muted/40 p-3 text-xs"><div className="font-semibold">Week {s.currentWeek} · {s.overallScore}/10</div><div className="text-muted-foreground">{new Date(s.completedAt).toLocaleString()}</div></div>
        ))}</div>)}
      </>)}
    </div>
  );

  if (stage === "final") return (
    <div className="glass-card p-6">
      <h2 className="text-2xl font-bold mb-2">Completed 🎉</h2>
      <div className="text-3xl font-bold mb-4">{v.overallScore}/10</div>
      <div className="text-xs text-muted-foreground mb-4">{savingSession ? "Saving…" : saveMsg}</div>
      <div className="space-y-2 mb-4">{v.answers.map((a, i) => <div key={i} className="rounded-lg bg-muted/40 p-3 text-sm"><div className="font-semibold">{a.topic} — {a.score}/10</div><div className="text-xs text-muted-foreground mt-1">{a.quickTip}</div></div>)}</div>
      <Button onClick={() => { setStage("start"); setQuestions([]); setQIdx(0); v.setChat([]); v.setAnswers([]); v.setAnswerText(""); }}>Restart</Button>
    </div>
  );

  return (<InterviewSession v={v} current={current} qIdx={qIdx} total={total} pct={pct} onSubmit={submitAnswer} />);
}

// ─── Resume Interview Tab ─────────────────────────────────────
function ResumeTab() {
  const v = useVoiceInterview();
  const [stage, setStage] = useState<"upload" | "interview" | "final">("upload");
  const [resumeText, setResumeText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [expLevel, setExpLevel] = useState("mid");
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [loadingQs, setLoadingQs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = questions[qIdx] ?? null;
  const total = questions.length;
  const pct = total ? Math.round((v.answers.length / total) * 100) : 0;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    // Read PDF as text (basic extraction)
    const text = await file.text();
    setResumeText(text.slice(0, 5000));
  };

  const extractSkills = async () => {
    if (!resumeText || resumeText.length < 20) { setError("Please paste or upload resume text."); return; }
    setExtracting(true); setError(null);
    try {
      const r = await api.interviewResumeExtract(resumeText);
      setSkills(r.skills || []); setTopics(r.topics || []); setExpLevel(r.experienceLevel || "mid");
    } catch (e: any) { setError(e?.error ?? "Failed to extract skills"); } finally { setExtracting(false); }
  };

  const startInterview = async () => {
    setLoadingQs(true); setError(null);
    try {
      await v.ensureMic();
      const r = await api.interviewResumeQuestions({ skills, topics, experienceLevel: expLevel });
      const qs = r?.questions ?? [];
      if (!qs.length) throw new Error("No questions generated");
      setQuestions(qs); setQIdx(0); v.setAnswers([]); v.setChat([]); v.setAnswerText(""); setStage("interview");
      v.addMessage("ai", "Resume-based interview starting. I'll ask questions based on your skills.");
      await v.speakText("Resume based interview starting.");
      const q = qs[0]; v.addMessage("ai", `Topic: ${q.topic}\nQuestion: ${q.question}`); await v.speakText(q.question); v.startListening();
    } catch (e: any) { setError(e?.error ?? e?.message ?? "Failed"); } finally { setLoadingQs(false); }
  };

  const submitAnswer = async () => {
    if (!current || v.submitting) return;
    const answer = v.answerText.trim(); if (!answer) return;
    v.setSubmitting(true); v.addMessage("user", answer);
    try {
      const r = await api.interviewScore({ topic: current.topic, question: current.question, answer });
      const score = Number(r?.score ?? 0);
      v.addMessage("ai", `Score: ${score}/10\n${r?.feedback}\nTip: ${r?.quickTip}`);
      const all = [...v.answers, { topic: current.topic, question: current.question, answer, score, feedback: r?.feedback ?? "", quickTip: r?.quickTip ?? "" }];
      v.setAnswers(all); v.setAnswerText("");
      const next = qIdx + 1;
      if (next >= questions.length) { setStage("final"); return; }
      setQIdx(next);
      const nq = questions[next]; v.addMessage("ai", `Topic: ${nq.topic}\nQuestion: ${nq.question}`); await v.speakText(nq.question); v.startListening();
    } catch (e: any) { v.addMessage("ai", "Evaluation failed."); } finally { v.setSubmitting(false); }
  };

  if (stage === "upload") return (
    <div className="glass-card p-6 space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2"><FileText className="w-5 h-5" /> Resume Interview</h2>
      <p className="text-sm text-muted-foreground">Upload your resume or paste text — AI will extract skills and generate targeted interview questions.</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="space-y-3">
        <label className="block">
          <span className="text-sm font-medium">Upload Resume (PDF/TXT)</span>
          <Input type="file" accept=".pdf,.txt,.doc,.docx" onChange={handleFile} className="mt-1" />
        </label>
        <textarea className="w-full min-h-[120px] rounded-xl border border-border bg-background p-3 text-sm" placeholder="Or paste your resume text here…" value={resumeText} onChange={e => setResumeText(e.target.value)} />
        <Button onClick={extractSkills} disabled={extracting || !resumeText}>{extracting ? "Extracting skills…" : "Extract Skills"}</Button>
      </div>
      {skills.length > 0 && (<div className="space-y-3">
        <div><span className="text-sm font-semibold">Detected Skills:</span>
          <div className="flex flex-wrap gap-1 mt-1">{skills.map(s => <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400">{s}</span>)}</div>
        </div>
        <div><span className="text-sm font-semibold">Interview Topics ({topics.length}):</span>
          <div className="flex flex-wrap gap-1 mt-1">{topics.map(t => <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">{t}</span>)}</div>
        </div>
        <div className="text-sm">Experience Level: <span className="font-semibold capitalize">{expLevel}</span></div>
        <Button onClick={startInterview} disabled={loadingQs} className="gradient-primary text-primary-foreground border-0">{loadingQs ? "Generating questions…" : "Start Interview"}</Button>
      </div>)}
    </div>
  );

  if (stage === "final") return (
    <div className="glass-card p-6">
      <h2 className="text-2xl font-bold mb-2">Resume Interview Complete 🎉</h2>
      <div className="text-3xl font-bold mb-4">{v.overallScore}/10</div>
      <div className="space-y-2 mb-4">{v.answers.map((a, i) => <div key={i} className="rounded-lg bg-muted/40 p-3 text-sm"><div className="font-semibold">{a.topic} — {a.score}/10</div><div className="text-xs text-muted-foreground mt-1">{a.quickTip}</div></div>)}</div>
      <Button onClick={() => { setStage("upload"); setQuestions([]); setQIdx(0); v.setChat([]); v.setAnswers([]); v.setAnswerText(""); setSkills([]); setTopics([]); setResumeText(""); }}>New Resume Interview</Button>
    </div>
  );

  return (<InterviewSession v={v} current={current} qIdx={qIdx} total={total} pct={pct} onSubmit={submitAnswer} />);
}

// ─── Company Interview Tab ────────────────────────────────────
function CompanyTab() {
  const v = useVoiceInterview();
  const [stage, setStage] = useState<"select" | "interview" | "final">("select");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCo, setLoadingCo] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyQuestions, setCompanyQuestions] = useState<CompanyQuestion[]>([]);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [loadingQs, setLoadingQs] = useState(false);
  const [difficulty, setDifficulty] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const current = questions[qIdx] ?? null;
  const total = questions.length;
  const pct = total ? Math.round((v.answers.length / total) * 100) : 0;

  useEffect(() => { (async () => { try { const r = await api.interviewCompanies(); setCompanies(r?.companies ?? []); } catch {} finally { setLoadingCo(false); } })(); }, []);

  const filtered = companies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const startCompanyInterview = async (company: Company) => {
    setSelectedCompany(company); setLoadingQs(true); setError(null);
    try {
      await v.ensureMic();
      const r = await api.interviewCompanyQuestions(company.id, 7, difficulty);
      const cqs: CompanyQuestion[] = r?.questions ?? [];
      if (!cqs.length) throw new Error("No questions found");
      setCompanyQuestions(cqs);
      // Generate AI interview questions from LeetCode titles
      const aiQuestions: InterviewQuestion[] = [];
      for (const cq of cqs.slice(0, 7)) {
        try {
          const ai = await api.interviewCompanyAIQuestion({ title: cq.title, difficulty: cq.difficulty, companyName: company.name });
          aiQuestions.push({ topic: `${cq.title} (${cq.difficulty})`, question: ai?.question || `Explain your approach to "${cq.title}". What data structures and algorithm would you use?` });
        } catch {
          aiQuestions.push({ topic: `${cq.title} (${cq.difficulty})`, question: `Explain your approach to "${cq.title}". What data structures and algorithm would you use?` });
        }
      }
      setQuestions(aiQuestions); setQIdx(0); v.setAnswers([]); v.setChat([]); v.setAnswerText(""); setStage("interview");
      v.addMessage("ai", `${company.name} interview starting. ${aiQuestions.length} questions.`);
      await v.speakText(`${company.name} interview starting.`);
      const q = aiQuestions[0]; v.addMessage("ai", `Topic: ${q.topic}\nQuestion: ${q.question}`); await v.speakText(q.question); v.startListening();
    } catch (e: any) { setError(e?.error ?? e?.message ?? "Failed"); } finally { setLoadingQs(false); }
  };

  const submitAnswer = async () => {
    if (!current || v.submitting) return;
    const answer = v.answerText.trim(); if (!answer) return;
    v.setSubmitting(true); v.addMessage("user", answer);
    try {
      const r = await api.interviewScore({ topic: current.topic, question: current.question, answer });
      const score = Number(r?.score ?? 0);
      v.addMessage("ai", `Score: ${score}/10\n${r?.feedback}\nTip: ${r?.quickTip}`);
      const all = [...v.answers, { topic: current.topic, question: current.question, answer, score, feedback: r?.feedback ?? "", quickTip: r?.quickTip ?? "" }];
      v.setAnswers(all); v.setAnswerText("");
      const next = qIdx + 1;
      if (next >= questions.length) { setStage("final"); return; }
      setQIdx(next);
      const nq = questions[next]; v.addMessage("ai", `Topic: ${nq.topic}\nQuestion: ${nq.question}`); await v.speakText(nq.question); v.startListening();
    } catch { v.addMessage("ai", "Evaluation failed."); } finally { v.setSubmitting(false); }
  };

  if (stage === "select") return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Building2 className="w-5 h-5" /> Company Interview</h2>
          <p className="text-sm text-muted-foreground">Practice questions frequently asked at top companies.</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Search company…" value={search} onChange={e => setSearch(e.target.value)} className="w-48 h-9 text-sm" />
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger className="w-28 h-9 text-xs"><SelectValue placeholder="Difficulty" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loadingCo ? <p className="text-sm text-muted-foreground">Loading companies…</p> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(c => (
            <Card key={c.id} className="p-4 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all" onClick={() => startCompanyInterview(c)}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center text-xl flex-shrink-0">
                  {c.emoji}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.totalQuestions} questions</div>
                </div>
              </div>
              <div className="flex gap-1.5 text-[10px]">
                <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">{c.easy} Easy</span>
                <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">{c.medium} Med</span>
                <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400">{c.hard} Hard</span>
              </div>
            </Card>
          ))}
        </div>
      )}
      {loadingQs && <div className="text-center py-6"><div className="text-sm text-muted-foreground animate-pulse">Generating {selectedCompany?.name} interview questions…</div></div>}
    </div>
  );

  if (stage === "final") return (
    <div className="glass-card p-6">
      <h2 className="text-2xl font-bold mb-2">{selectedCompany?.name} Interview Complete 🎉</h2>
      <div className="text-3xl font-bold mb-4">{v.overallScore}/10</div>
      <div className="space-y-2 mb-4">{v.answers.map((a, i) => <div key={i} className="rounded-lg bg-muted/40 p-3 text-sm"><div className="font-semibold">{a.topic} — {a.score}/10</div><div className="text-xs text-muted-foreground mt-1">{a.quickTip}</div></div>)}</div>
      <Button onClick={() => { setStage("select"); setQuestions([]); setQIdx(0); v.setChat([]); v.setAnswers([]); v.setAnswerText(""); }}>Try Another Company</Button>
    </div>
  );

  return (<InterviewSession v={v} current={current} qIdx={qIdx} total={total} pct={pct} onSubmit={submitAnswer} />);
}

// ─── Shared Interview Session UI ──────────────────────────────
function InterviewSession({ v, current, qIdx, total, pct, onSubmit }: { v: ReturnType<typeof useVoiceInterview>; current: InterviewQuestion | null; qIdx: number; total: number; pct: number; onSubmit: () => void }) {
  return (
    <div className="space-y-4">
      <div className="glass-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div><div className="font-semibold">Question {qIdx + 1}/{total}</div><div className="text-xs text-muted-foreground">{current?.topic}</div></div>
          <div className="text-sm font-semibold">{v.answers.length}/{total}</div>
        </div>
        <Progress value={pct} className="h-2 mt-3" />
      </div>
      <div className="glass-card p-4 max-h-[46vh] overflow-auto space-y-3">
        {v.chat.map((m, i) => <div key={i} className={`rounded-xl p-3 text-sm ${m.role === "ai" ? "bg-muted/40" : "bg-primary/10"}`}><div className="text-xs text-muted-foreground mb-1">{m.role === "ai" ? "AI Interviewer" : "You"}</div><div className="whitespace-pre-wrap">{m.text}</div></div>)}
      </div>
      <div className="glass-card p-4 space-y-3">
        <textarea className="w-full min-h-[120px] rounded-xl border border-border bg-background p-3 text-sm" placeholder="Answer here (voice or type)" value={v.answerText} onChange={e => v.setAnswerText(e.target.value)} disabled={v.submitting} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={onSubmit} disabled={v.submitting || !v.answerText.trim()}>{v.submitting ? "Evaluating…" : "Submit Answer"}</Button>
          <Button variant="outline" onClick={() => current && v.speakText(current.question)} disabled={!current}><Volume2 className="w-4 h-4 mr-2" />Read Question</Button>
        </div>
        <div className="text-xs text-muted-foreground">{v.listening ? "Listening…" : ""} {v.voiceStatus}</div>
      </div>
    </div>
  );
}

// ─── Main Interview Page ──────────────────────────────────────
export default function Interview() {
  const [tab, setTab] = useState<TabId>("weekly");

  const tabs: { id: TabId; label: string; icon: JSX.Element }[] = [
    { id: "weekly", label: "Weekly", icon: <CalendarDays className="w-4 h-4" /> },
    { id: "resume", label: "Resume", icon: <FileText className="w-4 h-4" /> },
    { id: "company", label: "Company", icon: <Building2 className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20 pb-16 container mx-auto px-4 max-w-4xl">
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <h1 className="text-2xl md:text-3xl font-bold mb-1">AI Voice Interview</h1>
        <p className="text-sm text-muted-foreground mb-4">Practice with AI — choose your interview mode below.</p>

        {/* Tab Selector */}
        <div className="flex gap-1 bg-muted/50 rounded-xl p-1 mb-6">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${tab === t.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setTab(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === "weekly" && <WeeklyTab />}
        {tab === "resume" && <ResumeTab />}
        {tab === "company" && <CompanyTab />}
      </main>
    </div>
  );
}
