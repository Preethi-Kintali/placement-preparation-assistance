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
  const [stage, setStage] = useState<"upload" | "preparing" | "ready" | "interview" | "final">("upload");
  const [resumeText, setResumeText] = useState("");
  const [fileName, setFileName] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [expLevel, setExpLevel] = useState("mid");
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [prepStep, setPrepStep] = useState(0);

  const current = questions[qIdx] ?? null;
  const total = questions.length;
  const pct = total ? Math.round((v.answers.length / total) * 100) : 0;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setResumeText(text.slice(0, 5000));
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0]; if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setResumeText(text.slice(0, 5000));
  };

  // Single-click: extract skills + generate questions + start
  const handleStartInterview = async () => {
    if (!resumeText || resumeText.length < 20) { setError("Please upload or paste your resume first."); return; }
    setError(null); setStage("preparing"); setPrepStep(1);

    try {
      // Step 1: Extract skills
      const ext = await api.interviewResumeExtract(resumeText);
      const sk = ext.skills || []; const tp = ext.topics || []; const el = ext.experienceLevel || "mid";
      setSkills(sk); setTopics(tp); setExpLevel(el);
      setPrepStep(2);

      // Step 2: Generate questions
      const r = await api.interviewResumeQuestions({ skills: sk, topics: tp, experienceLevel: el });
      const qs = r?.questions ?? [];
      if (!qs.length) throw new Error("Could not generate questions from resume");
      setQuestions(qs);
      setPrepStep(3);

      // Step 3: Ready — show brief summary before starting
      setStage("ready");
    } catch (e: any) {
      setError(e?.error ?? e?.message ?? "Failed to analyze resume");
      setStage("upload");
    }
  };

  const beginInterview = async () => {
    try {
      await v.ensureMic();
      setStage("interview");
      v.setChat([]); v.setAnswers([]); v.setAnswerText("");

      // Professional intro
      const intro = `Welcome to your resume-based interview. I've analyzed your profile and prepared ${questions.length} questions covering your skills and project experience. Let's begin.`;
      v.addMessage("ai", intro);
      await v.speakText(intro);

      const q = questions[0];
      v.addMessage("ai", `📌 ${q.topic}\n\n${q.question}`);
      await v.speakText(q.question);
      v.startListening();
    } catch {
      setError("Failed to start interview");
      setStage("upload");
    }
  };

  const submitAnswer = async () => {
    if (!current || v.submitting) return;
    const answer = v.answerText.trim(); if (!answer) return;
    v.setSubmitting(true); v.addMessage("user", answer);
    try {
      const r = await api.interviewScore({ topic: current.topic, question: current.question, answer });
      const score = Number(r?.score ?? 0);
      v.addMessage("ai", `**Score: ${score}/10**\n\n${r?.feedback}\n\n💡 *${r?.quickTip}*`);
      const all = [...v.answers, { topic: current.topic, question: current.question, answer, score, feedback: r?.feedback ?? "", quickTip: r?.quickTip ?? "" }];
      v.setAnswers(all); v.setAnswerText("");
      const next = qIdx + 1;
      if (next >= questions.length) { setStage("final"); return; }
      setQIdx(next);
      const nq = questions[next];
      v.addMessage("ai", `📌 ${nq.topic}\n\n${nq.question}`);
      await v.speakText(nq.question); v.startListening();
    } catch { v.addMessage("ai", "Evaluation failed. Please try again."); } finally { v.setSubmitting(false); }
  };

  // ── Upload Stage ──
  if (stage === "upload") return (
    <div className="space-y-5">
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
            <FileText className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Resume-Based Interview</h2>
            <p className="text-sm text-muted-foreground">Upload your resume — AI will interview you on your skills, projects, and experience.</p>
          </div>
        </div>

        {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 mb-4">{error}</p>}

        {/* Upload Area */}
        <div
          className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer hover:border-primary/50 hover:bg-primary/5 ${fileName ? "border-green-500 bg-green-50 dark:bg-green-900/10" : "border-border"}`}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => document.getElementById("resume-upload-input")?.click()}
        >
          <input id="resume-upload-input" type="file" accept=".pdf,.txt,.doc,.docx" onChange={handleFile} className="hidden" />
          {fileName ? (
            <div className="space-y-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <FileText className="w-7 h-7 text-green-600" />
              </div>
              <p className="font-semibold text-green-700 dark:text-green-400">{fileName}</p>
              <p className="text-xs text-muted-foreground">Resume loaded · {(resumeText.length / 1000).toFixed(1)}K characters</p>
              <p className="text-xs text-muted-foreground">Click or drop another file to replace</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center">
                <Upload className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="font-medium">Drop your resume here or click to browse</p>
              <p className="text-xs text-muted-foreground">Supports PDF, TXT, DOC, DOCX</p>
            </div>
          )}
        </div>

        {/* Or paste */}
        <div className="mt-4">
          <p className="text-xs text-muted-foreground mb-1.5">Or paste your resume content:</p>
          <textarea
            className="w-full min-h-[100px] rounded-xl border border-border bg-background p-3 text-sm resize-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            placeholder="Paste resume text here — include your skills, projects, and work experience…"
            value={resumeText}
            onChange={e => { setResumeText(e.target.value); if (!fileName) setFileName("pasted-resume.txt"); }}
          />
        </div>

        {/* Start Interview Button */}
        <Button
          className="w-full mt-4 h-12 text-base font-semibold gradient-primary text-primary-foreground border-0 shadow-lg hover:shadow-xl transition-all"
          disabled={!resumeText || resumeText.length < 20}
          onClick={handleStartInterview}
        >
          🎙️ Start Interview
        </Button>
      </div>

      {/* How it works */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold mb-3">How it works</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[{ step: "1", label: "Upload Resume", desc: "PDF or text" },
            { step: "2", label: "AI Analyzes", desc: "Skills & projects" },
            { step: "3", label: "Live Interview", desc: "Voice-based Q&A" }]
            .map(s => (
              <div key={s.step} className="space-y-1">
                <div className="w-8 h-8 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">{s.step}</div>
                <p className="text-xs font-semibold">{s.label}</p>
                <p className="text-[10px] text-muted-foreground">{s.desc}</p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );

  // ── Preparing Stage (animation) ──
  if (stage === "preparing") return (
    <div className="glass-card p-8 text-center">
      <div className="w-20 h-20 mx-auto rounded-full gradient-primary flex items-center justify-center mb-6 animate-pulse">
        <FileText className="w-10 h-10 text-primary-foreground" />
      </div>
      <h2 className="text-xl font-bold mb-2">Preparing Your Interview</h2>
      <p className="text-sm text-muted-foreground mb-6">Analyzing your resume and generating personalized questions…</p>
      <div className="max-w-sm mx-auto space-y-3">
        {[{ step: 1, label: "Scanning resume & extracting skills" },
          { step: 2, label: "Generating interview questions" },
          { step: 3, label: "Setting up interview room" }]
          .map(s => (
            <div key={s.step} className="flex items-center gap-3 text-sm">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${prepStep >= s.step ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {prepStep > s.step ? "✓" : s.step}
              </div>
              <span className={prepStep >= s.step ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
              {prepStep === s.step && <span className="ml-auto text-xs text-primary animate-pulse">Processing…</span>}
            </div>
          ))}
      </div>
    </div>
  );

  // ── Ready Stage (show skills summary + Begin button) ──
  if (stage === "ready") return (
    <div className="glass-card p-6 space-y-5">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-3">
          <span className="text-3xl">✅</span>
        </div>
        <h2 className="text-xl font-bold">Interview Ready</h2>
        <p className="text-sm text-muted-foreground mt-1">{questions.length} questions prepared based on your resume</p>
      </div>

      {/* Skills detected */}
      <div className="rounded-xl bg-muted/30 p-4 space-y-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Skills Detected</span>
          <div className="flex flex-wrap gap-1.5 mt-2">{skills.map(s => <span key={s} className="text-xs px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400 font-medium">{s}</span>)}</div>
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Interview Topics</span>
          <div className="flex flex-wrap gap-1.5 mt-2">{topics.map(t => <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 font-medium">{t}</span>)}</div>
        </div>
        <div className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">Experience:</span> <span className="font-semibold capitalize">{expLevel}</span></div>
      </div>

      <Button
        className="w-full h-12 text-base font-semibold gradient-primary text-primary-foreground border-0 shadow-lg"
        onClick={beginInterview}
      >
        🎙️ Begin Interview Now
      </Button>

      <button className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => { setStage("upload"); setSkills([]); setTopics([]); setQuestions([]); }}>
        ← Upload a different resume
      </button>
    </div>
  );

  // ── Final Stage ──
  if (stage === "final") return (
    <div className="glass-card p-6">
      <div className="text-center mb-4">
        <span className="text-4xl">🎉</span>
        <h2 className="text-2xl font-bold mt-2">Resume Interview Complete</h2>
      </div>
      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-muted/40">
          <span className="text-3xl font-bold">{v.overallScore}</span>
          <span className="text-lg text-muted-foreground">/10</span>
        </div>
      </div>
      <div className="space-y-2 mb-4">{v.answers.map((a, i) => (
        <div key={i} className="rounded-lg bg-muted/40 p-3 text-sm">
          <div className="flex items-center justify-between"><span className="font-semibold">{a.topic}</span><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.score >= 7 ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" : a.score >= 5 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400" : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>{a.score}/10</span></div>
          <div className="text-xs text-muted-foreground mt-1">💡 {a.quickTip}</div>
        </div>
      ))}</div>
      <Button className="w-full" onClick={() => { setStage("upload"); setQuestions([]); setQIdx(0); v.setChat([]); v.setAnswers([]); v.setAnswerText(""); setSkills([]); setTopics([]); setResumeText(""); setFileName(""); }}>New Resume Interview</Button>
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
