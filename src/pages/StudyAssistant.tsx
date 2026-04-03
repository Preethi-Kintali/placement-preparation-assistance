import { useEffect, useMemo, useRef, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

type Turn = {
  role: "user" | "assistant";
  content: string;
  confidence?: { score: number; level: string };
  grounded?: boolean;
  guardrails?: { blocked?: boolean; injectionDetected?: boolean; outputWarnings?: string[] };
  ragSources?: RagSource[];
  typing?: boolean;
};

type StudyContext = {
  facts: any;
  docs: Array<{ id: string; title: string }>;
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
  cacheSize?: number;
};

type SkillGap = {
  skill: string;
  status: string;
  category: string;
};

type DailyTask = {
  title: string;
  type: string;
  priority: string;
  estimatedMinutes: number;
  reason: string;
};

// ─── Pipeline step icons ──────────────────────────────────────
const STEP_ICONS: Record<string, string> = {
  "Guardrails": "🛡️",
  "Knowledge Base": "📚",
  "Multi-Query": "🔀",
  "Embedding": "🧠",
  "Similarity Search": "🔍",
  "Re-Ranking": "📊",
  "Context Compression": "✂️",
  "Chat Memory": "💬",
  "Grounding": "⚓",
  "LLM": "🤖",
  "Output Validation": "✅",
  "Final Answer": "📨",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  none: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "border-red-400 bg-red-50 dark:bg-red-900/10",
  medium: "border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10",
  low: "border-green-400 bg-green-50 dark:bg-green-900/10",
};

// ─── Typing animation hook ────────────────────────────────────
function useTypingAnimation(text: string, speed = 8) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!text) { setDisplayed(""); setDone(true); return; }
    setDisplayed("");
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      // Type in chunks of 3 chars for speed
      const chunk = text.slice(i, i + 3);
      setDisplayed((prev) => prev + chunk);
      i += 3;
      if (i >= text.length) {
        setDisplayed(text);
        setDone(true);
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return { displayed, done };
}

// ─── Message Bubble Component ─────────────────────────────────
function MessageBubble({ turn, isLatest }: { turn: Turn; isLatest: boolean }) {
  const isUser = turn.role === "user";
  const { displayed, done } = useTypingAnimation(
    isLatest && !isUser && turn.typing !== false ? turn.content : "",
    6
  );
  const showContent = isLatest && !isUser && turn.typing !== false ? displayed : turn.content;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} gap-2`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-white text-sm flex-shrink-0 mt-1 shadow-md">
          🤖
        </div>
      )}
      <div className="max-w-[80%] space-y-1">
        <div
          className={
            isUser
              ? "rounded-2xl rounded-tr-sm bg-gradient-to-r from-violet-600 to-blue-600 text-white px-4 py-2.5 text-sm shadow-md"
              : "rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-2.5 text-sm shadow-sm"
          }
          style={{ whiteSpace: "pre-wrap" }}
        >
          {showContent}
          {isLatest && !isUser && !done && (
            <span className="inline-block w-1.5 h-4 bg-violet-500 ml-0.5 animate-pulse rounded-sm" />
          )}
        </div>

        {/* Confidence + Grounding badges */}
        {!isUser && turn.confidence && (
          <div className="flex gap-1.5 flex-wrap px-1">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CONFIDENCE_COLORS[turn.confidence.level] || CONFIDENCE_COLORS.none}`}>
              {turn.confidence.level === "high" ? "🟢" : turn.confidence.level === "medium" ? "🟡" : turn.confidence.level === "low" ? "🟠" : "🔴"}{" "}
              Confidence: {Math.round(turn.confidence.score * 100)}%
            </span>
            {turn.grounded !== undefined && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${turn.grounded ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"}`}>
                {turn.grounded ? "⚓ Grounded" : "⚠ Ungrounded"}
              </span>
            )}
            {turn.guardrails?.outputWarnings && turn.guardrails.outputWarnings.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                ⚠ {turn.guardrails.outputWarnings.length} warning(s)
              </span>
            )}
          </div>
        )}

        {/* Blocked message */}
        {!isUser && turn.guardrails?.blocked && (
          <div className="flex gap-1.5 px-1">
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
              🛡️ Blocked by guardrails {turn.guardrails.injectionDetected ? "(injection detected)" : ""}
            </span>
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm flex-shrink-0 mt-1 shadow-md">
          👤
        </div>
      )}
    </div>
  );
}

