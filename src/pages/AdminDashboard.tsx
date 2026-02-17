import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Users, FileText, BarChart3, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Student {
  id: string;
  studentId: string;
  profile: {
    fullName: string;
    email: string;
    phone: string;
    career?: { careerPath?: string };
  };
  createdAt: string;
  latestRequirements?: any;
}

interface Stats {
  students: number;
  admins: number;
  attempts: number;
}

type RoadmapDay = { day: number; topic: string; category?: string };
type RoadmapWeek = { week: number; title: string; days: RoadmapDay[] };

export default function AdminDashboard() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [studentRoadmap, setStudentRoadmap] = useState<{ weeks: RoadmapWeek[]; unlockedWeek?: number; completedDays?: number } | null>(null);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [studentResults, setStudentResults] = useState<any | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  const [mlReport, setMlReport] = useState<any | null>(null);
  const [mlLoading, setMlLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [studentsRes, statsRes] = await Promise.all([
        api.adminStudents(),
        api.adminStats(),
      ]);
      setStudents(studentsRes.students || []);
      if (statsRes && !statsRes.error) setStats(statsRes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadMlReport = async () => {
    if (mlLoading) return;
    setMlLoading(true);
    try {
      const res = await api.adminPlacementReport();
      setMlReport(res);
    } catch {
      setMlReport(null);
    } finally {
      setMlLoading(false);
    }
  };

  const generateReq = async (id: string) => {
    setGenerating(id);
    try {
      await api.adminGenerateRequirements(id);
      await loadData();
    } finally {
      setGenerating(null);
    }
  };

  const toggleRoadmap = async (studentId: string) => {
    if (expandedStudent === studentId) {
      setExpandedStudent(null);
      setStudentRoadmap(null);
      setStudentResults(null);
      return;
    }

    setExpandedStudent(studentId);
    setRoadmapLoading(true);
    setResultsLoading(true);
    try {
      const [res, results] = await Promise.all([
        api.adminStudentRoadmap(studentId),
        api.adminStudentResults(studentId),
      ]);
      const weeks = (res.roadmap?.weeks || []).map((w: any) => ({
        week: w.week,
        title: w.title || `Week ${w.week}`,
        days: (w.days || []).map((d: any) => ({ day: d.day, topic: d.topic, category: d.category })),
      }));
      setStudentRoadmap({
        weeks,
        unlockedWeek: res.progress?.unlockedWeek,
        completedDays: res.progress?.completedDays?.length,
      });
      setStudentResults(results);
    } finally {
      setRoadmapLoading(false);
      setResultsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Welcome, {user?.profile?.fullName}</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="glass-card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.students}</div>
                  <div className="text-xs text-muted-foreground">Students</div>
                </div>
              </div>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.attempts}</div>
                  <div className="text-xs text-muted-foreground">Exam Attempts</div>
                </div>
              </div>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-success" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.admins}</div>
                  <div className="text-xs text-muted-foreground">Admins</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <Tabs defaultValue="students" className="w-full">
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="ml" onClick={() => { if (!mlReport && !mlLoading) loadMlReport(); }}>
              ML Report
            </TabsTrigger>
          </TabsList>

          <TabsContent value="students" className="mt-6">
            <h2 className="text-lg font-semibold mb-4">Students ({students.length})</h2>

            {loading && <p className="text-sm text-muted-foreground">Loading students...</p>}

            <div className="grid gap-4">
              {students.map((s) => (
                <div key={s.id} className="glass-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{s.profile.fullName}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.profile.email} · {s.studentId}
                    {s.profile.career?.careerPath && (
                      <span className="ml-2 text-primary">· {s.profile.career.careerPath}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Joined: {new Date(s.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleRoadmap(s.id)}
                    disabled={roadmapLoading && expandedStudent === s.id}
                  >
                    {expandedStudent === s.id ? "Hide Roadmap" : roadmapLoading && expandedStudent === s.id ? "Loading..." : "View Roadmap"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => generateReq(s.id)}
                    disabled={generating === s.id}
                  >
                    {generating === s.id ? "Generating..." : "Generate Requirements"}
                  </Button>
                </div>
              </div>

              {expandedStudent === s.id && (
                <div className="mt-3">
                  <div className="text-xs text-muted-foreground mb-2">
                    {studentRoadmap?.unlockedWeek ? `Unlocked Week: ${studentRoadmap.unlockedWeek} · ` : ""}
                    {typeof studentRoadmap?.completedDays === "number" ? `Completed Days: ${studentRoadmap.completedDays}` : ""}
                  </div>
                  {roadmapLoading && <p className="text-sm text-muted-foreground">Loading roadmap...</p>}
                  {!roadmapLoading && (!studentRoadmap?.weeks?.length) && (
                    <p className="text-sm text-muted-foreground">No roadmap generated yet for this student.</p>
                  )}
                  {!roadmapLoading && (studentRoadmap?.weeks || []).length > 0 && (
                    <div className="space-y-3">
                      {(studentRoadmap?.weeks || []).map((w) => (
                        <div key={w.week} className="bg-muted/30 rounded-lg p-3">
                          <div className="font-semibold text-sm">{w.title || `Week ${w.week}`}</div>
                          <div className="mt-2 grid gap-1">
                            {w.days.map((d) => (
                              <div key={d.day} className="text-xs text-muted-foreground">
                                Day {d.day}: {d.topic}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4">
                    <div className="font-semibold text-sm">Test Results</div>
                    {resultsLoading && <p className="text-sm text-muted-foreground">Loading results...</p>}
                    {!resultsLoading && studentResults && (
                      <div className="mt-2 space-y-3">
                        {/* Exams */}
                        <div className="bg-muted/30 rounded-lg p-3">
                          <div className="font-semibold text-xs mb-2">Assessments</div>
                          {(studentResults.exams || []).length === 0 && (
                            <div className="text-xs text-muted-foreground">No exam attempts yet.</div>
                          )}
                          {(studentResults.exams || []).slice(0, 8).map((e: any) => (
                            <div key={e.id} className="text-xs text-muted-foreground">
                              {String(e.examType).toUpperCase()} · {Math.round(e.percentage)}% · {e.score}/{e.totalQuestions} · {e.grade}
                            </div>
                          ))}
                        </div>

                        {/* Weekly tests */}
                        <div className="bg-muted/30 rounded-lg p-3">
                          <div className="font-semibold text-xs mb-2">Weekly Tests</div>
                          {(studentResults.weeklyTests || []).length === 0 && (
                            <div className="text-xs text-muted-foreground">No weekly tests submitted yet.</div>
                          )}
                          {(studentResults.weeklyTests || []).slice(0, 12).map((t: any) => (
                            <div key={t.id} className="text-xs text-muted-foreground">
                              Week {t.week} · {t.passed ? "Passed" : "Not passed"} · {typeof t.percentage === "number" ? Math.round(t.percentage) + "%" : "-"}
                            </div>
                          ))}
                        </div>

                        {/* Grand test + certificate */}
                        <div className="bg-muted/30 rounded-lg p-3">
                          <div className="font-semibold text-xs mb-2">Grand Test & Certificate</div>
                          {(studentResults.grandTests || []).length === 0 && (
                            <div className="text-xs text-muted-foreground">No grand test attempt yet.</div>
                          )}
                          {(studentResults.grandTests || []).slice(0, 1).map((g: any) => (
                            <div key={g.id} className="text-xs text-muted-foreground">
                              Grand Test · {g.passed ? "Passed" : "Not passed"} · {typeof g.percentage === "number" ? Math.round(g.percentage) + "%" : "-"}
                            </div>
                          ))}
                          {studentResults.certificate ? (
                            <div className="text-xs text-primary mt-1">
                              Certificate: {studentResults.certificate.certificateId} · {Math.round(studentResults.certificate.percentage)}%
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground mt-1">Certificate not issued.</div>
                          )}
                        </div>

                        {/* AI interview sessions */}
                        <div className="bg-muted/30 rounded-lg p-3">
                          <div className="font-semibold text-xs mb-2">AI Interview Sessions</div>
                          {(studentResults.interviewSessions || []).length === 0 && (
                            <div className="text-xs text-muted-foreground">No AI interview attempts yet.</div>
                          )}
                          {(studentResults.interviewSessions || []).slice(0, 10).map((s: any) => (
                            <div key={s.id} className="text-xs text-muted-foreground">
                              {new Date(s.completedAt).toLocaleDateString()} · Week {s.currentWeek} · Overall {Number(s.overallScore).toFixed(1)}/10
                              {` · Comm ${Number(s.communicationScore).toFixed(1)} · DSA ${Number(s.dsaScore).toFixed(1)} · Tech ${Number(s.technicalScore).toFixed(1)}`}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {s.latestRequirements && (
                <pre className="mt-3 text-xs bg-muted/40 p-3 rounded-lg overflow-auto max-h-40">
                  {JSON.stringify(s.latestRequirements, null, 2)}
                </pre>
              )}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="ml" className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Placement Model Report</h2>
              <Button variant="outline" size="sm" onClick={loadMlReport} disabled={mlLoading} className="gap-2">
                <RefreshCw className={`w-4 h-4 ${mlLoading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>

            {!mlReport && !mlLoading && (
              <div className="mt-4 text-sm text-muted-foreground">Click Refresh to load the ML report.</div>
            )}
            {mlLoading && (
              <div className="mt-4 text-sm text-muted-foreground">Loading ML report...</div>
            )}

            {mlReport && (
              <div className="mt-4 grid gap-4">
                <div className="glass-card p-4">
                  <div className="font-semibold text-sm">Model</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Algorithm: <span className="text-foreground font-medium">{mlReport.algorithm}</span>
                    {mlReport.sampleCount ? <span> · Dataset N={mlReport.sampleCount}</span> : null}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Holdout accuracy: <span className="text-foreground font-medium">{mlReport.holdoutAccuracyPct}%</span>
                    {typeof mlReport.holdoutAuc === "number" ? <span> · Holdout AUC: <span className="text-foreground font-medium">{mlReport.holdoutAuc}</span></span> : null}
                    {typeof mlReport.trainAccuracyPct === "number" ? <span> · Train: <span className="text-foreground font-medium">{mlReport.trainAccuracyPct}%</span></span> : null}
                  </div>
                </div>

                {mlReport.confusionMatrix && (
                  <div className="glass-card p-4">
                    <div className="font-semibold text-sm mb-2">Confusion Matrix (threshold {mlReport.confusionMatrix.threshold})</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-muted/30 rounded p-3">TP: <span className="font-medium text-foreground">{mlReport.confusionMatrix.tp}</span></div>
                      <div className="bg-muted/30 rounded p-3">FP: <span className="font-medium text-foreground">{mlReport.confusionMatrix.fp}</span></div>
                      <div className="bg-muted/30 rounded p-3">TN: <span className="font-medium text-foreground">{mlReport.confusionMatrix.tn}</span></div>
                      <div className="bg-muted/30 rounded p-3">FN: <span className="font-medium text-foreground">{mlReport.confusionMatrix.fn}</span></div>
                    </div>
                  </div>
                )}

                {Array.isArray(mlReport.featureImportance) && mlReport.featureImportance.length > 0 && (
                  <div className="glass-card p-4">
                    <div className="font-semibold text-sm mb-2">Feature Importance (AUC drop when shuffled)</div>
                    <div className="grid gap-1">
                      {mlReport.featureImportance.slice(0, 10).map((f: any) => (
                        <div key={f.feature} className="text-sm text-muted-foreground flex items-center justify-between">
                          <span>{f.feature}</span>
                          <span className="text-foreground font-medium">{f.aucDrop}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="glass-card p-4">
                  <div className="font-semibold text-sm mb-2">How to make this a stronger ML project</div>
                  <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                    <li>Add k-fold cross validation + report mean/variance</li>
                    <li>Add calibration (reliability plot) so probability is trustworthy</li>
                    <li>Add per-student “what-if” simulation (internship/projects/workshops) to show impact</li>
                    <li>Log model versioning (trainedAt + dataset hash) for reproducibility</li>
                  </ul>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {!loading && students.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No students registered yet.
          </div>
        )}
      </main>
    </div>
  );
}
