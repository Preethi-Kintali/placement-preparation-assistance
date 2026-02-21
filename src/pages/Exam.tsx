import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Progress } from "@/components/ui/progress";

export default function Exam() {
  const { type } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<any | null>(null);
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const examOrder = ["aptitude", "dsa", "soft_skills", "career"] as const;
  const allowedTypes = new Set(examOrder);

  const examType = useMemo(() => type ?? "", [type]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (!allowedTypes.has(examType as any)) {
          setError("Invalid exam type.");
          return;
        }
        const status = await api.examStatus();
        const unlocked = status?.[examType]?.unlocked ?? false;
        if (!unlocked) {
          navigate("/dashboard");
          return;
        }
        const res = examType === "career" ? await api.careerQuestions(15) : await api.examQuestions(examType, 15);
        setQuestions(res.questions || []);
        setSessionId(res.sessionId || "");
        setTimeLeft(15 * 60);
        setResult(null);
        setAnswers({});
        if (!res.questions?.length || !res.sessionId) {
          setError("Failed to load questions. Please refresh and try again.");
        }
      } catch (e) {
        setError(e?.error ?? "Failed to load questions.");
      } finally {
        setLoading(false);
      }
    }
    if (examType) load();
  }, [examType]);

  useEffect(() => {
    if (loading || result || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((t) => t - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [loading, result, timeLeft]);

  useEffect(() => {
    if (timeLeft <= 0 && !result && !submitting && sessionId && questions.length) {
      submit();
    }
  }, [timeLeft, result, sessionId, questions.length, submitting]);

  const submit = async () => {
    if (submitting || result || !sessionId || questions.length === 0) return;
    setError(null);
    const answeredCount = questions.filter((q) => Boolean(answers[q.id])).length;
    if (answeredCount < questions.length) {
      setError("Please answer all questions before submitting.");
      return;
    }
    setSubmitting(true);
    const payload = {
      examType,
      sessionId,
      answers: questions.map((q) => ({
        questionId: q.id,
        selectedOption: answers[q.id] ?? "",
      })),
      durationSeconds: 15 * 60 - timeLeft,
    };
    try {
      const res = await api.submitExam(payload);
      setResult(res);
    } catch (e: any) {
      setError(e?.error ?? "Failed to submit exam.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);

    const currentIndex = examOrder.indexOf(examType as any);
    const nextExam = examOrder[currentIndex + 1];
    if (nextExam) {
      setTimeout(() => navigate(`/exam/${nextExam}`), 1200);
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const correctCount = result?.score ?? 0;
  const totalCount = result?.totalQuestions ?? 0;
  const wrongCount = result ? Math.max(0, totalCount - correctCount) : 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 container mx-auto px-4 max-w-3xl">
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold capitalize">{examType} Exam</h1>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>Back</Button>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="text-muted-foreground">15 questions · Single attempt</div>
            <div className={`font-semibold ${timeLeft <= 60 ? "text-destructive" : "text-foreground"}`}>
              Time left: {minutes}:{seconds.toString().padStart(2, "0")}
            </div>
          </div>
          <Progress value={(timeLeft / (15 * 60)) * 100} className="h-2" />
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading questions...</p>}
        {error && !loading && (
          <div className="glass-card p-4 mb-6 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {!loading && !error && questions.length === 0 && (
            <div className="glass-card p-4 text-sm text-muted-foreground">No questions available. Please refresh.</div>
          )}
          {questions.map((q, idx) => (
            <div key={q.id} className="glass-card p-4">
              <div className="font-medium mb-3">Q{idx + 1}. {q.question}</div>
              <div className="grid gap-2">
                {q.options.map((opt: string, i: number) => (
                  <label key={i} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      value={opt}
                      checked={answers[q.id] === opt}
                      onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                      disabled={Boolean(result)}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <Button onClick={submit} className="gradient-primary text-primary-foreground border-0" disabled={loading || !sessionId || submitting}>
            {submitting ? "Submitting..." : "Submit Exam"}
          </Button>
        </div>

        {result && (
          <div className="glass-card p-5 mt-8">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="font-semibold">Your Result</div>
              <div className="text-sm font-semibold">
                {Math.round(result.percentage)}%
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="p-3 rounded-xl bg-muted/40">
                <div className="text-muted-foreground text-xs">Correct</div>
                <div className="font-semibold text-success">{correctCount}</div>
              </div>
              <div className="p-3 rounded-xl bg-muted/40">
                <div className="text-muted-foreground text-xs">Wrong</div>
                <div className="font-semibold text-destructive">{wrongCount}</div>
              </div>
              <div className="p-3 rounded-xl bg-muted/40">
                <div className="text-muted-foreground text-xs">Grade</div>
                <div className="font-semibold">{result.grade}</div>
              </div>
            </div>

            <div className="mt-4 text-sm text-muted-foreground">
              Score: {result.score}/{result.totalQuestions}
              {" · "}Duration: {typeof result.durationSeconds === "number" ? `${Math.max(0, Math.floor(result.durationSeconds / 60))} min` : "-"}
            </div>

            <div className="mt-4">
              <div className="text-sm font-semibold mb-2">Answers Review</div>
              <div className="space-y-2">
                {result.answers?.map((a: any) => (
                  <div key={a.questionId} className="text-sm">
                    <span className={a.isCorrect ? "text-success" : "text-destructive"}>
                      {a.isCorrect ? "✔" : "✖"}
                    </span>
                    <span className="ml-2">Selected: {a.selectedOption} | Correct: {a.correctOption}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation CTA */}
            <div className="mt-6 flex flex-wrap gap-3">
              {examOrder.indexOf(examType as any) < examOrder.length - 1 ? (
                <Button
                  className="gradient-primary text-primary-foreground border-0"
                  onClick={() => {
                    const currentIndex = examOrder.indexOf(examType as any);
                    const nextExam = examOrder[currentIndex + 1];
                    if (nextExam) navigate(`/exam/${nextExam}`);
                  }}
                >
                  Continue to next test
                </Button>
              ) : (
                <>
                  <Button
                    className="gradient-primary text-primary-foreground border-0"
                    onClick={() => navigate("/dashboard")}
                  >
                    View scores on Dashboard
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/roadmap")}>
                    Continue to Roadmap
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
