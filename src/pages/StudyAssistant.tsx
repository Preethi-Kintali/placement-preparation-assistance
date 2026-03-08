import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

type Turn = { role: "user" | "assistant"; content: string };
type StudyContext = {
  facts: any;
  docs: Array<{ id: string; title: string }>;
};
type StudySession = {
  _id: string;
  provider: "groq" | "gemini";
  prompt: string;
  answer: string;
  citations: Array<{ id: string; title: string }>;
  createdAt: string;
};
type PipelineStep = {
  step: string;
  status: string;
  detail: string;
};
type RagSource = {
  chunkIndex: number;
  text: string;
  score: number;
  source: string;
};
type RagStatus = {
  indexed: boolean;
  totalChunks: number;
  sources: string[];
  lastUpdated: string | null;
};

// ─── Pipeline step icons ──────────────────────────────────────
const STEP_ICONS: Record<string, string> = {
  "Knowledge Base": "📚",
  "Document Processing": "📄",
  "Chunking": "✂️",
  "Query Embedding": "🧠",
  "Similarity Search": "🔍",
  "Context + Prompt": "📝",
  "LLM": "🤖",
  "Final Answer": "✅",
};

export default function StudyAssistant() {
  const [provider, setProvider] = useState<"groq" | "gemini">("groq");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<StudyContext | null>(null);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [contextLoading, setContextLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [ragStatus, setRagStatus] = useState<RagStatus | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStep[]>([]);
  const [ragSources, setRagSources] = useState<RagSource[]>([]);
  const [showPipeline, setShowPipeline] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "assistant",
      content:
        "👋 Hi! I'm your RAG-powered Study Assistant. Ask me anything about placement preparation — I'll search the knowledge base and give you cited answers!",
    },
  ]);

  const history = useMemo(() => turns.slice(1), [turns]);

  useEffect(() => {
    const loadContext = async () => {
      setContextLoading(true);
      try {
        const resp = await api.studyContext();
        setContext(resp);
      } catch (e: any) {
        toast({
          title: "Context load failed",
          description: e?.details || e?.error || e?.message || "Request failed",
          variant: "destructive",
        });
      } finally {
        setContextLoading(false);
      }
    };

    const loadSessions = async () => {
      setHistoryLoading(true);
      try {
        const resp = await api.studySessions(10);
        setSessions(resp?.sessions || []);
      } catch (e: any) {
        toast({
          title: "History load failed",
          description: e?.details || e?.error || e?.message || "Request failed",
          variant: "destructive",
        });
      } finally {
        setHistoryLoading(false);
      }
    };

    const loadRagStatus = async () => {
      try {
        const status = await api.ragStatus();
        setRagStatus(status);
      } catch {
        // ignore
      }
    };

    loadContext();
    loadSessions();
    loadRagStatus();
  }, []);

  async function refreshSessions() {
    try {
      const resp = await api.studySessions(10);
      setSessions(resp?.sessions || []);
    } catch {
      // No-op
    }
  }

  async function sendMessage(message: string) {
    if (!message || loading) return;

    const nextTurns: Turn[] = [...turns, { role: "user", content: message }];
    setTurns(nextTurns);
    setLoading(true);
    setPipeline([]);
    setRagSources([]);
    setShowPipeline(true);

    // Show "processing" pipeline animation
    const processingSteps: PipelineStep[] = [
      { step: "Knowledge Base", status: "done", detail: "PDF loaded" },
      { step: "Document Processing", status: "processing", detail: "Extracting..." },
      { step: "Chunking", status: "waiting", detail: "" },
      { step: "Query Embedding", status: "waiting", detail: "" },
      { step: "Similarity Search", status: "waiting", detail: "" },
      { step: "Context + Prompt", status: "waiting", detail: "" },
      { step: "LLM", status: "waiting", detail: "" },
      { step: "Final Answer", status: "waiting", detail: "" },
    ];
    setPipeline(processingSteps);

    try {
      const resp = await api.studyChat({ provider, message, history });
      setTurns((t) => [...t, { role: "assistant", content: resp.answer || "(no response)" }]);
      if (resp.pipeline) setPipeline(resp.pipeline);
      if (resp.ragSources) setRagSources(resp.ragSources);
      refreshSessions();
    } catch (e: any) {
      toast({
        title: "Study Assistant failed",
        description: e?.details || e?.error || e?.message || "Request failed",
        variant: "destructive",
      });
      setPipeline([]);
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    const message = input.trim();
    if (!message) return;
    setInput("");
    sendMessage(message);
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 pt-20 pb-8 space-y-4">
        {/* ─── Header ─── */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                🤖 RAG Study Assistant
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Retrieval-Augmented Generation pipeline • Knowledge Base → Embeddings → LLM
              </p>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              {/* RAG Status Badge */}
              {ragStatus && (
                <div
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${ragStatus.indexed
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                >
                  {ragStatus.indexed
                    ? `✅ ${ragStatus.totalChunks} chunks indexed`
                    : "⚠️ Not indexed — run npm run ingest"}
                </div>
              )}

              <div className="w-32">
                <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="groq">Groq</SelectItem>
                    <SelectItem value="gemini">Gemini</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Main Layout: Chat + Pipeline Side Panel ─── */}
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* Chat Area */}
          <Card className="p-4">
            <div className="flex flex-wrap gap-2 mb-3">
              {["What skills are needed for placement?", "How to prepare for interviews?", "Tell me about aptitude preparation"].map((q) => (
                <Button
                  key={q}
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => sendMessage(q)}
                  disabled={loading}
                  className="text-xs"
                >
                  {q}
                </Button>
              ))}
            </div>

            <ScrollArea className="h-[55vh] pr-3">
              <div className="space-y-3">
                {turns.map((t, idx) => (
                  <div key={idx} className={t.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={
                        t.role === "user"
                          ? "max-w-[85%] rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm"
                          : "max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm"
                      }
                      style={{ whiteSpace: "pre-wrap" }}
                    >
                      {t.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground animate-pulse">
                      🔄 Running RAG pipeline...
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="mt-4 flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={loading ? "🔄 Processing through RAG pipeline…" : "Ask about placement preparation..."}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send();
                }}
                disabled={loading}
              />
              <Button onClick={send} disabled={loading || !input.trim()}>
                Send
              </Button>
            </div>
          </Card>

          {/* Pipeline Side Panel */}
          <div className="space-y-4">
            {/* Pipeline Visualization */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">RAG Pipeline</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => setShowPipeline(!showPipeline)}
                >
                  {showPipeline ? "Hide" : "Show"}
                </Button>
              </div>

              {showPipeline && pipeline.length > 0 && (
                <div className="space-y-1">
                  {pipeline.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-5 text-center">
                        {p.status === "done"
                          ? STEP_ICONS[p.step] || "✅"
                          : p.status === "processing"
                            ? "⏳"
                            : "⬜"}
                      </span>
                      <div className="flex-1">
                        <span className={`font-medium ${p.status === "done" ? "" : "text-muted-foreground"}`}>
                          {p.step}
                        </span>
                        {p.detail && (
                          <span className="text-muted-foreground ml-1">— {p.detail}</span>
                        )}
                      </div>
                      {i < pipeline.length - 1 && (
                        <span className="text-muted-foreground text-[10px]">↓</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!showPipeline && (
                <p className="text-xs text-muted-foreground">Send a message to see the RAG pipeline in action</p>
              )}
            </Card>

            {/* RAG Sources / Citations */}
            {ragSources.length > 0 && (
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">📎 Retrieved Sources</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs"
                    onClick={() => setShowSources(!showSources)}
                  >
                    {showSources ? "Hide" : "Show"} ({ragSources.length})
                  </Button>
                </div>

                {showSources && (
                  <ScrollArea className="h-[200px] pr-2">
                    <div className="space-y-2">
                      {ragSources.map((s, i) => (
                        <div key={i} className="rounded-md border border-border p-2 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-primary">[Source {i + 1}]</span>
                            <span className="text-muted-foreground">
                              Score: {s.score.toFixed(3)} • Chunk #{s.chunkIndex}
                            </span>
                          </div>
                          <p className="text-muted-foreground leading-relaxed">{s.text}</p>
                          <div className="text-[10px] text-muted-foreground mt-1">
                            📄 {s.source}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </Card>
            )}

            {/* Context Preview */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-2">Student Context</h3>
              {contextLoading ? (
                <p className="text-xs text-muted-foreground">Loading context...</p>
              ) : context ? (
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="font-semibold">Career:</span> {context.facts?.careerPath || "-"}
                  </div>
                  <div>
                    <span className="font-semibold">Week:</span> {context.facts?.unlockedWeek || "-"}
                  </div>
                  <div>
                    <span className="font-semibold">Topics:</span> {Array.isArray(context.facts?.weekTopics) ? context.facts.weekTopics.length : 0}
                  </div>
                  <div>
                    <span className="font-semibold">Latest scores:</span>{" "}
                    {context.facts?.latestScores
                      ? `Apt ${context.facts.latestScores.aptitude ?? "-"} | DSA ${context.facts.latestScores.dsa ?? "-"} | Soft ${context.facts.latestScores.softSkills ?? "-"} | Career ${context.facts.latestScores.career ?? "-"}`
                      : "-"}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No context available.</p>
              )}
            </Card>

            {/* Recent Sessions */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-2">Recent Sessions</h3>
              {historyLoading ? (
                <p className="text-xs text-muted-foreground">Loading history...</p>
              ) : sessions.length ? (
                <ScrollArea className="h-[150px] pr-2">
                  <div className="space-y-2">
                    {sessions.map((s) => (
                      <div key={s._id} className="rounded-md border border-border p-2 text-xs">
                        <div className="font-semibold">{s.prompt}</div>
                        <div className="text-muted-foreground mt-1 line-clamp-2" style={{ whiteSpace: "pre-wrap" }}>
                          {s.answer}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {new Date(s.createdAt).toLocaleString()} · {s.provider.toUpperCase()}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-xs text-muted-foreground">No sessions saved yet.</p>
              )}
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
