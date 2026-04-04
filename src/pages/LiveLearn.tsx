import { useState, useRef, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Upload, FileText, Send, Bot, User, Loader2, Sparkles, BookOpen, X, Trash2, Brain } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";

type Message = { role: "user" | "ai"; text: string };

export default function LiveLearn() {
  const [notes, setNotes] = useState("");
  const [fileName, setFileName] = useState("");
  const [notesFile, setNotesFile] = useState<File | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<"chat" | "quiz">("chat");
  const [quizLoading, setQuizLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── File handling ──
  const handleFileSelect = (file: File) => {
    setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (ext === "pdf") {
      setNotesFile(file);
      setNotes("__PDF__");
    } else {
      file.text().then(t => setNotes(t.slice(0, 15000)));
      setNotesFile(null);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    handleFileSelect(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0]; if (!f) return;
    handleFileSelect(f);
  };

  // ── Load notes into session ──
  const handleLoadNotes = async () => {
    if (!notes && !notesFile) return;
    setLoading(true);
    try {
      let textForAI = notes;

      // Upload PDF to backend for extraction
      if (notesFile || notes === "__PDF__") {
        if (!notesFile) return;
        const result = await api.interviewResumeUpload(notesFile);
        textForAI = result.text;
        setNotes(textForAI);
      }

      if (!textForAI || textForAI.length < 20 || textForAI === "__PDF__") {
        setMessages([{ role: "ai", text: "❌ Could not extract text from file. Please paste your notes directly." }]);
        setLoading(false);
        return;
      }

      setIsLoaded(true);
      setMessages([{
        role: "ai",
        text: `📚 **Notes loaded successfully!** (${(textForAI.length / 1000).toFixed(1)}K characters)\n\nI've analyzed your notes. Here's what I can do:\n\n• **Ask me anything** about your notes — I'll answer strictly from the content\n• **Quiz me** — I'll generate questions to test your understanding\n• **Explain concepts** — I'll break down complex topics from your notes\n\nWhat would you like to start with?`
      }]);
    } catch (e: any) {
      setMessages([{ role: "ai", text: `❌ ${e?.error || "Failed to process notes. Try pasting text instead."}` }]);
    } finally {
      setLoading(false);
    }
  };

  // ── Send message ──
  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setSending(true);

    try {
      const resp = await api.liveLearnChat({ notes: notes.slice(0, 12000), message: userMsg, mode });
      setMessages(prev => [...prev, { role: "ai", text: resp.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "ai", text: "Sorry, I couldn't process that. Please try again." }]);
    } finally {
      setSending(false);
    }
  };

  // ── Generate quiz ──
  const handleQuiz = async () => {
    setQuizLoading(true);
    setMessages(prev => [...prev, { role: "user", text: "🎯 Generate a quiz from my notes" }]);

    try {
      const resp = await api.liveLearnQuiz({ notes: notes.slice(0, 12000) });
      setMessages(prev => [...prev, { role: "ai", text: resp.quiz }]);
    } catch {
      setMessages(prev => [...prev, { role: "ai", text: "Sorry, couldn't generate quiz. Please try again." }]);
    } finally {
      setQuizLoading(false);
    }
  };

  // ── Reset ──
  const handleReset = () => {
    setNotes(""); setFileName(""); setNotesFile(null);
    setIsLoaded(false); setMessages([]);
    setInput(""); setMode("chat");
  };

  // ══════════════════════════════════════════════════
  //  UPLOAD VIEW
  // ══════════════════════════════════════════════════
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-20 pb-16 container mx-auto px-4 max-w-3xl">
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>

          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto rounded-2xl gradient-primary flex items-center justify-center mb-4">
              <Brain className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Live Learn</h1>
            <p className="text-muted-foreground max-w-md mx-auto">Upload your notes and learn interactively — AI will answer questions, generate quizzes, and explain concepts strictly from your content.</p>
          </div>

          <Card className="p-6">
            {/* Upload Area */}
            <div
              className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer hover:border-primary/50 hover:bg-primary/5 ${fileName ? "border-green-500 bg-green-50 dark:bg-green-900/10" : "border-border"}`}
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => document.getElementById("notes-upload")?.click()}
            >
              <input id="notes-upload" type="file" accept=".pdf,.txt,.md,.doc,.docx" onChange={handleFileInput} className="hidden" />
              {fileName ? (
                <div className="space-y-2">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <FileText className="w-7 h-7 text-green-600" />
                  </div>
                  <p className="font-semibold text-green-700 dark:text-green-400">{fileName}</p>
                  <p className="text-xs text-muted-foreground">{notesFile ? "PDF ready for processing" : `${(notes.length / 1000).toFixed(1)}K characters loaded`}</p>
                  <p className="text-xs text-muted-foreground">Click or drop another file to replace</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-muted/60 flex items-center justify-center">
                    <Upload className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <p className="font-medium">Drop your notes here or click to browse</p>
                  <p className="text-xs text-muted-foreground">Supports PDF, TXT, MD, DOC, DOCX</p>
                </div>
              )}
            </div>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground font-medium">OR</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Text Area */}
            <textarea
              className="w-full min-h-[120px] rounded-xl border border-border bg-background p-4 text-sm resize-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all placeholder:text-muted-foreground"
              placeholder="Paste your notes here — lecture notes, textbook content, study material…"
              value={notes === "__PDF__" ? "" : notes}
              onChange={e => { setNotes(e.target.value); if (!fileName) setFileName("pasted-notes.txt"); }}
            />

            <Button
              className="w-full mt-5 h-12 text-base font-semibold gradient-primary text-primary-foreground border-0 shadow-lg hover:shadow-xl transition-all"
              disabled={(!notes && !notesFile) || loading}
              onClick={handleLoadNotes}
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing notes…</>
              ) : (
                <><Sparkles className="w-5 h-5 mr-2" /> Start Learning</>
              )}
            </Button>
          </Card>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            {[
              { icon: "💬", title: "Ask Anything", desc: "Get answers from your notes" },
              { icon: "🎯", title: "Quiz Mode", desc: "Test your understanding" },
              { icon: "📖", title: "Explanations", desc: "Break down complex topics" },
            ].map(f => (
              <Card key={f.title} className="p-4 text-center">
                <div className="text-2xl mb-2">{f.icon}</div>
                <div className="text-sm font-semibold">{f.title}</div>
                <div className="text-xs text-muted-foreground">{f.desc}</div>
              </Card>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // ══════════════════════════════════════════════════
  //  CHAT VIEW
  // ══════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="pt-20 flex-1 flex flex-col container mx-auto px-4 max-w-3xl pb-4">

        {/* Header bar */}
        <div className="flex items-center justify-between gap-3 py-3 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Live Learn</h2>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <FileText className="w-3 h-3" /> {fileName || "Notes loaded"}
                <span className="ml-1 text-green-600">● Active</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Mode Toggle */}
            <div className="flex rounded-lg bg-muted/50 p-0.5 text-xs">
              <button
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${mode === "chat" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setMode("chat")}
              >💬 Chat</button>
              <button
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${mode === "quiz" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setMode("quiz")}
              >🎯 Quiz</button>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={handleReset} title="New session">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1" style={{ maxHeight: "calc(100vh - 250px)" }}>
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${
                msg.role === "ai"
                  ? "gradient-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}>
                {msg.role === "ai" ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "ai"
                  ? "bg-muted/50 text-foreground rounded-tl-md"
                  : "gradient-primary text-primary-foreground rounded-tr-md"
              }`}>
                {msg.text.split("\n").map((line, li) => (
                  <p key={li} className={li > 0 ? "mt-1.5" : ""}>
                    {line.startsWith("**") && line.endsWith("**")
                      ? <strong>{line.slice(2, -2)}</strong>
                      : line.startsWith("• ")
                      ? <span>• {line.slice(2)}</span>
                      : line}
                  </p>
                ))}
              </div>
            </div>
          ))}

          {(sending || quizLoading) && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="bg-muted/50 rounded-2xl rounded-tl-md px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {quizLoading ? "Generating quiz…" : "Thinking…"}
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Quick Actions */}
        {mode === "quiz" && (
          <div className="mb-3">
            <Button
              variant="outline"
              className="w-full h-10 text-sm border-dashed"
              onClick={handleQuiz}
              disabled={quizLoading}
            >
              <Sparkles className="w-4 h-4 mr-2" /> Generate Quiz from Notes
            </Button>
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder={mode === "quiz" ? "Ask about quiz answers or request more questions…" : "Ask anything about your notes…"}
              className="h-11 pr-12 rounded-xl border-border bg-background focus-visible:ring-primary/30"
              disabled={sending}
            />
            <Button
              size="icon"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg gradient-primary text-primary-foreground border-0"
              onClick={handleSend}
              disabled={!input.trim() || sending}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Responses are generated strictly from your uploaded notes.
        </p>
      </main>
    </div>
  );
}
