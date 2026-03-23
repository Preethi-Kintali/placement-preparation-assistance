import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  Users,
  FileText,
  BarChart3,
  RefreshCw,
  ChevronLeft,
  Briefcase,
  GraduationCap,
  Award,
  MessageSquare,
  BookOpen,
  Trophy,
  Calendar,
} from "lucide-react";

/* ─── Types ───────────────────────────────────────────────────── */
interface Student {
  id: string;
  studentId: string;
  profile: {
    fullName: string;
    email: string;
    phone: string;
    bio?: string;
    education?: {
      tenthPercent?: number;
      twelfthPercent?: number;
      btechCgpa?: number;
      collegeName?: string;
      branch?: string;
      year?: string;
    };
    experience?: {
      projectCount?: number;
      internshipsCount?: number;
      workshopsCertificationsCount?: number;
      technologies?: string[];
      hasInternship?: boolean;
      hasPatents?: boolean;
    };
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

/* ─── Role icon + color mapping ───────────────────────────────── */
const ROLE_COLORS: Record<string, string> = {
  "Full Stack Developer": "from-violet-500 to-purple-600",
  "Data Scientist": "from-cyan-500 to-blue-600",
  "Machine Learning": "from-emerald-500 to-teal-600",
  "Mobile App Development": "from-orange-500 to-red-500",
  "Cybersecurity": "from-red-500 to-rose-600",
  "Cloud Computing DevOps": "from-sky-500 to-indigo-600",
  "Blockchain Development": "from-amber-500 to-yellow-600",
  "AI / Artificial Intelligence": "from-pink-500 to-fuchsia-600",
  "IoT Development": "from-lime-500 to-green-600",
  "Generative AI": "from-indigo-500 to-violet-600",
  "AR / VR Development": "from-teal-500 to-cyan-600",
};

function getRoleGradient(role: string): string {
  for (const key of Object.keys(ROLE_COLORS)) {
    if (role.toLowerCase().includes(key.toLowerCase().split("/")[0].trim()))
      return ROLE_COLORS[key];
  }
  // Deterministic color from role name hash
  const hash = [...role].reduce((a, c) => a + c.charCodeAt(0), 0);
  const gradients = Object.values(ROLE_COLORS);
  return gradients[hash % gradients.length];
}

/* ─── Component ───────────────────────────────────────────────── */
export default function AdminDashboard() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // Drill-down state
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentDetails, setStudentDetails] = useState<any>(null);
  const [studentRoadmap, setStudentRoadmap] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // ML report
  const [mlReport, setMlReport] = useState<any>(null);
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

  /* Group students by career role */
  const roleGroups: Record<string, Student[]> = {};
  for (const s of students) {
    const role = s.profile.career?.careerPath || "Not Specified";
    if (!roleGroups[role]) roleGroups[role] = [];
    roleGroups[role].push(s);
  }
  const sortedRoles = Object.keys(roleGroups).sort((a, b) =>
    roleGroups[b].length - roleGroups[a].length
  );

  /* Load student details */
  const openStudent = async (student: Student) => {
    setSelectedStudent(student);
    setDetailsLoading(true);
    try {
      const [results, roadmap] = await Promise.all([
        api.adminStudentResults(student.id),
        api.adminStudentRoadmap(student.id),
      ]);
      setStudentDetails(results);
      setStudentRoadmap(roadmap);
    } finally {
      setDetailsLoading(false);
    }
  };

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

  /* ─── Breadcrumb navigation ──────────────────────────────────── */
  const breadcrumb = () => (
    <div className="flex items-center gap-2 text-sm mb-6">
      <button
        onClick={() => { setSelectedRole(null); setSelectedStudent(null); setStudentDetails(null); }}
        className={`font-medium transition-colors ${!selectedRole ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
      >
        All Roles
      </button>
      {selectedRole && (
        <>
          <ChevronLeft className="w-3 h-3 text-muted-foreground rotate-180" />
          <button
            onClick={() => { setSelectedStudent(null); setStudentDetails(null); }}
            className={`font-medium transition-colors ${!selectedStudent ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            {selectedRole}
          </button>
        </>
      )}
      {selectedStudent && (
        <>
          <ChevronLeft className="w-3 h-3 text-muted-foreground rotate-180" />
          <span className="font-medium text-primary">
            {selectedStudent.profile.fullName}
          </span>
        </>
      )}
    </div>
  );

