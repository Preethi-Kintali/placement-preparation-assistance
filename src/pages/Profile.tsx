import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/context/ThemeContext";
import { Moon, Sun, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function firstLetter(name: string | undefined) {
  const s = String(name ?? "").trim();
  return s ? s.charAt(0).toUpperCase() : "U";
}

type ActivitySummary = {
  heatmap?: { days?: Array<{ dateKey: string; count: number }> };
  timeline?: {
    events?: Array<{
      id: string;
      type: string;
      title: string;
      dateKey: string;
      createdAt: string;
      meta?: any;
    }>;
  };
  badges?: {
    all?: Array<{ id: string; title: string; description: string }>;
    unlocked?: Array<{ id: string; unlockedAt: string }>;
  };
  gamification?: { healthPoints?: number; currentStreak?: number; longestStreak?: number };
  stats?: { totalExamsCompleted?: number; averageScore?: number; roadmapProgressPercent?: number };
};

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function dateKeyUtc(d: Date) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function parseDateKeyUtc(key: string): Date {
  const [y, m, d] = String(key).split("-").map((x) => Number(x));
  return new Date(Date.UTC(y || 1970, (m || 1) - 1, d || 1));
}

function intensityClass(intensity: number) {
  if (intensity <= 0) return "bg-muted/60";
  if (intensity <= 2) return "bg-primary/20";
  if (intensity <= 4) return "bg-primary/35";
  if (intensity <= 7) return "bg-primary/55";
  return "bg-primary/80";
}

type HeatmapDay = { dateKey: string; count: number; byType?: Record<string, number> };

function scoreDay(byType: Record<string, number> | undefined) {
  const t = byType ?? {};
  const w = {
    daily_learning: 1,
    new_tech_learned: 2,
    roadmap_day_complete: 1,
    weekly_test_completed: 3,
    grand_test_completed: 4,
    exam_completed: 3,
    interview_completed: 3,
  } as const;
  let total = 0;
  for (const [k, v] of Object.entries(t)) {
    const weight = (w as any)[k] ?? 1;
    total += Math.max(0, Number(v) || 0) * weight;
  }
  return total;
}

function breakdownText(byType: Record<string, number> | undefined) {
  if (!byType) return "";
  const items = Object.entries(byType)
    .map(([k, v]) => [k, Number(v) || 0] as const)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  if (!items.length) return "";
  const label = (k: string) =>
    k
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  return items.map(([k, v]) => `${label(k)}: ${v}`).join(" · ");
}

function ContributionHeatmap({ days }: { days: HeatmapDay[] }) {
  const map = useMemo(() => {
    const m = new Map<string, HeatmapDay>();
    for (const d of days) m.set(String(d.dateKey), d);
    return m;
  }, [days]);

  const grid = useMemo(() => {
    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - 364);
    // Align to Sunday so the columns look like GitHub/LeetCode.
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const weeks: Array<{
      monthLabel?: string;
      monthStart: boolean;
      cells: Array<{ key: string; intensity: number; totalSessions: number; byType?: Record<string, number> }>;
    }> = [];
    const cursor = new Date(start);
    let prevMonth = -1;
    for (let w = 0; w < 53; w++) {
      const weekCells: Array<{ key: string; intensity: number; totalSessions: number; byType?: Record<string, number> }> = [];
      for (let d = 0; d < 7; d++) {
        const key = dateKeyUtc(cursor);
        const row = map.get(key);
        const totalSessions = Number(row?.count ?? 0) || 0;
        const intensity = scoreDay(row?.byType);
        weekCells.push({ key, intensity, totalSessions, byType: row?.byType });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }

      const weekStart = parseDateKeyUtc(weekCells[0]?.key ?? "1970-01-01");
      const month = weekStart.getUTCMonth();
      const monthStart = month !== prevMonth;
      const monthLabel = monthStart ? months[month] : undefined;
      prevMonth = month;

      weeks.push({ monthLabel, monthStart, cells: weekCells });
    }
    return weeks;
  }, [map]);

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex gap-1">
        {grid.map((week, wi) => (
          <div
            key={wi}
            className={`flex flex-col gap-1 ${wi !== 0 && week.monthStart ? "ml-2 pl-2 border-l border-border/60" : ""}`}
          >
            <div className="h-4 text-[10px] text-muted-foreground select-none leading-4">
              {week.monthLabel ?? ""}
            </div>
            {week.cells.map((cell) => (
              <div
                key={cell.key}
                title={`${cell.key} — ${cell.totalSessions} sessions${cell.byType ? `\n${breakdownText(cell.byType)}` : ""}`}
                className={`h-3 w-3 rounded-[3px] border border-border/60 ${intensityClass(cell.intensity)}`}
                aria-label={`${cell.key}: ${cell.totalSessions} sessions`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [newTechOpen, setNewTechOpen] = useState(false);
  const [newTech, setNewTech] = useState("");
  const [newTechSubmitting, setNewTechSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = (await api.activitySummary()) as ActivitySummary;
        if (mounted) setSummary(res);
      } catch {
        if (mounted) setSummary(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = (await api.activitySummary()) as ActivitySummary;
      setSummary(res);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const examSeries = useMemo(() => {
    const events = summary?.timeline?.events ?? [];
    const types = new Set(["exam_completed", "weekly_test_completed", "grand_test_completed"]);
    const points = events
      .filter((e) => types.has(e.type))
      .map((e) => ({
        date: e.dateKey,
        percentage: Math.round(Number(e.meta?.percentage ?? 0) * 10) / 10,
        kind: e.type,
        label:
          e.type === "exam_completed"
            ? String(e.meta?.examType ?? "exam")
            : e.type === "weekly_test_completed"
            ? `weekly wk ${Number(e.meta?.week ?? 0) || ""}`.trim()
            : "grand test",
      }))
      .reverse();
    return points.slice(-30);
  }, [summary]);

  const interviewSeries = useMemo(() => {
    const events = summary?.timeline?.events ?? [];
    const points = events
      .filter((e) => e.type === "interview_completed")
      .map((e) => ({
        date: e.dateKey,
        score: Math.round(Number(e.meta?.overallScore ?? 0) * 10) / 10,
        week: Number(e.meta?.currentWeek ?? 0) || 0,
      }))
      .reverse();
    return points.slice(-30);
  }, [summary]);

  const roadmapBars = useMemo(() => {
    const pct = Math.max(0, Math.min(100, Number(summary?.stats?.roadmapProgressPercent ?? 0) || 0));
    return [{ name: "Roadmap", percent: pct }];
  }, [summary]);

  const roadmapSeries = useMemo(() => {
    const days = (summary as any)?.heatmap?.days ?? [];
    const last30 = days
      .slice()
      .sort((a: any, b: any) => String(a.dateKey).localeCompare(String(b.dateKey)))
      .slice(-30)
      .map((d: any) => ({
        date: String(d.dateKey),
        completed: Number(d.byType?.roadmap_day_complete ?? 0) || 0,
      }));
    return last30;
  }, [summary]);

  const newTechBars = useMemo(() => {
    const days = (summary as any)?.heatmap?.days ?? [];
    const last30 = days
      .slice()
      .sort((a: any, b: any) => String(a.dateKey).localeCompare(String(b.dateKey)))
      .slice(-30)
      .map((d: any) => ({
        date: String(d.dateKey),
        count: Number(d.byType?.new_tech_learned ?? 0) || 0,
      }));
    return last30;
  }, [summary]);

  const heatmapDays = ((summary as any)?.heatmap?.days ?? []) as HeatmapDay[];
  const hp = Number(summary?.gamification?.healthPoints ?? user?.gamification?.healthPoints ?? 0);
  const streak = Number(summary?.gamification?.currentStreak ?? user?.gamification?.currentStreak ?? 0);
  const longest = Number(summary?.gamification?.longestStreak ?? user?.gamification?.longestStreak ?? 0);
  const totalExams = Number(summary?.stats?.totalExamsCompleted ?? 0);
  const avgScore = Number(summary?.stats?.averageScore ?? 0);

  const allBadges = summary?.badges?.all ?? [];
  const unlocked = new Set((summary?.badges?.unlocked ?? []).map((b) => String((b as any).id)));

  const submitNewTech = async () => {
    const tech = newTech.trim();
    if (tech.length < 2) return;
    setNewTechSubmitting(true);
    try {
      await api.newTechLearnedSubmit(tech);
      setNewTech("");
      setNewTechOpen(false);
      await refresh();
    } finally {
      setNewTechSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-20 pb-16 container mx-auto px-4">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Profile</h1>
            <p className="text-sm text-muted-foreground">Your activity, streak, and progress overview.</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-4">
          {/* Left panel (LeetCode-style) */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={String(user?.profile?.avatarUrl || "")} alt="Profile" />
                    <AvatarFallback>{firstLetter(user?.profile?.fullName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{user?.profile?.fullName || "Student"}</div>
                    <div className="text-xs text-muted-foreground truncate">{user?.profile?.email}</div>
                    <div className="text-xs text-muted-foreground truncate">{user?.profile?.education?.collegeName || ""}</div>
                    <div className="text-xs text-muted-foreground truncate">{user?.profile?.career?.careerPath || ""}</div>
                  </div>
                </div>

                <Link to="/profile/edit" className="block">
                  <Button className="w-full gradient-primary text-primary-foreground border-0">Edit Details</Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Streak</CardTitle>
                <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-3 text-sm">
                <div className="p-3 rounded-xl bg-muted/40">
                  <div className="text-xs text-muted-foreground">Health</div>
                  <div className="font-semibold tabular-nums">🔥 {hp}</div>
                </div>
                <div className="p-3 rounded-xl bg-muted/40">
                  <div className="text-xs text-muted-foreground">Current</div>
                  <div className="font-semibold tabular-nums">{streak}</div>
                </div>
                <div className="p-3 rounded-xl bg-muted/40">
                  <div className="text-xs text-muted-foreground">Longest</div>
                  <div className="font-semibold tabular-nums">{longest}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Badges</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-sm text-muted-foreground">Loading...</div>
                ) : allBadges.length ? (
                  <div className="flex flex-wrap gap-2">
                    {allBadges.map((b) => {
                      const isUnlocked = unlocked.has(String((b as any).id));
                      return (
                        <Badge key={String((b as any).id)} variant={isUnlocked ? "default" : "secondary"} className="rounded-full">
                          {String((b as any).title)}
                        </Badge>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No badges yet.</div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Stats</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-xl bg-muted/40">
                  <div className="text-xs text-muted-foreground">Exams Completed</div>
                  <div className="font-semibold tabular-nums">{totalExams}</div>
                </div>
                <div className="p-3 rounded-xl bg-muted/40">
                  <div className="text-xs text-muted-foreground">Avg Score</div>
                  <div className="font-semibold tabular-nums">{avgScore}%</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right panel: graphs + heatmap */}
          <div className="lg:col-span-9 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Exams & Tests — Score Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  ) : examSeries.length ? (
                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={examSeries} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
                          <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={24} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                          <Tooltip
                            formatter={(value: any, _name: any, props: any) => {
                              const label = String(props?.payload?.label ?? "score").replace(/_/g, " ");
                              return [`${value}%`, label];
                            }}
                          />
                          <Line type="monotone" dataKey="percentage" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No exams/tests completed yet.</div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>AI Interview — Overall Score Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  ) : interviewSeries.length ? (
                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={interviewSeries} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
                          <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={24} />
                          <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} />
                          <Tooltip
                            formatter={(value: any, _name: any, props: any) => {
                              const week = Number(props?.payload?.week ?? 0);
                              return [`${value}/10`, week ? `Week ${week}` : "Interview"]; 
                            }}
                          />
                          <Line type="monotone" dataKey="score" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No interview sessions completed yet.</div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Roadmap Completion — Daily</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  ) : roadmapSeries.length ? (
                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={roadmapSeries} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={24} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                          <Tooltip formatter={(v: any) => [v, "Days completed"]} />
                          <Line type="monotone" dataKey="completed" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No roadmap activity yet.</div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>New Tech Learned</CardTitle>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setNewTechOpen(true)}>
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  ) : (
                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={newTechBars} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={24} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                          <Tooltip formatter={(v: any) => [v, "Tech entries"]} />
                          <Bar dataKey="count" fill="hsl(var(--accent))" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Activity Heatmap</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-sm text-muted-foreground">Loading...</div>
                ) : heatmapDays.length ? (
                  <ContributionHeatmap days={heatmapDays} />
                ) : (
                  <div className="text-sm text-muted-foreground">No activity yet. Start with your first assessment.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={newTechOpen} onOpenChange={setNewTechOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Tech Learned</DialogTitle>
              <DialogDescription>Enter one technology/tool/framework you learned today.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Input
                placeholder="e.g., Next.js App Router"
                value={newTech}
                onChange={(e) => setNewTech(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitNewTech();
                }}
              />
              <div className="text-xs text-muted-foreground">This will affect your activity heatmap and progress graphs.</div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewTechOpen(false)} disabled={newTechSubmitting}>Cancel</Button>
              <Button onClick={submitNewTech} disabled={newTechSubmitting || newTech.trim().length < 2} className="gradient-primary text-primary-foreground border-0">
                {newTechSubmitting ? "Submitting..." : "Submit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
