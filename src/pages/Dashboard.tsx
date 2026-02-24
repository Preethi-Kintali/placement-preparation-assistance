import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Brain, Code2, Users, Briefcase, Lock, CheckCircle2, Clock,
  ArrowRight, Trophy, Target, Sparkles,
  TrendingUp, TrendingDown, BarChart3, Filter, ArrowUpDown, Award
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Navbar } from "@/components/Navbar";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0, 0, 0.2, 1] as const },
  }),
};

const exams = [
  {
    title: "Aptitude Test",
    icon: Brain,
    questions: 15,
    time: "15 min",
    status: "available" as const,
    color: "from-blue-500 to-cyan-500",
    key: "aptitude",
  },
  {
    title: "DSA Test",
    icon: Code2,
    questions: 15,
    time: "20 min",
    status: "locked" as const,
    color: "from-indigo-500 to-purple-500",
    key: "dsa",
  },
  {
    title: "Soft Skills Test",
    icon: Users,
    questions: 15,
    time: "15 min",
    status: "locked" as const,
    color: "from-amber-500 to-orange-500",
    key: "soft_skills",
  },
  {
    title: "Career Path Test",
    icon: Briefcase,
    questions: 15,
    time: "20 min",
    status: "locked" as const,
    color: "from-emerald-500 to-teal-500",
    key: "career",
  },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [status, setStatus] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [prediction, setPrediction] = useState<any | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [resultsFilter, setResultsFilter] = useState<string>("all");
  const [resultsSort, setResultsSort] = useState<string>("highest");
  const [detailsOpen, setDetailsOpen] = useState<string | null>(null);
  const [roadmapStats, setRoadmapStats] = useState<{ completedWeeks: number; totalWeeks: number } | null>(null);
  const [interviewAvg, setInterviewAvg] = useState<number | null>(null);

  useEffect(() => {
    api.examStatus()
      .then(setStatus)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // If the user updates their profile (Profile page), ensure cached prediction doesn't stay stale.
  useEffect(() => {
    setPrediction(null);
  }, [
    user?.profile?.fullName,
    user?.profile?.phone,
    user?.profile?.experience?.projectCount,
    user?.profile?.experience?.internshipsCount,
    user?.profile?.experience?.workshopsCertificationsCount,
    user?.profile?.education?.tenthPercent,
    user?.profile?.education?.twelfthPercent,
    user?.profile?.education?.btechCgpa,
  ]);

  useEffect(() => {
    api.interviewSessions()
      .then((res) => {
        const sessions = Array.isArray(res?.sessions) ? res.sessions : [];
        if (!sessions.length) {
          setInterviewAvg(null);
          return;
        }
        const avg = sessions.reduce((s: number, a: any) => s + (Number(a?.overallScore) || 0), 0) / sessions.length;
        setInterviewAvg(Number(avg.toFixed(2)));
      })
      .catch(() => setInterviewAvg(null));
  }, []);

  const loadPrediction = async () => {
    setPredictionLoading(true);
    try {
      const res = await api.placementPrediction();
      setPrediction(res);
    } catch {
      setPrediction(null);
    } finally {
      setPredictionLoading(false);
    }
  };

  const userName = user?.profile?.fullName?.split(" ")[0] || "Student";
  const targetCompany = user?.profile?.career?.targetCompany || "your dream company";
  const careerPath = user?.profile?.career?.careerPath || "Full Stack Developer";
  const targetLpa = user?.profile?.career?.targetLpa || 20;

  const allExamsDone = Boolean(status?.aptitude?.latest && status?.dsa?.latest && status?.soft_skills?.latest && status?.career?.latest);

  const completedExams = exams
    .map((e) => ({
      ...e,
      latest: status?.[e.key]?.latest ?? null,
      previous: status?.[e.key]?.previous ?? null,
      completed: Boolean(status?.[e.key]?.latest),
    }))
    .filter((e) => e.completed);

  useEffect(() => {
    if (!allExamsDone) {
      setRoadmapStats(null);
      return;
    }

    api.roadmap()
      .then((res) => {
        const weeks = Array.isArray(res?.weeks) ? res.weeks : [];
        const totalWeeks = weeks.length;
        const completedWeeks = weeks.filter((w: any) => w?.status === "completed").length;
        if (!totalWeeks) {
          setRoadmapStats(null);
          return;
        }
        setRoadmapStats({ completedWeeks, totalWeeks });
      })
      .catch(() => setRoadmapStats(null));
  }, [allExamsDone]);

  const pct = (attempt: any | null | undefined) =>
    typeof attempt?.percentage === "number" ? Number(attempt.percentage) : null;

  const scoreColor = (percentage: number) => {
    if (percentage < 30) return { bar: "bg-destructive", text: "text-destructive" };
    if (percentage < 70) return { bar: "bg-accent", text: "text-accent" };
    return { bar: "bg-success", text: "text-success" };
  };

  const gradeVariant = (grade: string) => {
    const g = String(grade || "").toUpperCase();
    if (["A+", "A", "B+", "B"].includes(g)) return "default" as const;
    if (["C", "D"].includes(g)) return "secondary" as const;
    return "destructive" as const;
  };

  const latestPcts = completedExams
    .map((e) => ({ key: e.key, title: e.title, value: pct(e.latest) }))
    .filter((x) => typeof x.value === "number") as { key: string; title: string; value: number }[];

  const previousPcts = completedExams
    .map((e) => ({ key: e.key, value: pct(e.previous) }))
    .filter((x) => typeof x.value === "number") as { key: string; value: number }[];

  const avgLatest = latestPcts.length ? latestPcts.reduce((s, x) => s + x.value, 0) / latestPcts.length : 0;
  const avgPrevious = previousPcts.length ? previousPcts.reduce((s, x) => s + x.value, 0) / previousPcts.length : null;
  const avgDelta = typeof avgPrevious === "number" ? avgLatest - avgPrevious : null;

  const strongest = latestPcts.slice().sort((a, b) => b.value - a.value)[0];
  const weakest = latestPcts.slice().sort((a, b) => a.value - b.value)[0];

  const roadmapPercent = roadmapStats?.totalWeeks
    ? (roadmapStats.completedWeeks / roadmapStats.totalWeeks) * 100
    : null;
  const interviewPercent = typeof interviewAvg === "number" ? interviewAvg * 10 : null;

  const readinessPercent = (() => {
    const parts: Array<{ value: number; weight: number }> = [];
    if (completedExams.length > 0) parts.push({ value: avgLatest, weight: 0.5 });
    if (typeof roadmapPercent === "number") parts.push({ value: roadmapPercent, weight: 0.3 });
    if (typeof interviewPercent === "number") parts.push({ value: interviewPercent, weight: 0.2 });
    if (!parts.length) return 0;
    const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
    return parts.reduce((s, p) => s + p.value * (p.weight / totalWeight), 0);
  })();

  const readinessLevel = readinessPercent >= 85 ? "Excellent" : readinessPercent >= 70 ? "Good" : readinessPercent >= 40 ? "Fair" : "Getting Started";
  const ranking = readinessPercent >= 85 ? "Top 10%" : readinessPercent >= 70 ? "Top 25%" : readinessPercent >= 40 ? "Top 50%" : "Keep going";

  const filteredResults = completedExams
    .filter((e) => (resultsFilter === "all" ? true : e.key === resultsFilter))
    .slice()
    .sort((a, b) => {
      const ap = pct(a.latest) ?? 0;
      const bp = pct(b.latest) ?? 0;
      if (resultsSort === "lowest") return ap - bp;
      if (resultsSort === "recent") {
        const ad = new Date(a.latest?.createdAt ?? 0).getTime();
        const bd = new Date(b.latest?.createdAt ?? 0).getTime();
        return bd - ad;
      }
      return bp - ap;
    });

  const CircularReadiness = ({ value }: { value: number }) => {
    const size = 112;
    const stroke = 10;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.max(0, Math.min(100, value));
    const offset = circumference - (clamped / 100) * circumference;

    return (
      <div className="relative w-[112px] h-[112px]">
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id="readinessGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(var(--accent))" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="hsl(var(--border))"
            strokeWidth={stroke}
            fill="transparent"
            opacity={0.6}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#readinessGrad)"
            strokeWidth={stroke}
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: offset }}
            initial={{ strokeDashoffset: circumference }}
            transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-extrabold">{Math.round(clamped)}%</div>
            <div className="text-[11px] text-muted-foreground">Readiness</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />

      <main className="pt-20 pb-16 container mx-auto px-4">
        {/* Welcome */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={0}
          className="glass-card p-6 md:p-8 mb-6 relative overflow-hidden"
        >
          <div className="absolute inset-0 gradient-primary opacity-5" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-1">Welcome back, {userName}! 👋</h1>
              <p className="text-muted-foreground">
                <Target className="w-4 h-4 inline mr-1" />
                Targeting <span className="font-semibold text-foreground">{targetCompany}</span> · {careerPath} · {targetLpa} LPA
              </p>
            </div>
            {allExamsDone ? (
              <Link to="/roadmap">
                <Button className="border-0 gap-2 shadow-glow gradient-primary text-primary-foreground">
                  View Roadmap <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            ) : (
              <Button className="border-0 gap-2 bg-muted text-muted-foreground" disabled>
                View Roadmap <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </motion.div>

        {/* KPI Summary */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1} className="grid gap-4 md:grid-cols-5 mb-8">
          <Card className="transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 border-0">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">Tests Taken</div>
                <BarChart3 className="w-4 h-4 text-primary" />
              </div>
              <CardTitle className="text-2xl">{completedExams.length}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              {completedExams.length === 0 ? "No attempts yet" : "Latest attempts"}
            </CardContent>
          </Card>

          <Card className="transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 border-0">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">Average Score</div>
                <ArrowUpDown className="w-4 h-4 text-primary" />
              </div>
              <CardTitle className="text-2xl">{Math.round(avgLatest)}%</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              {avgDelta == null ? (
                "No previous attempt"
              ) : avgDelta >= 0 ? (
                <span className="inline-flex items-center gap-1 text-success"><TrendingUp className="w-3.5 h-3.5" /> +{Math.round(avgDelta)}%</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-destructive"><TrendingDown className="w-3.5 h-3.5" /> {Math.round(avgDelta)}%</span>
              )}
            </CardContent>
          </Card>

          <Card className="transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 border-0">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">Strongest</div>
                <Award className="w-4 h-4 text-success" />
              </div>
              <CardTitle className="text-base truncate">{strongest?.title ?? "-"}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              {strongest ? `${Math.round(strongest.value)}%` : "Complete a test"}
            </CardContent>
          </Card>

          <Card className="transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 border-0">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">Weakest</div>
                <TrendingDown className="w-4 h-4 text-warning" />
              </div>
              <CardTitle className="text-base truncate">{weakest?.title ?? "-"}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              {weakest ? `${Math.round(weakest.value)}%` : "Complete a test"}
            </CardContent>
          </Card>

          <Card className="transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 border-0">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">Readiness Level</div>
                <Sparkles className="w-4 h-4 text-accent" />
              </div>
              <CardTitle className="text-base">{readinessLevel}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">{ranking}</CardContent>
          </Card>
        </motion.div>

        {/* Overall Readiness */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2} className="mb-8">
          <Card className="shadow-sm border-0">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <CircularReadiness value={readinessPercent} />
                  <div>
                    <div className="text-sm font-semibold flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-accent" /> Overall Readiness
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Based on roadmap progress, test scores, and interview performance.
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{ranking}</Badge>
                      <Badge variant="outline">{readinessLevel}</Badge>
                      {avgDelta != null && (
                        <Badge variant={avgDelta >= 0 ? "default" : "destructive"}>
                          {avgDelta >= 0 ? `+${Math.round(avgDelta)}%` : `${Math.round(avgDelta)}%`} vs previous
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-xl bg-muted/40 p-3">
                    <div className="text-xs text-muted-foreground">Assessments Done</div>
                    <div className="font-semibold">{completedExams.length}/4</div>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3">
                    <div className="text-xs text-muted-foreground">Avg Score</div>
                    <div className="font-semibold">{Math.round(avgLatest)}%</div>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3">
                    <div className="text-xs text-muted-foreground">Next Step</div>
                    <div className="font-semibold">
                      {allExamsDone ? (roadmapStats && roadmapStats.completedWeeks < roadmapStats.totalWeeks ? "Continue Roadmap" : "Roadmap") : "Take tests"}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Assessments / Prediction / Improve */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3} className="mb-8">
          <Card className="shadow-sm border-0">
            <CardContent className="p-6">
              <Tabs defaultValue="assessments" className="w-full">
                <TabsList className="grid grid-cols-3 w-full rounded-xl bg-muted p-1">
                  <TabsTrigger
                    value="assessments"
                    className="rounded-lg flex items-center justify-center gap-2 transition-all duration-300 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:font-semibold hover:bg-background/60"
                  >
                    <Trophy className="w-4 h-4" />
                    <span className="hidden sm:inline">Assessments</span>
                    <span className="sm:hidden">Tests</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="prediction"
                    onClick={() => {
                      if (!prediction && !predictionLoading) loadPrediction();
                    }}
                    className="rounded-lg flex items-center justify-center gap-2 transition-all duration-300 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:font-semibold hover:bg-background/60"
                  >
                    <Target className="w-4 h-4" />
                    <span className="hidden sm:inline">Prediction</span>
                    <span className="sm:hidden">Chance</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="improve"
                    onClick={() => {
                      if (!prediction && !predictionLoading) loadPrediction();
                    }}
                    className="rounded-lg flex items-center justify-center gap-2 transition-all duration-300 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:font-semibold hover:bg-background/60"
                  >
                    <Sparkles className="w-4 h-4" /> Improve
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="assessments" className="mt-4">
                  <div className="rounded-xl bg-background p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">Your Assessments</div>
                        <div className="text-xs text-muted-foreground">Take the tests in order to unlock your roadmap.</div>
                      </div>
                      <Badge variant={allExamsDone ? "default" : "secondary"}>{allExamsDone ? "Unlocked" : "Locked"}</Badge>
                    </div>
                  </div>
                </TabsContent>

            <TabsContent value="prediction" className="mt-4">
                  <div className="rounded-xl bg-background p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">Placement Chance</div>
                    <div className="text-xs text-muted-foreground">Based on your profile + latest assessment scores</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={loadPrediction} disabled={predictionLoading}>
                    {predictionLoading ? "Calculating..." : "Refresh"}
                  </Button>
                </div>

                {prediction && (
                  <div className="mt-4">
                    <div className="flex items-end justify-between gap-3">
                      <div className="text-3xl font-bold gradient-text">{prediction.probability}%</div>
                      <div className="text-xs text-muted-foreground text-right">Refresh after updating Profile</div>
                    </div>
                    <Progress value={prediction.probability} className="h-3 bg-muted mt-2" />
                    {Array.isArray(prediction.checklist) && prediction.checklist.length > 0 && (
                      <div className="mt-4">
                        <div className="font-semibold text-sm mb-2">Other things to do</div>
                        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                          {prediction.checklist.map((c: string) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {!prediction && !predictionLoading && (
                  <div className="mt-4 text-sm text-muted-foreground">Click “Refresh” to generate your placement prediction.</div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="improve" className="mt-4">
              <div className="rounded-xl bg-background p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">Improve Your Chances</div>
                    <div className="text-xs text-muted-foreground">Action items based on your current profile inputs</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={loadPrediction} disabled={predictionLoading}>
                    {predictionLoading ? "Loading..." : prediction ? "Refresh" : "Load"}
                  </Button>
                </div>

                {prediction && (
                  <div className="mt-4 grid md:grid-cols-2 gap-3">
                    <div className="glass-card p-4 shadow-sm">
                      <div className="font-semibold text-sm mb-2">Your current inputs</div>
                      <div className="text-sm text-muted-foreground grid gap-1">
                        <div>
                          Internships: <span className="text-foreground font-medium">{prediction.inputsUsed?.internships ? "Yes" : "No"}</span>
                        </div>
                        <div>
                          Projects: <span className="text-foreground font-medium">{prediction.inputsUsed?.projects ?? 0}</span>
                        </div>
                        <div>
                          Workshops/Certifications:{" "}
                          <span className="text-foreground font-medium">{prediction.inputsUsed?.workshopsCertifications ?? 0}</span>
                        </div>
                        <div>
                          CGPA: <span className="text-foreground font-medium">{prediction.inputsUsed?.cgpa ?? 0}</span>
                        </div>
                        <div>
                          SSC/HSC:{" "}
                          <span className="text-foreground font-medium">{prediction.inputsUsed?.sscMarks ?? 0}%</span> /{" "}
                          <span className="text-foreground font-medium">{prediction.inputsUsed?.hscMarks ?? 0}%</span>
                        </div>
                        {prediction.inputsUsed?.interviewOverall != null && (
                          <>
                            <div>
                              Interview Overall: <span className="text-foreground font-medium">{prediction.inputsUsed?.interviewOverall}/10</span>
                            </div>
                            <div>
                              Communication / DSA / Technical: <span className="text-foreground font-medium">{prediction.inputsUsed?.interviewCommunication}/10</span>
                              {" / "}
                              <span className="text-foreground font-medium">{prediction.inputsUsed?.interviewDsa}/10</span>
                              {" / "}
                              <span className="text-foreground font-medium">{prediction.inputsUsed?.interviewTechnical}/10</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="glass-card p-4 shadow-sm">
                      <div className="font-semibold text-sm mb-2">What to do next</div>
                      <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                        {!prediction.inputsUsed?.internships && <li>Get at least 1 internship (even remote / short-term)</li>}
                        {(prediction.inputsUsed?.projects ?? 0) < 3 && <li>Build 3+ solid projects (deployed + GitHub)</li>}
                        {(prediction.inputsUsed?.workshopsCertifications ?? 0) < 2 && (
                          <li>Complete 2–3 workshops/certifications (cloud, devops, security, etc.)</li>
                        )}
                        <li>Keep applying weekly and track applications</li>
                        <li>Do mock interviews and improve weak areas</li>
                      </ul>

                      {Array.isArray(prediction.checklist) && prediction.checklist.length > 0 && (
                        <>
                          <div className="font-semibold text-sm mt-4 mb-2">Priority actions (AI + profile)</div>
                          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                            {prediction.checklist.map((c: string) => (
                              <li key={c}>{c}</li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {!prediction && !predictionLoading && (
                  <div className="mt-4 text-sm text-muted-foreground">Click “Load” to see personalized actions.</div>
                )}
              </div>
            </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>

        {/* Completed Results (cards) */}
        {completedExams.length > 0 && (
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={4} className="mb-8">
            <Card className="shadow-sm border-0">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                  <div>
                    <div className="text-lg font-semibold">Completed Results</div>
                    <div className="text-xs text-muted-foreground">Filter and review your latest assessment scores</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-[180px]">
                      <Select value={resultsFilter} onValueChange={setResultsFilter}>
                        <SelectTrigger className="h-9 border-0 shadow-sm bg-background">
                          <Filter className="w-4 h-4 mr-2 opacity-70" />
                          <SelectValue placeholder="Filter" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="aptitude">Aptitude</SelectItem>
                          <SelectItem value="dsa">DSA</SelectItem>
                          <SelectItem value="soft_skills">Soft Skills</SelectItem>
                          <SelectItem value="career">Career</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="min-w-[190px]">
                      <Select value={resultsSort} onValueChange={setResultsSort}>
                        <SelectTrigger className="h-9 border-0 shadow-sm bg-background">
                          <ArrowUpDown className="w-4 h-4 mr-2 opacity-70" />
                          <SelectValue placeholder="Sort" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="highest">Highest score</SelectItem>
                          <SelectItem value="lowest">Lowest score</SelectItem>
                          <SelectItem value="recent">Most recent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {allExamsDone && (
                      <Link to="/roadmap">
                        <Button size="sm" className="gradient-primary text-primary-foreground border-0">View Roadmap</Button>
                      </Link>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {filteredResults.map((e) => {
                    const percent = pct(e.latest) ?? 0;
                    const color = scoreColor(percent);
                    const isOpen = detailsOpen === e.key;
                    const prev = pct(e.previous);
                    const delta = typeof prev === "number" ? percent - prev : null;
                    const takenAt = e.latest?.createdAt ? new Date(e.latest.createdAt) : null;
                    const durationMin = typeof e.latest?.durationSeconds === "number" ? Math.max(1, Math.round(e.latest.durationSeconds / 60)) : null;
                    return (
                      <Card
                        key={e.key}
                        className="transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 border-0"
                      >
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                                  <e.icon className="w-5 h-5 text-primary" />
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold truncate">{e.title}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Score {e.latest?.score ?? "-"}/{e.latest?.totalQuestions ?? "-"}
                                    {delta == null ? "" : delta >= 0 ? ` · +${Math.round(delta)}% vs prev` : ` · ${Math.round(delta)}% vs prev`}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 text-right">
                              <div className={`text-2xl font-extrabold ${color.text}`}>{Math.round(percent)}%</div>
                              <div className="mt-1 flex items-center justify-end gap-2">
                                <Badge variant={gradeVariant(String(e.latest?.grade ?? ""))}>
                                  {String(e.latest?.grade ?? "-")}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4">
                            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                              <div className={`h-full ${color.bar} transition-all duration-300`} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                              <span>{percent < 30 ? "Weak" : percent < 70 ? "Good" : "Strong"}</span>
                              <span>{takenAt ? takenAt.toLocaleDateString() : ""}</span>
                            </div>
                          </div>

                          <div className="mt-4 flex items-center justify-between">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="shadow-sm"
                              onClick={() => setDetailsOpen((cur) => (cur === e.key ? null : e.key))}
                            >
                              {isOpen ? "Hide Details" : "View Details"}
                            </Button>
                            <div className="text-xs text-muted-foreground">
                              {durationMin ? `${durationMin} min` : ""}
                            </div>
                          </div>

                          {isOpen && (
                            <div className="mt-4 rounded-xl bg-muted/30 p-4 text-sm shadow-sm">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <div className="text-xs text-muted-foreground">Grade</div>
                                  <div className="font-semibold">{e.latest?.grade ?? "-"}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">Percentage</div>
                                  <div className="font-semibold">{Math.round(percent)}%</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">Correct</div>
                                  <div className="font-semibold">{e.latest?.score ?? "-"}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">Wrong</div>
                                  <div className="font-semibold">
                                    {typeof e.latest?.totalQuestions === "number" && typeof e.latest?.score === "number"
                                      ? Math.max(0, e.latest.totalQuestions - e.latest.score)
                                      : "-"}
                                  </div>
                                </div>
                              </div>
                              <div className="mt-3 text-xs text-muted-foreground">
                                {takenAt ? `Taken on ${takenAt.toLocaleString()}` : ""}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Exam Cards */}
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" /> Assessment Tests
        </h2>

        {allExamsDone && (
          <div className="glass-card p-5 mb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">All assessments completed 🎉</div>
                <div className="text-sm text-muted-foreground">Your personalized roadmap is now unlocked.</div>
              </div>
              <Link to="/exam/aptitude">
                <Button size="sm" variant="outline">Take retest (optional)</Button>
              </Link>
            </div>
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {exams.map((exam, i) => {
            const unlocked = status?.[exam.key]?.unlocked ?? exam.status !== "locked";
            const completed = Boolean(status?.[exam.key]?.latest);
            const isLocked = !unlocked;
            if (completed) return null;
            return (
              <motion.div
                key={exam.title}
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                custom={i + 2}
                className={`glass-card-hover p-6 relative shadow-sm ${isLocked ? "opacity-60" : ""}`}
              >
                {isLocked && (
                  <div className="absolute top-4 right-4">
                    <Lock className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}

                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${exam.color} flex items-center justify-center mb-4`}>
                  <exam.icon className="w-6 h-6 text-primary-foreground" />
                </div>

                <h3 className="text-lg font-semibold mb-2">{exam.title}</h3>

                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {exam.questions} Questions
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {exam.time}
                  </span>
                </div>

                <Link to={`/exam/${exam.key}`}>
                  <Button
                    variant={!isLocked ? "default" : "secondary"}
                    className={!isLocked ? "gradient-primary text-primary-foreground border-0 gap-2" : "gap-2"}
                    disabled={isLocked || loading}
                  >
                    {!isLocked ? (
                      <>Start Test <ArrowRight className="w-4 h-4" /></>
                    ) : (
                      <>Locked</>
                    )}
                  </Button>
                </Link>
              </motion.div>
            );
          })}
        </div>

      </main>
    </div>
  );
}
