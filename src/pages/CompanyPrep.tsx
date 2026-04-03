import { useState, useEffect } from "react";
import { ArrowLeft, Building2, ChevronRight, Search, Loader2, BookOpen, Target, BarChart3, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

type Company = { id: string; name: string; emoji: string; logo: string; totalQuestions: number; easy: number; medium: number; hard: number };
type PrepData = {
  companyId: string; companyName: string; totalQuestions: number;
  difficulty: { easy: number; medium: number; hard: number };
  topTopics: Array<{ topic: string; count: number }>;
  top10Questions: Array<{ id: string; title: string; difficulty: string; frequency: number; link: string }>;
  roadmap: { weeks: Array<{ week: number; title: string; focus: string; tasks: string[] }>; tips: string[] };
};

export default function CompanyPrep() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [prepData, setPrepData] = useState<PrepData | null>(null);
  const [prepLoading, setPrepLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.interviewCompanies();
        setCompanies(r?.companies ?? []);
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const openPrepSheet = async (company: Company) => {
    setSelectedCompany(company);
    setPrepLoading(true);
    setPrepData(null);
    try {
      const r = await api.companyPrep({ companyId: company.id, companyName: company.name });
      setPrepData(r);
    } catch {}
    finally { setPrepLoading(false); }
  };

  const closePrepSheet = () => {
    setSelectedCompany(null);
    setPrepData(null);
  };

  const diffColor = (d: string) => {
    if (d === "Easy") return "text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400";
    if (d === "Medium") return "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400";
    return "text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400";
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20 pb-16 container mx-auto px-4 max-w-6xl">
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        {/* ─── Company Prep Sheet Detail View ─── */}
        {selectedCompany && (
          <div>
            <button onClick={closePrepSheet} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
              <ArrowLeft className="w-4 h-4" /> All Companies
            </button>

            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center text-3xl">
                {selectedCompany.emoji}
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">{selectedCompany.name}</h1>
                <p className="text-sm text-muted-foreground">{selectedCompany.totalQuestions} LeetCode questions · Preparation Sheet</p>
              </div>
            </div>

            {prepLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Generating {selectedCompany.name} prep sheet with AI…</p>
              </div>
            ) : prepData ? (
              <div className="space-y-6">
                {/* Difficulty Distribution */}
                <Card className="p-5">
                  <h3 className="font-semibold flex items-center gap-2 mb-3"><BarChart3 className="w-4 h-4" /> Difficulty Distribution</h3>
                  <div className="flex gap-4 mb-3">
                    {[{ label: "Easy", val: prepData.difficulty.easy, color: "bg-green-500" },
                      { label: "Medium", val: prepData.difficulty.medium, color: "bg-yellow-500" },
                      { label: "Hard", val: prepData.difficulty.hard, color: "bg-red-500" }]
                      .map(d => (
                        <div key={d.label} className="text-center">
                          <div className="text-2xl font-bold">{d.val}</div>
                          <div className="text-xs text-muted-foreground">{d.label}</div>
                        </div>
                      ))}
                  </div>
                  <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                    <div className="bg-green-500 transition-all" style={{ width: `${(prepData.difficulty.easy / prepData.totalQuestions) * 100}%` }} />
                    <div className="bg-yellow-500 transition-all" style={{ width: `${(prepData.difficulty.medium / prepData.totalQuestions) * 100}%` }} />
                    <div className="bg-red-500 transition-all" style={{ width: `${(prepData.difficulty.hard / prepData.totalQuestions) * 100}%` }} />
                  </div>
                </Card>

                {/* Top Topics */}
                {prepData.topTopics.length > 0 && (
                  <Card className="p-5">
                    <h3 className="font-semibold flex items-center gap-2 mb-3"><Target className="w-4 h-4" /> Most Asked Topics</h3>
                    <div className="flex flex-wrap gap-2">
                      {prepData.topTopics.map(t => (
                        <span key={t.topic} className="px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400 text-sm font-medium">
                          {t.topic} <span className="text-xs opacity-60">({t.count})</span>
                        </span>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Top 10 Frequently Asked */}
                <Card className="p-5">
                  <h3 className="font-semibold flex items-center gap-2 mb-3"><BookOpen className="w-4 h-4" /> Top 10 Most Asked Questions</h3>
                  <div className="space-y-2">
                    {prepData.top10Questions.map((q, i) => (
                      <div key={q.id || i} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-mono text-muted-foreground w-5 text-right">{i + 1}</span>
                          <span className="text-sm truncate">{q.title}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${diffColor(q.difficulty)}`}>{q.difficulty}</span>
                          {q.link && <a href={q.link} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary"><ExternalLink className="w-3.5 h-3.5" /></a>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* AI Preparation Roadmap */}
                {prepData.roadmap.weeks.length > 0 && (
                  <Card className="p-5">
                    <h3 className="font-semibold flex items-center gap-2 mb-4">📋 4-Week Preparation Roadmap</h3>
                    <div className="space-y-4">
                      {prepData.roadmap.weeks.map(w => (
                        <div key={w.week} className="rounded-xl bg-muted/30 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">{w.week}</div>
                            <div>
                              <div className="font-semibold text-sm">{w.title}</div>
                              <div className="text-xs text-muted-foreground">{w.focus}</div>
                            </div>
                          </div>
                          <ul className="space-y-1 ml-10">
                            {(w.tasks || []).map((t: string, ti: number) => (
                              <li key={ti} className="text-sm text-muted-foreground flex gap-2"><span className="text-primary">•</span>{t}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Tips */}
                {prepData.roadmap.tips?.length > 0 && (
                  <Card className="p-5">
                    <h3 className="font-semibold mb-3">💡 Pro Tips</h3>
                    <ul className="space-y-2">
                      {prepData.roadmap.tips.map((tip, i) => (
                        <li key={i} className="text-sm flex gap-2 items-start"><span className="text-yellow-500 mt-0.5">★</span>{tip}</li>
                      ))}
                    </ul>
                  </Card>
                )}

                {/* Action buttons */}
                <div className="flex gap-3">
                  <Link to="/interview">
                    <Button className="gradient-primary text-primary-foreground border-0">Start {selectedCompany.name} Interview →</Button>
                  </Link>
                  <Button variant="outline" onClick={closePrepSheet}>← Back to Companies</Button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* ─── Company Grid View ─── */}
        {!selectedCompany && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><Building2 className="w-7 h-7" /> Company Preparation</h1>
                <p className="text-sm text-muted-foreground mt-1">Select a company to get a full preparation sheet with topics, top questions, and an AI roadmap.</p>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search companies…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-56 h-9" />
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {filtered.map(c => (
                  <Card
                    key={c.id}
                    className="p-4 cursor-pointer hover:border-primary/50 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group"
                    onClick={() => openPrepSheet(c)}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-110 transition-transform">
                        {c.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.totalQuestions} questions</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Difficulty bar */}
                    <div className="flex h-2 rounded-full overflow-hidden bg-muted mb-2">
                      {c.totalQuestions > 0 && (<>
                        <div className="bg-green-500" style={{ width: `${(c.easy / c.totalQuestions) * 100}%` }} />
                        <div className="bg-yellow-500" style={{ width: `${(c.medium / c.totalQuestions) * 100}%` }} />
                        <div className="bg-red-500" style={{ width: `${(c.hard / c.totalQuestions) * 100}%` }} />
                      </>)}
                    </div>
                    <div className="flex gap-2 text-[10px] text-muted-foreground">
                      <span>{c.easy} Easy</span>
                      <span>·</span>
                      <span>{c.medium} Med</span>
                      <span>·</span>
                      <span>{c.hard} Hard</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
