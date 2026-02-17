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

export default function StudyAssistant() {
  const [provider, setProvider] = useState<"groq" | "gemini">("groq");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<StudyContext | null>(null);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [contextLoading, setContextLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "assistant",
      content:
        "Tell me what you want to achieve today (e.g., ‘I have 60 minutes’ or ‘I’m weak in arrays’). I’ll propose a focused plan.",
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

    loadContext();
    loadSessions();
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

    try {
      const resp = await api.studyChat({ provider, message, history });
      setTurns((t) => [...t, { role: "assistant", content: resp.answer || "(no response)" }]);
      refreshSessions();
    } catch (e: any) {
      toast({
        title: "Study Assistant failed",
        description: e?.details || e?.error || e?.message || "Request failed",
        variant: "destructive",
      });
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
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">AI Study Assistant</h1>
            <p className="text-sm text-muted-foreground">Personalized guidance using your roadmap + results</p>
          </div>

          <div className="w-44">
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

        <Card className="p-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {["30", "60", "90"].map((mins) => (
              <Button
                key={mins}
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => sendMessage(`I have ${mins} minutes today. What should I study?`)}
                disabled={loading}
              >
                {mins} min plan
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
            </div>
          </ScrollArea>

          <div className="mt-4 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={loading ? "Thinking…" : "Ask: what should I study today?"}
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

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-2">Context Preview</h3>
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
                <div>
                  <span className="font-semibold">Docs:</span>
                  <div className="mt-1 space-y-1">
                    {context.docs?.map((d) => (
                      <div key={d.id} className="text-xs text-muted-foreground">
                        {d.title}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No context available.</p>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-2">Recent Sessions</h3>
            {historyLoading ? (
              <p className="text-xs text-muted-foreground">Loading history...</p>
            ) : sessions.length ? (
              <ScrollArea className="h-[200px] pr-2">
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
      </main>
    </div>
  );
}
