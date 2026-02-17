import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Brain, Code2, Users, Briefcase, Lock, CheckCircle2, Clock,
  ArrowRight, Trophy, Target, Sparkles, MessageCircle, Mic
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Navbar } from "@/components/Navbar";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  // Calculate overall progress
  const calculateProgress = () => {
    if (!status) return 0;
    let completed = 0;
    if (status.aptitude?.latest) completed += 25;
    if (status.dsa?.latest) completed += 25;
    if (status.soft_skills?.latest) completed += 25;
    if (status.career?.latest) completed += 25;
    return completed;
  };

  const progressPercent = calculateProgress();
  const userName = user?.profile?.fullName?.split(" ")[0] || "Student";
  const targetCompany = user?.profile?.career?.targetCompany || "your dream company";
  const careerPath = user?.profile?.career?.careerPath || "Full Stack Developer";
  const targetLpa = user?.profile?.career?.targetLpa || 20;

  const allExamsDone = Boolean(status?.aptitude?.latest && status?.dsa?.latest && status?.soft_skills?.latest && status?.career?.latest);

  const completedExams = exams
    .map((e) => ({
      ...e,
      latest: status?.[e.key]?.latest ?? null,
      completed: Boolean(status?.[e.key]?.latest),
    }))
    .filter((e) => e.completed);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-20 pb-16 container mx-auto px-4">
        {/* Welcome */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={0}
          className="glass-card p-6 md:p-8 mb-8 relative overflow-hidden"
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

        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1} className="glass-card p-6 mb-8">
          <Tabs defaultValue="assessments" className="w-full">
            <TabsList className="grid grid-cols-3 w-full rounded-xl bg-muted/40 p-1">
              <TabsTrigger
                value="assessments"
                className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center justify-center gap-2"
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
                className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center justify-center gap-2"
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
                className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Improve
              </TabsTrigger>
            </TabsList>

            <TabsContent value="assessments" className="mt-4">
              <div className="rounded-xl bg-background/40 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-accent" /> Overall Readiness
                  </h2>
                  <span className="text-2xl font-bold gradient-text">{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} className="h-3 bg-muted" />
                <p className="text-xs text-muted-foreground mt-2">Complete assessments to unlock your roadmap</p>
              </div>
            </TabsContent>

            <TabsContent value="prediction" className="mt-4">
              <div className="rounded-xl bg-background/40 p-4">
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
              <div className="rounded-xl bg-background/40 p-4">
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
                    <div className="glass-card p-4">
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

                    <div className="glass-card p-4">
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
        </motion.div>

        {/* Exam Cards */}
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" /> Assessment Tests
        </h2>

        {completedExams.length > 0 && (
          <div className="glass-card p-6 mb-6">
            <div className="font-semibold mb-3">Completed Results</div>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              {completedExams.map((e) => (
                <div key={e.key} className="p-4 rounded-xl bg-muted/40">
                  <div className="font-medium">{e.title}</div>
                  <div className="text-muted-foreground">
                    Grade: <span className="font-semibold text-foreground">{e.latest?.grade ?? "-"}</span>
                    {" · "}Score: {e.latest?.score ?? "-"}/{e.latest?.totalQuestions ?? "-"}
                    {" · "}Pct: {typeof e.latest?.percentage === "number" ? Math.round(e.latest.percentage) + "%" : "-"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {allExamsDone && (
          <div className="glass-card p-5 mb-4">
            <div className="font-semibold">All assessments completed 🎉</div>
            <div className="text-sm text-muted-foreground">Your personalized roadmap is now unlocked.</div>
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
                className={`glass-card-hover p-6 relative ${isLocked ? "opacity-60" : ""}`}
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

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <Link to="/interview">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={6}
              className="glass-card-hover p-5 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center mb-3">
                <Mic className="w-5 h-5 text-accent-foreground" />
              </div>
              <h3 className="font-semibold text-sm">AI Mock Interview</h3>
              <p className="text-xs text-muted-foreground mt-1">Practice with AI interviewer</p>
            </motion.div>
          </Link>

          <Link to="/study-assistant">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={7}
              className="glass-card-hover p-5 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl gradient-success flex items-center justify-center mb-3">
                <MessageCircle className="w-5 h-5 text-success-foreground" />
              </div>
              <h3 className="font-semibold text-sm">AI Study Assistant</h3>
              <p className="text-xs text-muted-foreground mt-1">Ask what to study today</p>
            </motion.div>
          </Link>
        </div>
      </main>
    </div>
  );
}
