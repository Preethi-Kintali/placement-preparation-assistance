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
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} gap-3`}>
      {!isUser && (
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm flex-shrink-0 mt-0.5 shadow-lg shadow-indigo-500/20">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
        </div>
      )}
      <div className={`max-w-[78%] space-y-2 ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={isUser ? "chat-bubble-user" : "chat-bubble-ai"}
          style={{ whiteSpace: "pre-wrap" }}
        >
          <div className="text-sm leading-relaxed">{showContent}</div>
          {isLatest && !isUser && !done && (
            <span className="inline-block w-1.5 h-4 bg-indigo-500 ml-0.5 animate-pulse rounded-sm" />
          )}
        </div>

        {/* Confidence + Grounding badges */}
        {!isUser && turn.confidence && (
          <div className="flex gap-1.5 flex-wrap px-1">
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium border ${CONFIDENCE_COLORS[turn.confidence.level] || CONFIDENCE_COLORS.none}`}>
              {turn.confidence.level === "high" ? "🟢" : turn.confidence.level === "medium" ? "🟡" : turn.confidence.level === "low" ? "🟠" : "🔴"}{" "}
              Confidence: {Math.round(turn.confidence.score * 100)}%
            </span>
            {turn.grounded !== undefined && (
              <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium border ${turn.grounded ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                {turn.grounded ? "⚓ Grounded" : "⚠ Ungrounded"}
              </span>
            )}
            {turn.guardrails?.outputWarnings && turn.guardrails.outputWarnings.length > 0 && (
              <span className="text-[10px] px-2.5 py-1 rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-200">
                ⚠ {turn.guardrails.outputWarnings.length} warning(s)
              </span>
            )}
          </div>
        )}

        {/* Blocked message */}
        {!isUser && turn.guardrails?.blocked && (
          <div className="flex gap-1.5 px-1">
            <span className="text-[10px] px-2.5 py-1 rounded-full font-medium bg-red-50 text-red-700 border border-red-200">
              🛡️ Blocked by guardrails {turn.guardrails.injectionDetected ? "(injection detected)" : ""}
            </span>
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm flex-shrink-0 mt-0.5 shadow-lg shadow-emerald-500/20">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
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
        <div className="glass-card p-4 card-shine">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-indigo-500/20 flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  AI Study Assistant
                  <span className="text-[10px] gradient-primary text-white px-2 py-0.5 rounded-full font-semibold tracking-wide">v2</span>
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1">Advanced RAG</span>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                  <span>Multi-Query</span>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                  <span>Guardrails</span>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                  <span>Chat Memory</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {ragStatus && (
                <div className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border ${ragStatus.indexed
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-red-50 text-red-700 border-red-200"
                  }`}>
                  {ragStatus.indexed
                    ? `✅ ${ragStatus.totalChunks} chunks • ${ragStatus.cacheSize ?? 0} cached`
                    : "⚠️ Not indexed"}
                </div>
              )}

              <Button size="sm" variant="outline" onClick={newChat} className="text-xs h-8 rounded-lg border-border/80 hover:bg-primary/5 hover:border-primary/30">
                + New Chat
              </Button>

              <div className="w-28">
                <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
                  <SelectTrigger className="h-8 text-xs rounded-lg border-border/80">
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

        {/* ─── Main Layout ─── */}
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* Chat Area */}
          <div className="glass-card flex flex-col overflow-hidden" style={{ height: "calc(100vh - 190px)" }}>
            {/* Quick Prompts */}
            <div className="flex flex-wrap gap-2 p-3 border-b border-border/50 bg-muted/20">
              {[
                { q: "What skills do I need for placement?", icon: "🎯" },
                { q: "How to prepare for technical interviews?", icon: "💻" },
                { q: "Analyze my weak areas", icon: "📊" },
                { q: "Give me today's study plan", icon: "📅" },
              ].map(({ q, icon }) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  disabled={loading}
                  className="text-[11px] h-7 px-3 rounded-lg bg-card border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 disabled:opacity-50 font-medium"
                >
                  {icon} {q}
                </button>
              ))}
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-5 py-4">
              <div className="space-y-5 pb-2">
                {turns.map((t, idx) => (
                  <MessageBubble
                    key={idx}
                    turn={t}
                    isLatest={idx === turns.length - 1}
                  />
                ))}
                {loading && (
                  <div className="flex justify-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-indigo-500/20">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                    </div>
                    <div className="chat-bubble-ai">
                      <div className="typing-indicator flex items-center gap-1.5 py-0.5">
                        <span /><span /><span />
                        <span className="text-xs text-muted-foreground ml-2">Thinking…</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t border-border/50 bg-card/50">
              <div className="flex gap-2 items-center">
                <div className="flex-1 relative">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={loading ? "Processing through RAG pipeline…" : "Ask about placement preparation..."}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    disabled={loading}
                    className="rounded-xl pl-4 pr-12 h-11 border-border/80 bg-background focus-visible:ring-primary/20 focus-visible:border-primary/40"
                  />
                </div>
                <Button
                  onClick={send}
                  disabled={loading || !input.trim()}
                  className="rounded-xl h-11 px-5 gradient-primary text-primary-foreground border-0 shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 transition-all disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </Button>
              </div>
              {threadId && (
                <p className="text-[10px] text-muted-foreground mt-2 px-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Thread active • {history.length} messages in memory
                </p>
              )}
            </div>
          </div>

          {/* ─── Side Panel ─── */}
          <div className="space-y-3" style={{ maxHeight: "calc(100vh - 190px)", overflowY: "auto" }}>
            {/* Tab Selector */}
            <div className="glass-card p-1 flex gap-1">
              {(["pipeline", "sources", "context", "personalization"] as const).map((tab) => (
                <button
                  key={tab}
                  className={`flex-1 text-[11px] py-2 px-2 rounded-lg font-medium transition-all duration-200 ${activeTab === tab ? "bg-card shadow-sm text-foreground border border-border/60" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
                  onClick={() => {
                    setActiveTab(tab);
                    if (tab === "personalization" && !personalization) loadPersonalization();
                  }}
                >
                  {tab === "pipeline" ? "Pipeline" : tab === "sources" ? "Sources" : tab === "context" ? "Context" : "Skills"}
                </button>
              ))}
            </div>

            {/* Pipeline Panel */}
            {activeTab === "pipeline" && (
              <div className="glass-card p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md gradient-primary flex items-center justify-center text-white text-[10px]">⚡</span>
                  RAG Pipeline v2
                </h3>
                {pipeline.length > 0 ? (
                  <div className="space-y-1.5">
                    {pipeline.map((p, i) => (
                      <div key={i} className={`flex items-start gap-2.5 text-xs p-2 rounded-lg transition-colors ${p.status === "done" ? "bg-emerald-50/50 border border-emerald-100" : p.status === "processing" ? "bg-indigo-50/50 border border-indigo-100 animate-pulse" : p.status === "blocked" ? "bg-red-50/50 border border-red-100" : "bg-muted/30 border border-transparent"}`}>
                        <span className="w-5 text-center mt-0.5 flex-shrink-0">
                          {p.status === "done" ? STEP_ICONS[p.step] || "✅" :
                           p.status === "processing" ? "⏳" :
                           p.status === "blocked" ? "🚫" :
                           p.status === "warning" ? "⚠️" : "○"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className={`font-medium ${p.status === "done" ? "text-emerald-700" : p.status === "blocked" ? "text-red-600" : p.status === "processing" ? "text-indigo-600" : "text-muted-foreground"}`}>
                            {p.step}
                          </span>
                          {p.detail && (
                            <span className="text-muted-foreground ml-1 block truncate text-[10px]">— {p.detail}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Send a message to see the 12-step RAG pipeline</p>
                )}
              </div>
            )}

            {/* Sources Panel */}
            {activeTab === "sources" && (
              <div className="glass-card p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-violet-100 flex items-center justify-center text-violet-600 text-[10px]">📎</span>
                  Retrieved Sources ({ragSources.length})
                </h3>
                {ragSources.length > 0 ? (
                  <ScrollArea className="max-h-[400px] pr-2">
                    <div className="space-y-2">
                      {ragSources.map((s, i) => (
                        <div key={i} className="rounded-xl border border-border/60 p-3 text-xs hover:border-primary/20 hover:bg-primary/[0.02] transition-all duration-200">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-semibold text-indigo-600">[Source {i + 1}]</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${s.score >= 0.7 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : s.score >= 0.4 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-orange-50 text-orange-700 border-orange-200"}`}>
                              {Math.round(s.score * 100)}% match
                            </span>
                          </div>
                          <p className="text-muted-foreground leading-relaxed">{s.text}</p>
                          <div className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-2">
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
              </div>
            )}

            {/* Context Panel */}
            {activeTab === "context" && (
              <div className="glass-card p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-sky-100 flex items-center justify-center text-sky-600 text-[10px]">📋</span>
                  Student Context
                </h3>
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
              </div>
            )}

            {/* Personalization Panel */}
            {activeTab === "personalization" && (
              <div className="glass-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center text-amber-600 text-[10px]">🎯</span>
                    Skill Gap & Daily Tasks
                  </h3>
                  <Button size="sm" variant="ghost" className="h-7 text-[10px] rounded-lg" onClick={loadPersonalization} disabled={persLoading}>
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
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