  /* ─── Level 1: Role Cards ────────────────────────────────────── */
  const renderRoles = () => (
    <div>
      {/* Stats strip */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.students}</div>
                <div className="text-xs text-muted-foreground">Total Students</div>
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
                <Briefcase className="w-5 h-5 text-success" />
              </div>
              <div>
                <div className="text-2xl font-bold">{sortedRoles.length}</div>
                <div className="text-xs text-muted-foreground">Career Roles</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ML Report button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Career Roles ({sortedRoles.length})</h2>
        <Button variant="outline" size="sm" onClick={() => { loadMlReport(); }} className="gap-2">
          <BarChart3 className="w-4 h-4" /> ML Report
        </Button>
      </div>

      {/* ML Report inline */}
      {mlReport && (
        <div className="glass-card p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-sm">Placement Model Report</div>
            <button onClick={() => setMlReport(null)} className="text-xs text-muted-foreground hover:text-foreground">✕ Close</button>
          </div>
          <div className="text-sm text-muted-foreground">
            Algorithm: <span className="text-foreground font-medium">{mlReport.algorithm}</span>
            {mlReport.sampleCount ? <span> · N={mlReport.sampleCount}</span> : null}
            {typeof mlReport.holdoutAccuracyPct === "number" ? <span> · Accuracy: <span className="text-foreground font-medium">{mlReport.holdoutAccuracyPct}%</span></span> : null}
            {typeof mlReport.holdoutAuc === "number" ? <span> · AUC: <span className="text-foreground font-medium">{mlReport.holdoutAuc}</span></span> : null}
          </div>
          {mlReport.confusionMatrix && (
            <div className="grid grid-cols-4 gap-2 text-xs mt-3">
              <div className="bg-muted/30 rounded p-2 text-center">TP: <strong>{mlReport.confusionMatrix.tp}</strong></div>
              <div className="bg-muted/30 rounded p-2 text-center">FP: <strong>{mlReport.confusionMatrix.fp}</strong></div>
              <div className="bg-muted/30 rounded p-2 text-center">TN: <strong>{mlReport.confusionMatrix.tn}</strong></div>
              <div className="bg-muted/30 rounded p-2 text-center">FN: <strong>{mlReport.confusionMatrix.fn}</strong></div>
            </div>
          )}
        </div>
      )}
      {mlLoading && <div className="text-sm text-muted-foreground mb-4">Loading ML report...</div>}

      {/* Role cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedRoles.map((role) => {
          const count = roleGroups[role].length;
          const gradient = getRoleGradient(role);
          return (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className="glass-card p-5 text-left hover:scale-[1.02] transition-all duration-200 group cursor-pointer"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3 shadow-lg`}>
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div className="font-semibold text-base group-hover:text-primary transition-colors">{role}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {count} student{count !== 1 ? "s" : ""}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  /* ─── Level 2: Students in a Role ────────────────────────────── */
  const renderStudents = () => {
    const roleStudents = roleGroups[selectedRole!] || [];
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => setSelectedRole(null)} className="gap-1 mb-4 -ml-2">
          <ChevronLeft className="w-4 h-4" /> Back to Roles
        </Button>

        <div className="flex items-center gap-3 mb-6">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getRoleGradient(selectedRole!)} flex items-center justify-center shadow-lg`}>
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{selectedRole}</h2>
            <div className="text-sm text-muted-foreground">{roleStudents.length} student{roleStudents.length !== 1 ? "s" : ""}</div>
          </div>
        </div>

        <div className="grid gap-3">
          {roleStudents.map((s) => (
            <button
              key={s.id}
              onClick={() => openStudent(s)}
              className="glass-card p-4 text-left hover:border-primary/30 transition-all duration-200 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {s.profile.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold">{s.profile.fullName}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.profile.email} · {s.studentId}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Joined {new Date(s.createdAt).toLocaleDateString()}
                </div>
              </div>

              {/* Quick info row */}
              <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                {s.profile.education?.btechCgpa && (
                  <span>CGPA: <strong className="text-foreground">{s.profile.education.btechCgpa}</strong></span>
                )}
                {s.profile.education?.branch && (
                  <span>Branch: <strong className="text-foreground">{s.profile.education.branch}</strong></span>
                )}
                {s.profile.experience?.technologies && s.profile.experience.technologies.length > 0 && (
                  <span>Skills: <strong className="text-foreground">{s.profile.experience.technologies.slice(0, 3).join(", ")}{s.profile.experience.technologies.length > 3 ? "..." : ""}</strong></span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  /* ─── Level 3: Student Full Details ──────────────────────────── */
  const renderStudentDetails = () => {
    const s = selectedStudent!;
    const d = studentDetails;
    const r = studentRoadmap;

    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => { setSelectedStudent(null); setStudentDetails(null); }} className="gap-1 mb-4 -ml-2">
          <ChevronLeft className="w-4 h-4" /> Back to {selectedRole}
        </Button>

        {detailsLoading && (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading student details...</div>
        )}

        {!detailsLoading && (
          <div className="space-y-6">
            {/* Profile header */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${getRoleGradient(selectedRole || "")} flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
                  {s.profile.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{s.profile.fullName}</h2>
                  <div className="text-sm text-muted-foreground">{s.profile.email} · {s.profile.phone}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    ID: {s.studentId} · Joined: {new Date(s.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {s.profile.bio && (
                <div className="text-sm text-muted-foreground mb-3">{s.profile.bio}</div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {s.profile.education?.tenthPercent != null && (
                  <div className="bg-muted/30 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground">10th %</div>
                    <div className="font-semibold">{s.profile.education.tenthPercent}%</div>
                  </div>
                )}
                {s.profile.education?.twelfthPercent != null && (
                  <div className="bg-muted/30 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground">12th %</div>
                    <div className="font-semibold">{s.profile.education.twelfthPercent}%</div>
                  </div>
                )}
                {s.profile.education?.btechCgpa != null && (
                  <div className="bg-muted/30 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground">B.Tech CGPA</div>
                    <div className="font-semibold">{s.profile.education.btechCgpa}</div>
                  </div>
                )}
                {s.profile.education?.collegeName && (
                  <div className="bg-muted/30 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground">College</div>
                    <div className="font-semibold text-xs">{s.profile.education.collegeName}</div>
                  </div>
                )}
              </div>

              {/* Skills / Technologies */}
              {s.profile.experience?.technologies && s.profile.experience.technologies.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-muted-foreground mb-1">Technologies</div>
                  <div className="flex flex-wrap gap-1.5">
                    {s.profile.experience.technologies.map((t) => (
                      <span key={t} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Experience stats */}
              <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                {s.profile.experience?.projectCount != null && <span>Projects: <strong className="text-foreground">{s.profile.experience.projectCount}</strong></span>}
                {s.profile.experience?.internshipsCount != null && <span>Internships: <strong className="text-foreground">{s.profile.experience.internshipsCount}</strong></span>}
                {s.profile.experience?.workshopsCertificationsCount != null && <span>Workshops/Certs: <strong className="text-foreground">{s.profile.experience.workshopsCertificationsCount}</strong></span>}
              </div>
            </div>

            {/* Exam Results */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Exam Results</h3>
              </div>
              {(!d?.exams || d.exams.length === 0) ? (
                <div className="text-sm text-muted-foreground">No exam attempts yet.</div>
              ) : (
                <div className="grid gap-2">
                  {d.exams.map((e: any) => (
                    <div key={e.id} className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white ${e.percentage >= 80 ? "bg-emerald-500" : e.percentage >= 50 ? "bg-amber-500" : "bg-red-500"}`}>
                          {e.grade}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{String(e.examType).toUpperCase()}</div>
                          <div className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-sm">{Math.round(e.percentage)}%</div>
                        <div className="text-xs text-muted-foreground">{e.score}/{e.totalQuestions}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI Interview Sessions */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">AI Interview Sessions</h3>
              </div>
              {(!d?.interviewSessions || d.interviewSessions.length === 0) ? (
                <div className="text-sm text-muted-foreground">No AI interview attempts yet.</div>
              ) : (
                <div className="grid gap-2">
                  {d.interviewSessions.map((iv: any) => (
                    <div key={iv.id} className="bg-muted/30 rounded-lg p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Week {iv.currentWeek}</span>
                        <span className="text-xs text-muted-foreground">{new Date(iv.completedAt).toLocaleDateString()}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
                        <div className="text-center bg-background/50 rounded p-1.5">
                          <div className="text-muted-foreground">Overall</div>
                          <div className="font-bold text-foreground">{Number(iv.overallScore).toFixed(1)}/10</div>
                        </div>
                        <div className="text-center bg-background/50 rounded p-1.5">
                          <div className="text-muted-foreground">Comm</div>
                          <div className="font-bold text-foreground">{Number(iv.communicationScore).toFixed(1)}</div>
                        </div>
                        <div className="text-center bg-background/50 rounded p-1.5">
                          <div className="text-muted-foreground">DSA</div>
                          <div className="font-bold text-foreground">{Number(iv.dsaScore).toFixed(1)}</div>
                        </div>
                        <div className="text-center bg-background/50 rounded p-1.5">
                          <div className="text-muted-foreground">Tech</div>
                          <div className="font-bold text-foreground">{Number(iv.technicalScore).toFixed(1)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Roadmap Progress */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Roadmap Progress</h3>
              </div>
              {!r?.roadmap?.weeks?.length ? (
                <div className="text-sm text-muted-foreground">No roadmap generated yet.</div>
              ) : (
                <div>
                  <div className="flex gap-4 text-xs text-muted-foreground mb-3">
                    {r.progress?.unlockedWeek && <span>Unlocked Week: <strong className="text-foreground">{r.progress.unlockedWeek}</strong></span>}
                    {Array.isArray(r.progress?.completedDays) && <span>Completed Days: <strong className="text-foreground">{r.progress.completedDays.length}</strong></span>}
                  </div>
                  <div className="grid gap-2">
                    {r.roadmap.weeks.slice(0, 8).map((w: any) => (
                      <div key={w.week} className="bg-muted/30 rounded-lg p-3">
                        <div className="font-medium text-sm">Week {w.week}: {w.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {(w.days || []).map((d: any) => d.topic).join(" · ")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Weekly & Grand Tests */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Weekly Tests & Certificate</h3>
              </div>

              {/* Weekly tests */}
              {d?.weeklyTests?.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Weekly Tests</div>
                  <div className="grid gap-1.5">
                    {d.weeklyTests.map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between bg-muted/30 rounded p-2 text-sm">
                        <span>Week {t.week}</span>
                        <span className={`font-medium ${t.passed ? "text-emerald-500" : "text-red-400"}`}>
                          {t.passed ? "✓ Passed" : "✗ Not passed"} · {typeof t.percentage === "number" ? Math.round(t.percentage) + "%" : "-"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Grand test */}
              {d?.grandTests?.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Grand Test</div>
                  {d.grandTests.slice(0, 1).map((g: any) => (
                    <div key={g.id} className="bg-muted/30 rounded p-3 text-sm">
                      {g.passed ? "✓ Passed" : "✗ Not passed"} · Score: {g.score}/{g.totalQuestions} ({typeof g.percentage === "number" ? Math.round(g.percentage) + "%" : "-"})
                    </div>
                  ))}
                </div>
              )}

              {/* Certificate */}
              {d?.certificate ? (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-primary" />
                    <span className="font-medium text-primary">Certificate Issued</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    ID: {d.certificate.certificateId} · {d.certificate.careerPath} · {Math.round(d.certificate.percentage)}%
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Certificate not issued yet.</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ─── Main Render ────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 container mx-auto px-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Welcome, {user?.profile?.fullName}</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {breadcrumb()}

        {loading && <div className="text-sm text-muted-foreground py-8 text-center">Loading data...</div>}

        {!loading && !selectedRole && renderRoles()}
        {!loading && selectedRole && !selectedStudent && renderStudents()}
        {!loading && selectedRole && selectedStudent && renderStudentDetails()}
      </main>
    </div>
  );
}
