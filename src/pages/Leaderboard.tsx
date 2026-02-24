import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function firstLetter(name: string | undefined) {
  const s = String(name ?? "").trim();
  return s ? s.charAt(0).toUpperCase() : "U";
}

type Row = {
  rank: number;
  userId: string;
  isMe: boolean;
  name: string;
  avatarUrl: string;
  careerPath: string;
  healthPoints: number;
  currentStreak: number;
  averageScore: number;
  roadmapProgressPercent: number;
};

export default function Leaderboard() {
  const { user } = useAuth();
  const [careerPaths, setCareerPaths] = useState<string[]>([]);
  const [careerPath, setCareerPath] = useState<string>(user?.profile?.career?.careerPath || "");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.metaCareerPaths();
        setCareerPaths(res.careerPaths ?? []);
      } catch {
        setCareerPaths([]);
      }
    })();
  }, []);

  const load = async (cp?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.leaderboard(cp || undefined);
      setRows((res.rows ?? []) as Row[]);
    } catch (e: any) {
      setRows([]);
      setError(e?.error ?? "Failed to load leaderboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(careerPath);
  }, [careerPath]);

  const title = useMemo(() => {
    if (!careerPath) return "Global Leaderboard";
    return `Global Leaderboard · ${careerPath}`;
  }, [careerPath]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-20 pb-16 container mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground">Top 50 · Compete globally with consistency and progress.</p>
          </div>

          <div className="w-full md:w-80">
            <Select value={careerPath || "__all__"} onValueChange={(v) => setCareerPath(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filter by career track" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All career tracks</SelectItem>
                {(careerPaths || []).map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Rankings</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : error ? (
              <div className="text-sm text-destructive">{error}</div>
            ) : rows.length === 0 ? (
              <div className="text-sm text-muted-foreground">No users found for this track yet.</div>
            ) : (
              <div className="divide-y divide-border/60">
                {rows.map((r) => (
                  <div
                    key={r.userId}
                    className={`flex items-center gap-3 py-3 px-2 rounded-lg transition-colors ${
                      r.isMe ? "bg-primary/10" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="w-10 text-sm font-semibold tabular-nums">#{r.rank}</div>
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={String(r.avatarUrl || "")} alt={r.name} />
                      <AvatarFallback>{firstLetter(r.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{r.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{r.careerPath || "Career track not set"}</div>
                    </div>
                    <div className="hidden md:flex items-center gap-6 text-sm tabular-nums">
                      <div className="text-muted-foreground">🔥 {r.healthPoints}</div>
                      <div className="text-muted-foreground">Streak {r.currentStreak}</div>
                      <div className="text-muted-foreground">Avg {r.averageScore}%</div>
                      <div className="text-muted-foreground">Roadmap {r.roadmapProgressPercent}%</div>
                    </div>
                    <div className="md:hidden text-sm tabular-nums text-muted-foreground">🔥 {r.healthPoints}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
