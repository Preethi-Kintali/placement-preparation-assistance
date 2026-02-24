import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Lock, Rocket, BookOpen, FileText,
  ChevronDown, ExternalLink, ArrowLeft, Trophy
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Navbar } from "@/components/Navbar";
import { api } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0, 0, 0.2, 1] as const },
  }),
};

interface DayData {
  day: number;
  topic: string;
  status?: "completed" | "pending";
  video?: string;
  resources?: { title: string; url: string }[];
}

interface WeekData {
  week: number;
  title: string;
  status: "completed" | "active" | "locked";
  days: DayData[];
  testAvailable: boolean;
  test?: { requiredDays?: number; completedDays?: number } | null;
}

type WeeklyTestQuestion = {
  id: string;
  question: string;
  options: string[];
  source?: "career" | "dsa" | "aptitude" | "soft_skills";
};

type GrandTestQuestion = WeeklyTestQuestion;

export default function Roadmap() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [expandedWeek, setExpandedWeek] = useState<number | null>(1);
  const [roadmap, setRoadmap] = useState<WeekData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [checkNewTechLoading, setCheckNewTechLoading] = useState(false);
  const [checkNewTechMsg, setCheckNewTechMsg] = useState<string | null>(null);

  const [testOpen, setTestOpen] = useState(false);
  const [testWeek, setTestWeek] = useState<number | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testSessionId, setTestSessionId] = useState<string>("");
  const [testQuestions, setTestQuestions] = useState<WeeklyTestQuestion[]>([]);
  const [testAnswers, setTestAnswers] = useState<Record<string, string>>({});
  const [testSubmitting, setTestSubmitting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testStartedAt, setTestStartedAt] = useState<number>(0);

  const [grandOpen, setGrandOpen] = useState(false);
  const [grandLoading, setGrandLoading] = useState(false);
  const [grandError, setGrandError] = useState<string | null>(null);
  const [grandSessionId, setGrandSessionId] = useState<string>("");
  const [grandQuestions, setGrandQuestions] = useState<GrandTestQuestion[]>([]);
  const [grandAnswers, setGrandAnswers] = useState<Record<string, string>>({});
  const [grandSubmitting, setGrandSubmitting] = useState(false);
  const [grandResult, setGrandResult] = useState<any | null>(null);
  const [grandStartedAt, setGrandStartedAt] = useState<number>(0);
  const [certificate, setCertificate] = useState<any | null>(null);

  const [infoOpen, setInfoOpen] = useState(false);
  const [infoTopic, setInfoTopic] = useState<string>("");
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [infoData, setInfoData] = useState<any | null>(null);

  const [ytOpen, setYtOpen] = useState(false);
  const [ytTopic, setYtTopic] = useState<string>("");
  const [ytLoading, setYtLoading] = useState(false);
  const [ytError, setYtError] = useState<string | null>(null);
  const [ytVideos, setYtVideos] = useState<any[]>([]);
  const [ytSource, setYtSource] = useState<string>("");

  const loadRoadmap = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.roadmap();
      const weeks = (res.weeks || []).map((w: any) => ({
        week: w.week,
        title: w.title,
        status: w.status,
        testAvailable: Boolean(w.test?.unlocked),
        test: w.test ?? null,
        days: (w.days || []).map((d: any) => ({
          day: d.day,
          topic: d.topic,
          status: d.status ?? "pending",
          resources: d.resources ?? [],
        })),
      }));
      setRoadmap(weeks);

      // If user has reached the end of week 12, try to fetch certificate (ignore 404).
      const week12Completed = weeks.some((w: any) => Number(w.week) === 12 && w.status === "completed");
      if (week12Completed) {
        try {
          const cert = await api.roadmapCertificate();
          setCertificate(cert);
        } catch {
          // no certificate yet
        }
      }
    } catch (e: any) {
      setRoadmap([]);
      setError(e?.error ?? "Failed to load roadmap.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const status = await api.examStatus();
        const allExamsDone = Boolean(status?.aptitude?.latest && status?.dsa?.latest && status?.soft_skills?.latest && status?.career?.latest);
        if (!allExamsDone) {
          navigate("/dashboard");
          return;
        }
      } catch {
        // If status fails, allow roadmap API to surface a proper error.
      }
      await loadRoadmap();
    })();
  }, []);

  const openWeeklyTest = async (week: number) => {
    setTestOpen(true);
    setTestWeek(week);
    setTestLoading(true);
    setTestError(null);
    setTestResult(null);
    setTestSessionId("");
    setTestQuestions([]);
    setTestAnswers({});
    try {
      const res = await api.roadmapWeeklyTestQuestions(week);
      setTestSessionId(res.sessionId ?? "");
      setTestQuestions((res.questions ?? []) as WeeklyTestQuestion[]);
      setTestStartedAt(Date.now());
      if (!res.sessionId || !res.questions?.length) {
        setTestError("Failed to load weekly test questions. Please try again.");
      }
    } catch (e: any) {
      setTestError(e?.error ?? "Failed to load weekly test questions.");
    } finally {
      setTestLoading(false);
    }
  };

  const submitWeeklyTest = async () => {
    if (!testWeek || !testSessionId || testQuestions.length === 0 || testSubmitting || testResult) return;
    setTestError(null);
    const answeredCount = testQuestions.filter((q) => Boolean(testAnswers[q.id])).length;
    if (answeredCount < testQuestions.length) {
      setTestError("Please answer all questions before submitting.");
      return;
    }

    setTestSubmitting(true);
    try {
      const durationSeconds = Math.max(1, Math.floor((Date.now() - testStartedAt) / 1000));
      const payload = {
        sessionId: testSessionId,
        durationSeconds,
        answers: testQuestions.map((q) => ({
          questionId: q.id,
          selectedOption: testAnswers[q.id] ?? "",
        })),
      };
      const res = await api.roadmapWeeklyTestSubmit(testWeek, payload);
      setTestResult(res);
      await loadRoadmap();
    } catch (e: any) {
      setTestError(e?.error ?? "Failed to submit weekly test.");
    } finally {
      setTestSubmitting(false);
    }
  };

  const openGrandTest = async () => {
    setGrandOpen(true);
    setGrandLoading(true);
    setGrandError(null);
    setGrandResult(null);
    setGrandSessionId("");
    setGrandQuestions([]);
    setGrandAnswers({});
    try {
      const res = await api.roadmapGrandTest();
      if (res?.alreadyCertified && res?.certificate) {
        setCertificate(res.certificate);
        setGrandResult({ alreadyCertified: true, certificate: res.certificate });
        return;
      }

      setGrandSessionId(res.sessionId ?? "");
      setGrandQuestions((res.questions ?? []) as GrandTestQuestion[]);
      setGrandStartedAt(Date.now());

      if (!res.sessionId || !res.questions?.length) {
        setGrandError("Failed to load grand test questions. Please try again.");
      }
    } catch (e: any) {
      setGrandError(e?.error ?? "Grand test is locked or failed to load.");
    } finally {
      setGrandLoading(false);
    }
  };

  const submitGrandTest = async () => {
    if (!grandSessionId || grandQuestions.length === 0 || grandSubmitting || grandResult) return;
    setGrandError(null);
    const answeredCount = grandQuestions.filter((q) => Boolean(grandAnswers[q.id])).length;
    if (answeredCount < grandQuestions.length) {
      setGrandError("Please answer all questions before submitting.");
      return;
    }

    setGrandSubmitting(true);
    try {
      const durationSeconds = Math.max(1, Math.floor((Date.now() - grandStartedAt) / 1000));
      const payload = {
        sessionId: grandSessionId,
        durationSeconds,
        answers: grandQuestions.map((q) => ({
          questionId: q.id,
          selectedOption: grandAnswers[q.id] ?? "",
        })),
      };
      const res = await api.roadmapGrandTestSubmit(payload);
      setGrandResult(res);
      if (res?.certificate) setCertificate(res.certificate);
      await loadRoadmap();
    } catch (e: any) {
      setGrandError(e?.error ?? "Failed to submit grand test.");
    } finally {
      setGrandSubmitting(false);
    }
  };

  const openTopicInfo = async (topic: string) => {
    const t = String(topic ?? "").trim();
    if (!t) return;
    setInfoOpen(true);
    setInfoTopic(t);
    setInfoLoading(true);
    setInfoError(null);
    setInfoData(null);
    try {
      const res = await api.roadmapTopicInfo(t);
      setInfoData(res);
    } catch (e: any) {
      setInfoError(e?.error ?? "Failed to load AI info.");
    } finally {
      setInfoLoading(false);
    }
  };

  const openYoutube = async (topic: string) => {
    const t = String(topic ?? "").trim();
    if (!t) return;
    setYtOpen(true);
    setYtTopic(t);
    setYtLoading(true);
    setYtError(null);
    setYtVideos([]);
    setYtSource("");
    try {
      const res = await api.roadmapResources(t, 3);
      setYtVideos(res?.videos ?? []);
      setYtSource(String(res?.source ?? ""));
    } catch (e: any) {
      setYtError(e?.error ?? "Failed to load YouTube videos.");
    } finally {
      setYtLoading(false);
    }
  };

  const checkNewTech = async () => {
    if (checkNewTechLoading) return;
    setCheckNewTechLoading(true);
    setCheckNewTechMsg(null);
    try {
      const res = await api.roadmapCheckNewTech();
      const added = Number(res?.added ?? 0);
      const weeksAppended = Number(res?.weeksAppended ?? 0);
      setCheckNewTechMsg(added > 0 ? `Added ${added} new topics (${weeksAppended} week(s) appended).` : "No new topics found.");
      await loadRoadmap();
    } catch (e: any) {
      setCheckNewTechMsg(e?.error ?? "Check for new tech failed.");
    } finally {
      setCheckNewTechLoading(false);
    }
  };

  const completedWeeks = roadmap.filter((w) => w.status === "completed").length;
  const progressPercent = roadmap.length ? Math.round((completedWeeks / roadmap.length) * 100) : 0;

  const week12Completed = roadmap.some((w) => Number(w.week) === 12 && w.status === "completed");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-20 pb-16 container mx-auto px-4 max-w-2xl">
        {/* Header */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0} className="mb-8">
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold mb-2">Your Learning Roadmap</h1>
          {error && <div className="glass-card p-4 text-sm text-destructive">{error}</div>}
          <div className="flex items-center justify-between gap-3 mt-2">
            <div className="flex items-center gap-3 flex-1">
              <Progress value={progressPercent} className="h-2 flex-1 bg-muted" />
              <span className="text-sm font-semibold text-primary">{progressPercent}%</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={checkNewTechLoading}
              onClick={checkNewTech}
            >
              {checkNewTechLoading ? "Checking..." : "Check for new tech"}
            </Button>
          </div>
          {checkNewTechMsg && (
            <div className="mt-2 text-xs text-muted-foreground">
              {checkNewTechMsg}
            </div>
          )}
          <p className="text-sm text-muted-foreground mt-2">
            {completedWeeks} of {roadmap.length || 0} weeks completed
          </p>
        </motion.div>

        {/* Snake Roadmap */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border" />

          {loading && <p className="text-sm text-muted-foreground">Loading roadmap...</p>}

          {roadmap.map((week, i) => (
            <motion.div
              key={week.week}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={i + 1}
              className="relative mb-4"
            >
              {/* Node */}
              <button
                onClick={() => week.status !== "locked" && setExpandedWeek(expandedWeek === week.week ? null : week.week)}
                className="w-full flex items-center gap-4 group"
                disabled={week.status === "locked"}
              >
                <div
                  className={
                    week.status === "completed"
                      ? "roadmap-node-completed shrink-0"
                      : week.status === "active"
                      ? "roadmap-node-active shrink-0"
                      : "roadmap-node-locked shrink-0"
                  }
                >
                  {week.status === "completed" ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : week.status === "active" ? (
                    <Rocket className="w-6 h-6" />
                  ) : (
                    <Lock className="w-5 h-5" />
                  )}
                </div>

                <div className={`glass-card p-4 flex-1 text-left transition-all ${
                  week.status === "locked" ? "opacity-50" : "group-hover:shadow-soft"
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{week.title || `Week ${week.week}`}</div>
                    </div>
                      {week.status !== "locked" && (
                      <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${
                        expandedWeek === week.week ? "rotate-180" : ""
                      }`} />
                    )}
                  </div>

                  {week.status === "active" && (
                    <div className="mt-2">
                      <Progress
                        value={(() => {
                          const required = Number(week.test?.requiredDays ?? week.days.length ?? 7);
                          const completed = week.days.filter((d) => d.status === "completed").length;
                          return required ? (completed / required) * 100 : 0;
                        })()}
                        className="h-1.5 bg-muted"
                      />
                    </div>
                  )}
                </div>
              </button>

              {/* Expanded Week View */}
              <AnimatePresence>
                {expandedWeek === week.week && week.status !== "locked" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="ml-20 mt-2 overflow-hidden"
                  >
                    <div className="space-y-2">
                      {week.days.map((day) => (
                        <div
                          key={day.day}
                          className={`glass-card p-3 flex items-center gap-3 ${
                            day.status === "pending" ? "opacity-60" : ""
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            day.status === "completed"
                              ? "bg-success text-success-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {day.status === "completed" ? <CheckCircle2 className="w-4 h-4" /> : day.day}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">Day {day.day}: {day.topic}</div>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Button size="sm" variant="outline" asChild>
                                <a
                                  href={`https://www.geeksforgeeks.org/search/${encodeURIComponent(String(day.topic ?? "").trim())}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1"
                                >
                                  <ExternalLink className="w-4 h-4" /> GFG
                                </a>
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => openTopicInfo(day.topic)}>
                                AI Info
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => openYoutube(day.topic)}>
                                YouTube
                              </Button>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={day.status === "completed"}
                              onClick={async () => {
                                try {
                                  const res = await api.roadmapCompleteDay(week.week, day.day);
                                  await loadRoadmap();

                                  const awarded = Boolean(res?.checkIn?.awarded);
                                  const milestone = res?.checkIn?.streakMilestone as 7 | 30 | undefined;
                                  const unlocked = (res?.checkIn?.unlockedBadges ?? []) as string[];

                                  await refreshUser();

                                  if (awarded) toast({ title: "Daily check-in", description: "+1 Health Point" });
                                  if (milestone) toast({ title: "Streak milestone!", description: `${milestone}-day streak 🔥` });
                                  if (unlocked.length) toast({ title: "Badge unlocked", description: unlocked.join(", ") });
                                } catch (e: any) {
                                  setError(e?.error ?? "Failed to mark day as done.");
                                }
                              }}
                            >
                              {day.status === "completed" ? "Done" : "Mark Done"}
                            </Button>
                          </div>
                        </div>
                      ))}

                      {/* Weekly Test */}
                      {week.week <= 12 && (
                        <div className={`glass-card p-4 border-2 ${
                          week.testAvailable ? "border-primary/30" : "border-border opacity-50"
                        }`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              week.testAvailable ? "gradient-primary" : "bg-muted"
                            }`}>
                              <FileText className={`w-5 h-5 ${week.testAvailable ? "text-primary-foreground" : "text-muted-foreground"}`} />
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-sm">Week {week.week} Test</div>
                              <div className="text-xs text-muted-foreground">
                                {(() => {
                                  const required = Number(week.test?.requiredDays ?? 7);
                                  const completedDays = Number(
                                    week.test?.completedDays ?? week.days.filter((d) => d.status === "completed").length
                                  );
                                  if (week.testAvailable) return `Completed: ${completedDays}/${required} ✓ — Test is available!`;
                                  return `Completed: ${completedDays}/${required} — Complete all days to unlock this test`;
                                })()}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              disabled={!week.testAvailable || week.status === "completed"}
                              className={week.testAvailable ? "gradient-primary text-primary-foreground border-0" : ""}
                              onClick={async () => {
                                await openWeeklyTest(week.week);
                              }}
                            >
                              {week.status === "completed" ? "Passed" : week.testAvailable ? "Take Test" : "Locked"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}

          <Dialog
            open={testOpen}
            onOpenChange={(open) => {
              setTestOpen(open);
              if (!open) {
                setTestWeek(null);
                setTestError(null);
                setTestResult(null);
                setTestSessionId("");
                setTestQuestions([]);
                setTestAnswers({});
              }
            }}
          >
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Weekly Test{testWeek ? ` · Week ${testWeek}` : ""}</DialogTitle>
                <DialogDescription>
                  Pass the test to unlock the next week.
                </DialogDescription>
              </DialogHeader>

              {testLoading && <p className="text-sm text-muted-foreground">Loading questions...</p>}
              {testError && !testLoading && (
                <div className="glass-card p-3 text-sm text-destructive">{testError}</div>
              )}

              {testResult && (
                <div className="glass-card p-4">
                  <div className="font-semibold">Result</div>
                  <div className="text-sm text-muted-foreground">Score: {testResult.score}/{testResult.totalQuestions}</div>
                  <div className="text-sm text-muted-foreground">Percentage: {Math.round(testResult.percentage)}%</div>
                  <div className="text-sm font-semibold">{testResult.passed ? "Passed ✓" : "Not passed"}</div>
                </div>
              )}

              {!testLoading && !testResult && testQuestions.length > 0 && (
                <div className="space-y-4 max-h-[55vh] overflow-auto pr-2">
                  {testQuestions.map((q, idx) => (
                    <div key={q.id} className="glass-card p-4">
                      <div className="text-sm font-medium mb-3">Q{idx + 1}. {q.question}</div>
                      <div className="grid gap-2">
                        {q.options.map((opt, i) => (
                          <label key={i} className="flex items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name={`weekly-q-${q.id}`}
                              value={opt}
                              checked={testAnswers[q.id] === opt}
                              onChange={() => setTestAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setTestOpen(false)}>
                  {testResult ? "Close" : "Cancel"}
                </Button>
                <Button
                  className="gradient-primary text-primary-foreground border-0"
                  disabled={testLoading || !testSessionId || testQuestions.length === 0 || testSubmitting || Boolean(testResult)}
                  onClick={submitWeeklyTest}
                >
                  {testSubmitting ? "Submitting..." : "Submit Test"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Grand Test */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={roadmap.length + 1}
            className="relative mt-8"
          >
            <div className={`ml-20 glass-card p-6 border-2 ${week12Completed ? "border-accent/30" : "border-border opacity-50"}`}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl gradient-accent flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-accent-foreground" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-lg">Grand Final Test</div>
                  <div className="text-sm text-muted-foreground">
                    {certificate
                      ? "Certificate issued — you’ve completed the grand test."
                      : "Unlock after completing Week 1–12 and passing all weekly tests."}
                  </div>
                  {certificate && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Certificate ID: <span className="font-medium text-foreground">{certificate.certificateId}</span> · Score: {Math.round(Number(certificate.percentage ?? 0))}%
                    </div>
                  )}
                </div>
                <Button
                  variant={week12Completed ? "default" : "secondary"}
                  className={week12Completed ? "gradient-accent text-accent-foreground border-0" : ""}
                  disabled={!week12Completed}
                  onClick={openGrandTest}
                >
                  {certificate ? "View" : week12Completed ? "Take Test" : "Locked"}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>

        <Dialog
          open={grandOpen}
          onOpenChange={(open) => {
            setGrandOpen(open);
            if (!open) {
              setGrandError(null);
              setGrandResult(null);
              setGrandSessionId("");
              setGrandQuestions([]);
              setGrandAnswers({});
            }
          }}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Grand Final Test</DialogTitle>
              <DialogDescription>
                Pass with 50% to receive your certificate.
              </DialogDescription>
            </DialogHeader>

            {grandLoading && <p className="text-sm text-muted-foreground">Loading questions...</p>}
            {grandError && !grandLoading && (
              <div className="glass-card p-3 text-sm text-destructive">{grandError}</div>
            )}

            {grandResult?.alreadyCertified && certificate && (
              <div className="glass-card p-4">
                <div className="font-semibold">Certificate</div>
                <div className="text-sm text-muted-foreground">Certificate ID: {certificate.certificateId}</div>
                <div className="text-sm text-muted-foreground">Percentage: {Math.round(Number(certificate.percentage ?? 0))}%</div>
              </div>
            )}

            {grandResult && grandResult?.ok && (
              <div className="glass-card p-4">
                <div className="font-semibold">Result</div>
                <div className="text-sm text-muted-foreground">Score: {grandResult.score}/{grandResult.totalQuestions}</div>
                <div className="text-sm text-muted-foreground">Percentage: {Math.round(grandResult.percentage)}%</div>
                <div className="text-sm font-semibold">{grandResult.passed ? "Passed ✓" : "Not passed"}</div>
                {grandResult.certificate && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    Certificate ID: <span className="font-medium text-foreground">{grandResult.certificate.certificateId}</span>
                  </div>
                )}
              </div>
            )}

            {!grandLoading && !grandResult && grandQuestions.length > 0 && (
              <div className="space-y-4 max-h-[55vh] overflow-auto pr-2">
                {grandQuestions.map((q, idx) => (
                  <div key={q.id} className="glass-card p-4">
                    <div className="text-sm font-medium mb-3">Q{idx + 1}. {q.question}</div>
                    <div className="grid gap-2">
                      {q.options.map((opt, i) => (
                        <label key={i} className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name={`grand-q-${q.id}`}
                            value={opt}
                            checked={grandAnswers[q.id] === opt}
                            onChange={() => setGrandAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setGrandOpen(false)}>
                {grandResult ? "Close" : "Cancel"}
              </Button>
              <Button
                className="gradient-accent text-accent-foreground border-0"
                disabled={grandLoading || !grandSessionId || grandQuestions.length === 0 || grandSubmitting || Boolean(grandResult)}
                onClick={submitGrandTest}
              >
                {grandSubmitting ? "Submitting..." : "Submit Test"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={infoOpen}
          onOpenChange={(open) => {
            setInfoOpen(open);
            if (!open) {
              setInfoTopic("");
              setInfoError(null);
              setInfoData(null);
            }
          }}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>AI Info · {infoTopic}</DialogTitle>
              <DialogDescription>Generated using Groq and Gemini for this topic.</DialogDescription>
            </DialogHeader>

            {infoLoading && <p className="text-sm text-muted-foreground">Generating info...</p>}
            {infoError && !infoLoading && <div className="glass-card p-3 text-sm text-destructive">{infoError}</div>}

            {!infoLoading && infoData && (
              <Tabs defaultValue="groq" className="w-full">
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="groq">Groq</TabsTrigger>
                  <TabsTrigger value="gemini">Gemini</TabsTrigger>
                </TabsList>

                <TabsContent value="groq" className="mt-4">
                  {!infoData.groq?.ok && (
                    <div className="glass-card p-3 text-sm text-destructive">{infoData.groq?.error ?? "Groq not available"}</div>
                  )}
                  {infoData.groq?.ok && (
                    <div className="glass-card p-4 max-h-[55vh] overflow-auto">
                      <div className="text-sm whitespace-pre-wrap">{infoData.groq?.text}</div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="gemini" className="mt-4">
                  {!infoData.gemini?.ok && (
                    <div className="glass-card p-3 text-sm text-destructive">{infoData.gemini?.error ?? "Gemini not available"}</div>
                  )}
                  {infoData.gemini?.ok && (
                    <div className="glass-card p-4 max-h-[55vh] overflow-auto">
                      <div className="text-sm whitespace-pre-wrap">{infoData.gemini?.text}</div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setInfoOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={ytOpen}
          onOpenChange={(open) => {
            setYtOpen(open);
            if (!open) {
              setYtTopic("");
              setYtError(null);
              setYtVideos([]);
              setYtSource("");
            }
          }}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>YouTube · {ytTopic}</DialogTitle>
              <DialogDescription>
                {ytSource === "rapidapi"
                  ? "Videos fetched via RapidAPI (YouTube v2)."
                  : "Videos fetched via YouTube Data API v3."}
              </DialogDescription>
            </DialogHeader>

            {ytLoading && <p className="text-sm text-muted-foreground">Loading videos...</p>}
            {ytError && !ytLoading && <div className="glass-card p-3 text-sm text-destructive">{ytError}</div>}

            {!ytLoading && !ytError && (
              <div className="space-y-3 max-h-[55vh] overflow-auto pr-2">
                {ytVideos.length === 0 && (
                  <div className="text-sm text-muted-foreground">No videos found.</div>
                )}
                {ytVideos.map((v: any) => (
                  <a
                    key={v.videoId}
                    href={v.url}
                    target="_blank"
                    rel="noreferrer"
                    className="glass-card p-3 block hover:shadow-soft transition"
                  >
                    <div className="flex gap-3">
                      {v.thumbnailUrl && (
                        <img
                          src={v.thumbnailUrl}
                          alt={v.title}
                          className="w-28 h-16 object-cover rounded-md bg-muted"
                          loading="lazy"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{v.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{v.channelTitle}</div>
                        <div className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> Open on YouTube
                        </div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setYtOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