export default function StudyAssistant() {
  const [provider, setProvider] = useState<"groq" | "gemini">("groq");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<StudyContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [ragStatus, setRagStatus] = useState<RagStatus | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStep[]>([]);
  const [ragSources, setRagSources] = useState<RagSource[]>([]);
  const [showPipeline, setShowPipeline] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<"pipeline" | "sources" | "context" | "personalization">("pipeline");
  const [personalization, setPersonalization] = useState<any>(null);
  const [persLoading, setPersLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "assistant",
      content:
        "👋 Hi! I'm your **AI Study Assistant v2** — powered by Advanced RAG with guardrails, multi-query retrieval, and personalization.\n\nAsk me anything about placement preparation! I'll search the knowledge base and give you cited, grounded answers.\n\n🛡️ **New:** Prompt injection protection\n🔀 **New:** Multi-query retrieval (3 variations)\n📊 **New:** Confidence scoring\n💬 **New:** Chat memory (I remember context)",
      typing: false,
    },
  ]);

  const history = useMemo(() => turns.filter((t) => t.typing !== false || t.role === "user").slice(1), [turns]);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  useEffect(() => {
    const loadContext = async () => {
      setContextLoading(true);
      try {
        const resp = await api.studyContext();
        setContext(resp);
      } catch {
        // silent
      } finally {
        setContextLoading(false);
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
    loadRagStatus();
  }, []);

  const loadPersonalization = async () => {
    setPersLoading(true);
    try {
      setPersonalization(await api.personalization());
    } catch {
      // silent
    } finally {
      setPersLoading(false);
    }
  };

  async function sendMessage(message: string) {
    if (!message || loading) return;

    const nextTurns: Turn[] = [...turns, { role: "user", content: message }];
    setTurns(nextTurns);
    setLoading(true);
    setPipeline([]);
    setRagSources([]);

    // Processing animation
    setPipeline([
      { step: "Guardrails", status: "processing", detail: "Checking safety..." },
      { step: "Knowledge Base", status: "waiting", detail: "" },
      { step: "Multi-Query", status: "waiting", detail: "" },
      { step: "Similarity Search", status: "waiting", detail: "" },
      { step: "LLM", status: "waiting", detail: "" },
      { step: "Final Answer", status: "waiting", detail: "" },
    ]);

    try {
      const resp = await api.studyChat({
        provider,
        message,
        history: history.map((t) => ({ role: t.role, content: t.content })),
        threadId,
        useMultiQuery: true,
      });

      if (resp.threadId && !threadId) setThreadId(resp.threadId);

      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          content: resp.answer || "(no response)",
          confidence: resp.confidence,
          grounded: resp.grounded,
          guardrails: resp.guardrails,
          ragSources: resp.ragSources,
        },
      ]);
      if (resp.pipeline) setPipeline(resp.pipeline);
      if (resp.ragSources) setRagSources(resp.ragSources);
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

  function newChat() {
    setThreadId(undefined);
    setTurns([turns[0]]);
    setPipeline([]);
    setRagSources([]);
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 pt-20 pb-8 space-y-4">
        {/* ─── Header ─── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              🤖 AI Study Assistant <span className="text-xs bg-gradient-to-r from-violet-600 to-blue-600 text-white px-2 py-0.5 rounded-full font-medium">v2</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Advanced RAG • Multi-Query • Guardrails • Chat Memory • Personalization
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* RAG Status Badge */}
            {ragStatus && (
              <div className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${ragStatus.indexed
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                }`}>
                {ragStatus.indexed
                  ? `✅ ${ragStatus.totalChunks} chunks • ${ragStatus.cacheSize ?? 0} cached`
                  : "⚠️ Not indexed"}
              </div>
            )}

            <Button size="sm" variant="outline" onClick={newChat} className="text-xs">
              ➕ New Chat
            </Button>

            <div className="w-28">
              <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
                <SelectTrigger className="h-8 text-xs">
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

        {/* ─── Main Layout ─── */}
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          {/* Chat Area */}
          <Card className="flex flex-col" style={{ height: "calc(100vh - 170px)" }}>
            {/* Quick Prompts */}
            <div className="flex flex-wrap gap-1.5 p-3 border-b border-border">
              {[
                "What skills do I need for placement?",
                "How to prepare for technical interviews?",
                "Analyze my weak areas",
                "Give me today's study plan",
              ].map((q) => (
                <Button
                  key={q}
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => sendMessage(q)}
                  disabled={loading}
                  className="text-[11px] h-7 px-2.5 rounded-full"
                >
                  {q}
                </Button>
              ))}
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 pb-2">
                {turns.map((t, idx) => (
                  <MessageBubble
                    key={idx}
                    turn={t}
                    isLatest={idx === turns.length - 1}
                  />
                ))}
                {loading && (
                  <div className="flex justify-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-white text-sm flex-shrink-0 shadow-md">
                      🤖
                    </div>
                    <div className="rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3 shadow-sm">
                      <div className="flex gap-1.5">
                        <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-3 border-t border-border">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={loading ? "🔄 Processing through RAG pipeline…" : "Ask about placement preparation..."}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  disabled={loading}
                  className="flex-1 rounded-full px-4"
                />
                <Button onClick={send} disabled={loading || !input.trim()} className="rounded-full px-6 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700">
                  Send
                </Button>
              </div>
              {threadId && (
                <p className="text-[10px] text-muted-foreground mt-1 px-2">
                  Thread: {threadId.slice(0, 20)}… • {history.length} messages in memory
                </p>
              )}
            </div>
          </Card>

          {/* ─── Side Panel ─── */}
          <div className="space-y-3" style={{ maxHeight: "calc(100vh - 170px)", overflowY: "auto" }}>
            {/* Tab Selector */}
            <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
              {(["pipeline", "sources", "context", "personalization"] as const).map((tab) => (
                <button
                  key={tab}
                  className={`flex-1 text-[11px] py-1.5 px-2 rounded-md font-medium transition-colors ${activeTab === tab ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => {
                    setActiveTab(tab);
                    if (tab === "personalization" && !personalization) loadPersonalization();
                  }}
                >
                  {tab === "pipeline" ? "🔧 Pipeline" : tab === "sources" ? "📎 Sources" : tab === "context" ? "📋 Context" : "🎯 Skills"}
                </button>
              ))}
            </div>

            {/* Pipeline Panel */}
            {activeTab === "pipeline" && (
              <Card className="p-3">
                <h3 className="text-sm font-semibold mb-2">Advanced RAG Pipeline v2</h3>
                {pipeline.length > 0 ? (
                  <div className="space-y-1">
                    {pipeline.map((p, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className="w-5 text-center mt-0.5">
                          {p.status === "done" ? STEP_ICONS[p.step] || "✅" :
                           p.status === "processing" ? "⏳" :
                           p.status === "blocked" ? "🚫" :
                           p.status === "warning" ? "⚠️" : "⬜"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className={`font-medium ${p.status === "done" ? "" : p.status === "blocked" ? "text-red-600" : "text-muted-foreground"}`}>
                            {p.step}
                          </span>
                          {p.detail && (
                            <span className="text-muted-foreground ml-1 block truncate">— {p.detail}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Send a message to see the 12-step RAG pipeline</p>
                )}
              </Card>
            )}

            {/* Sources Panel */}
            {activeTab === "sources" && (
              <Card className="p-3">
                <h3 className="text-sm font-semibold mb-2">📎 Retrieved Sources ({ragSources.length})</h3>
                {ragSources.length > 0 ? (
                  <ScrollArea className="max-h-[400px] pr-2">
                    <div className="space-y-2">
                      {ragSources.map((s, i) => (
                        <div key={i} className="rounded-lg border border-border p-2.5 text-xs hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-violet-600 dark:text-violet-400">[Source {i + 1}]</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${s.score >= 0.7 ? "bg-green-100 text-green-700" : s.score >= 0.4 ? "bg-yellow-100 text-yellow-700" : "bg-orange-100 text-orange-700"}`}>
                              {Math.round(s.score * 100)}% match
                            </span>
                          </div>
                          <p className="text-muted-foreground leading-relaxed">{s.text}</p>
                          <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2">
                            <span>📄 {s.source}</span>
                            <span>Chunk #{s.chunkIndex}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-xs text-muted-foreground">Sources appear after sending a message</p>
                )}
              </Card>
            )}

            {/* Context Panel */}
            {activeTab === "context" && (
              <Card className="p-3">
                <h3 className="text-sm font-semibold mb-2">📋 Student Context</h3>
                {contextLoading ? (
                  <p className="text-xs text-muted-foreground">Loading...</p>
                ) : context ? (
                  <div className="space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="bg-muted/50 rounded-md p-2">
                        <span className="text-muted-foreground block text-[10px]">Career</span>
                        <span className="font-medium">{context.facts?.careerPath || "—"}</span>
                      </div>
                      <div className="bg-muted/50 rounded-md p-2">
                        <span className="text-muted-foreground block text-[10px]">Week</span>
                        <span className="font-medium">{context.facts?.unlockedWeek || "—"}</span>
                      </div>
                    </div>
                    {context.facts?.latestScores && (
                      <div className="space-y-1">
                        <span className="font-semibold text-[11px]">Latest Scores</span>
                        {Object.entries(context.facts.latestScores as Record<string, number | null>).map(([k, v]) => (
                          <div key={k} className="flex items-center gap-2">
                            <span className="text-muted-foreground w-16">{k}</span>
                            <div className="flex-1 bg-muted rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${(v ?? 0) >= 70 ? "bg-green-500" : (v ?? 0) >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                                style={{ width: `${Math.min(100, v ?? 0)}%` }}
                              />
                            </div>
                            <span className="w-10 text-right font-medium">{v !== null ? `${v}%` : "—"}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No context available.</p>
                )}
              </Card>
            )}

            {/* Personalization Panel */}
            {activeTab === "personalization" && (
              <Card className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">🎯 Skill Gap & Daily Tasks</h3>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={loadPersonalization} disabled={persLoading}>
                    {persLoading ? "Loading..." : "Refresh"}
                  </Button>
                </div>
                {personalization ? (
                  <div className="space-y-3 text-xs">
                    {/* Readiness Score */}
                    <div className="text-center py-2">
                      <div className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
                        {personalization.overallReadiness}%
                      </div>
                      <p className="text-muted-foreground text-[10px]">Placement Readiness</p>
                    </div>

                    {/* Weak Areas */}
                    {personalization.weakAreas?.length > 0 && (
                      <div>
                        <span className="font-semibold text-red-600 dark:text-red-400">Weak Areas</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {personalization.weakAreas.map((a: string) => (
                            <span key={a} className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 text-[10px]">
                              {a}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Daily Tasks */}
                    {personalization.dailyTasks?.length > 0 && (
                      <div>
                        <span className="font-semibold">📝 Today's Tasks</span>
                        <div className="space-y-1.5 mt-1">
                          {personalization.dailyTasks.map((task: DailyTask, i: number) => (
                            <div key={i} className={`rounded-md border-l-2 p-2 ${PRIORITY_COLORS[task.priority] || ""}`}>
                              <div className="font-medium">{task.title}</div>
                              <div className="text-muted-foreground flex gap-2 mt-0.5">
                                <span>⏱ {task.estimatedMinutes}min</span>
                                <span>• {task.reason}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Adaptive Insights */}
                    {personalization.adaptiveInsights?.length > 0 && (
                      <div>
                        <span className="font-semibold">💡 Insights</span>
                        {personalization.adaptiveInsights.map((insight: string, i: number) => (
                          <p key={i} className="text-muted-foreground mt-1 leading-relaxed">
                            {insight}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Skill Gaps */}
                    {personalization.skillGaps?.filter((g: SkillGap) => g.status === "missing" && g.category === "core").length > 0 && (
                      <div>
                        <span className="font-semibold text-orange-600 dark:text-orange-400">Missing Core Skills</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {personalization.skillGaps
                            .filter((g: SkillGap) => g.status === "missing" && g.category === "core")
                            .map((g: SkillGap) => (
                              <span key={g.skill} className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 text-[10px]">
                                {g.skill}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : persLoading ? (
                  <p className="text-xs text-muted-foreground">Analyzing your profile...</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Click refresh to analyze your skill gaps</p>
                )}
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
