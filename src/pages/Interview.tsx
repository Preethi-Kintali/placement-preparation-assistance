import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Mic, MicOff, Volume2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";

type InterviewQuestion = { topic: string; question: string };
type ChatMessage = { role: "ai" | "user"; text: string };
type AnswerRecord = {
  topic: string;
  question: string;
  answer: string;
  score: number;
  feedback: string;
  quickTip: string;
};

type InterviewSessionSummary = {
  id: string;
  currentWeek: number;
  topics: string[];
  overallScore: number;
  communicationScore: number;
  dsaScore: number;
  technicalScore: number;
  durationSeconds: number;
  completedAt: string;
  answers: AnswerRecord[];
};

export default function Interview() {
  const [stage, setStage] = useState<"start" | "interview" | "final">("start");
  const [loadingContext, setLoadingContext] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);

  const [currentWeek, setCurrentWeek] = useState(1);
  const [topics, setTopics] = useState<string[]>([]);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);

  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [voiceStatus, setVoiceStatus] = useState("Voice ready. Click Start Voice and speak.");
  const [listening, setListening] = useState(false);
  const [sessions, setSessions] = useState<InterviewSessionSummary[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [savingSession, setSavingSession] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [interviewStartedAt, setInterviewStartedAt] = useState(0);
  const recognitionRef = useRef<any>(null);

  const current = questions[questionIndex] ?? null;
  const total = questions.length;
  const progressPercent = total ? Math.round((answers.length / total) * 100) : 0;
  const topicsText = topics.join(", ");

  useEffect(() => {
    const loadContext = async () => {
      setLoadingContext(true);
      setContextError(null);
      try {
        const res = await api.interviewContext();
        setCurrentWeek(Number(res?.currentWeek ?? 1));
        setTopics(Array.isArray(res?.topics) ? res.topics : []);
      } catch (e: any) {
        setContextError(e?.error ?? "Failed to load interview context.");
      } finally {
        setLoadingContext(false);
      }
    };

    loadContext();
  }, []);

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await api.interviewSessions();
      setSessions(Array.isArray(res?.sessions) ? res.sessions : []);
    } catch (e: any) {
      setHistoryError(e?.error ?? "Failed to load previous interview analyses.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const overallScore = useMemo(() => {
    if (!answers.length) return 0;
    return Number((answers.reduce((s, a) => s + a.score, 0) / answers.length).toFixed(2));
  }, [answers]);

  const addMessage = (role: "ai" | "user", text: string) => {
    setChat((prev) => [...prev, { role, text }]);
  };

  const speakText = async (text: string) => {
    if (!("speechSynthesis" in window) || !text) return;
    await new Promise<void>((resolve) => {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.95;
      utter.pitch = 1;
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      window.speechSynthesis.speak(utter);
    });
  };

  const initRecognition = () => {
    if (recognitionRef.current) return recognitionRef.current;

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setVoiceStatus("Speech recognition not supported. Use Chrome/Edge.");
      return null;
    }

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setListening(true);
      setVoiceStatus("Listening... speak now.");
    };

    recognition.onresult = (event: any) => {
      let finalText = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const part = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) finalText += part;
      }
      if (finalText.trim()) {
        setAnswerText(finalText.trim());
      }
    };

    recognition.onerror = (event: any) => {
      setVoiceStatus(`Mic error: ${String(event?.error ?? "unknown")}`);
    };

    recognition.onend = () => {
      setListening(false);
      setVoiceStatus("Voice captured. Review text and click Submit.");
    };

    recognitionRef.current = recognition;
    return recognition;
  };

  const startVoice = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceStatus("Microphone API not supported.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setVoiceStatus("Microphone permission denied. Allow mic and retry.");
      return;
    }

    const recognition = initRecognition();
    if (!recognition) return;

    setAnswerText("");
    try {
      recognition.start();
    } catch {
      setVoiceStatus("Could not start microphone. Try again.");
    }
  };

  const stopVoice = () => {
    if (recognitionRef.current && listening) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setVoiceStatus("Voice stopped.");
  };

  const askCurrentQuestion = async (q: InterviewQuestion) => {
    addMessage("ai", `Topic: ${q.topic}\nQuestion: ${q.question}`);
    await speakText(q.question);
  };

  const startInterview = async () => {
    setLoadingQuestions(true);
    setContextError(null);

    try {
      const res = await api.interviewQuestions();
      const qs: InterviewQuestion[] = Array.isArray(res?.questions) ? res.questions : [];
      if (!qs.length) throw new Error("No questions generated");

      setQuestions(qs);
      setQuestionIndex(0);
      setAnswers([]);
      setChat([]);
      setAnswerText("");
      setStage("interview");
      setInterviewStartedAt(Date.now());
      setSaveMessage(null);

      const intro = `Interview starts now. Current week: ${currentWeek}. We have one question per topic.`;
      addMessage("ai", intro);
      await speakText(intro);
      await askCurrentQuestion(qs[0]);
    } catch (e: any) {
      setContextError(e?.error ?? e?.message ?? "Failed to generate interview questions.");
    } finally {
      setLoadingQuestions(false);
    }
  };

  const saveSession = async (allAnswers: AnswerRecord[]) => {
    setSavingSession(true);
    setSaveMessage(null);
    try {
      const durationSeconds = Math.max(0, Math.floor((Date.now() - interviewStartedAt) / 1000));
      await api.interviewSaveSession({
        currentWeek,
        topics,
        durationSeconds,
        answers: allAnswers,
      });
      setSaveMessage("Interview analysis saved.");
      await loadHistory();
    } catch (e: any) {
      setSaveMessage(e?.error ?? "Failed to save interview analysis.");
    } finally {
      setSavingSession(false);
    }
  };

  const submitAnswer = async () => {
    if (!current || submitting) return;
    const answer = answerText.trim();
    if (!answer) return;

    setSubmitting(true);
    addMessage("user", answer);

    try {
      const res = await api.interviewScore({
        topic: current.topic,
        question: current.question,
        answer,
      });

      const score = Number(res?.score ?? 0);
      const feedback = String(res?.feedback ?? "");
      const quickTip = String(res?.quickTip ?? "");

      addMessage("ai", `Score: ${score}/10\nFeedback: ${feedback}\nQuick Tip: ${quickTip}`);

      const record: AnswerRecord = {
        topic: current.topic,
        question: current.question,
        answer,
        score,
        feedback,
        quickTip,
      };

      const allAnswers = [...answers, record];
      setAnswers(allAnswers);
      setAnswerText("");

      const nextIndex = questionIndex + 1;
      if (nextIndex >= questions.length) {
        await saveSession(allAnswers);
        setStage("final");
        return;
      }

      setQuestionIndex(nextIndex);
      await askCurrentQuestion(questions[nextIndex]);
    } catch (e: any) {
      addMessage("ai", e?.error ?? "Failed to evaluate this answer. Please retry.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20 pb-16 container mx-auto px-4 max-w-3xl">
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        {stage === "start" && (
          <div className="glass-card p-6 md:p-8">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">AI Voice Interview</h1>
            <p className="text-sm text-muted-foreground mb-4">One question per current-week roadmap topic.</p>

            {loadingContext && <p className="text-sm text-muted-foreground">Loading context...</p>}
            {contextError && <p className="text-sm text-destructive">{contextError}</p>}

            {!loadingContext && !contextError && (
              <>
                <div className="rounded-xl bg-muted/40 p-4 mb-4">
                  <div className="text-sm font-semibold">Current Week: {currentWeek}</div>
                  <div className="text-xs text-muted-foreground mt-1">Interview Topics</div>
                  <div className="mt-2 text-sm">{topicsText || "No topics available"}</div>
                </div>

                <Button onClick={startInterview} disabled={loadingQuestions || !topics.length}>
                  {loadingQuestions ? "Generating Questions..." : "Start Interview"}
                </Button>

                <Button
                  variant="outline"
                  className="ml-2"
                  onClick={async () => {
                    const next = !showHistory;
                    setShowHistory(next);
                    if (next && !sessions.length) await loadHistory();
                  }}
                >
                  {showHistory ? "Hide Previous Analysis" : "Previous Analysis & Scores"}
                </Button>

                {showHistory && (
                  <div className="mt-4 rounded-xl bg-muted/40 p-4 space-y-3">
                    <div className="font-semibold text-sm">Previous Interviews</div>
                    {historyLoading && <div className="text-xs text-muted-foreground">Loading...</div>}
                    {historyError && <div className="text-xs text-destructive">{historyError}</div>}
                    {!historyLoading && !historyError && sessions.length === 0 && (
                      <div className="text-xs text-muted-foreground">No previous interviews yet.</div>
                    )}
                    {!historyLoading && !historyError && sessions.map((s) => (
                      <div key={s.id} className="rounded-lg bg-background p-3 text-xs">
                        <div className="font-semibold">Week {s.currentWeek} · Overall {s.overallScore}/10</div>
                        <div className="text-muted-foreground mt-1">
                          Communication {s.communicationScore}/10 · DSA {s.dsaScore}/10 · Technical {s.technicalScore}/10
                        </div>
                        <div className="text-muted-foreground mt-1">{new Date(s.completedAt).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {stage === "interview" && (
          <div className="space-y-4">
            <div className="glass-card p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold">Question {questionIndex + 1}/{total}</div>
                  <div className="text-xs text-muted-foreground">Current topic: {current?.topic}</div>
                </div>
                <div className="text-sm font-semibold">{answers.length}/{total}</div>
              </div>
              <Progress value={progressPercent} className="h-2 mt-3" />
            </div>

            <div className="glass-card p-4 max-h-[46vh] overflow-auto space-y-3">
              {chat.map((m, idx) => (
                <div key={`${m.role}-${idx}`} className={`rounded-xl p-3 text-sm ${m.role === "ai" ? "bg-muted/40" : "bg-primary/10"}`}>
                  <div className="text-xs text-muted-foreground mb-1">{m.role === "ai" ? "AI Interviewer" : "You"}</div>
                  <div className="whitespace-pre-wrap">{m.text}</div>
                </div>
              ))}
            </div>

            <div className="glass-card p-4 space-y-3">
              <textarea
                className="w-full min-h-[120px] rounded-xl border border-border bg-background p-3 text-sm"
                placeholder="Type answer or capture voice"
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                disabled={submitting}
              />

              <div className="flex flex-wrap gap-2">
                <Button onClick={submitAnswer} disabled={submitting || !answerText.trim()}>
                  {submitting ? "Evaluating..." : "Submit Answer"}
                </Button>
                <Button variant="outline" onClick={startVoice} disabled={submitting || listening}>
                  <Mic className="w-4 h-4 mr-2" /> Start Voice
                </Button>
                <Button variant="outline" onClick={stopVoice} disabled={!listening}>
                  <MicOff className="w-4 h-4 mr-2" /> Stop Voice
                </Button>
                <Button variant="outline" onClick={() => current && speakText(current.question)} disabled={!current}>
                  <Volume2 className="w-4 h-4 mr-2" /> Read Question
                </Button>
              </div>

              <div className="text-xs text-muted-foreground">{voiceStatus}</div>
            </div>
          </div>
        )}

        {stage === "final" && (
          <div className="glass-card p-6 md:p-8">
            <h2 className="text-2xl font-bold mb-2">Interview Completed 🎉</h2>
            <p className="text-sm text-muted-foreground mb-4">Final score across all topic questions.</p>

            <div className="text-3xl font-bold mb-4">{overallScore}/10</div>
            <div className="text-xs text-muted-foreground mb-4">
              {savingSession ? "Saving interview analysis..." : saveMessage ?? ""}
            </div>

            <div className="space-y-2 mb-6">
              {answers.map((item, idx) => (
                <div key={`${item.topic}-${idx}`} className="rounded-lg bg-muted/40 p-3 text-sm">
                  <div className="font-semibold">{item.topic} — {item.score}/10</div>
                  <div className="text-xs text-muted-foreground mt-1">Quick tip: {item.quickTip}</div>
                </div>
              ))}
            </div>

            <Button
              onClick={() => {
                setStage("start");
                setQuestions([]);
                setQuestionIndex(0);
                setChat([]);
                setAnswers([]);
                setAnswerText("");
              }}
            >
              Restart Interview
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
