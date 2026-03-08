import { useState, useCallback, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

type PipelineStep = { step: string; status: string; detail: string };

type AnalysisResult = {
    _id: string;
    atsScore: number;
    categoryPrediction: string;
    categoryConfidence: number;
    scoreBreakdown: {
        skillMatch: number;
        categoryRelevance: number;
        keywordDensity: number;
        formatQuality: number;
        experienceMatch: number;
    };
    extractedSkills: string[];
    jdSkills: string[];
    matchedSkills: string[];
    missingSkills: string[];
    additionalSkills: string[];
    mlRecommendations: string[];
    geminiRecommendations: string[];
    finalRecommendations: string[];
    pipeline: PipelineStep[];
};

type HistoryItem = {
    _id: string;
    resumeFileName: string;
    jdFileName: string;
    atsScore: number;
    categoryPrediction: string;
    createdAt: string;
};

// Pipeline step icons
const STEP_ICONS: Record<string, string> = {
    "Resume Parsing": "📄",
    "JD Parsing": "📋",
    "Resume Classification": "🏷️",
    "Skill Extraction": "🔧",
    "Skill Matching": "🔗",
    "Semantic Analysis": "🧠",
    "ATS Score": "📊",
    "ML Recommendations": "🤖",
    "AI Recommendations": "✨",
    "Final Analysis": "✅",
};

// ATS Score color and label
function getScoreColor(score: number) {
    if (score >= 80) return { color: "text-green-500", bg: "bg-green-500", label: "Excellent" };
    if (score >= 60) return { color: "text-yellow-500", bg: "bg-yellow-500", label: "Good" };
    if (score >= 40) return { color: "text-orange-500", bg: "bg-orange-500", label: "Fair" };
    return { color: "text-red-500", bg: "bg-red-500", label: "Needs Work" };
}

export default function ResumeAnalyzer() {
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [jdFile, setJdFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [pipeline, setPipeline] = useState<PipelineStep[]>([]);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<"final" | "ml" | "gemini">("final");
    const [resumeDrag, setResumeDrag] = useState(false);
    const [jdDrag, setJdDrag] = useState(false);

    useEffect(() => {
        loadHistory();
    }, []);

    async function loadHistory() {
        setHistoryLoading(true);
        try {
            const resp = await api.resumeHistory();
            setHistory(resp?.analyses || []);
        } catch {
            // ignore
        } finally {
            setHistoryLoading(false);
        }
    }

    const handleDrop = useCallback(
        (type: "resume" | "jd") => (e: React.DragEvent) => {
            e.preventDefault();
            type === "resume" ? setResumeDrag(false) : setJdDrag(false);
            const file = e.dataTransfer.files?.[0];
            if (file) {
                if (file.type !== "application/pdf" && file.type !== "text/plain") {
                    toast({ title: "Invalid file", description: "Only PDF files are accepted", variant: "destructive" });
                    return;
                }
                type === "resume" ? setResumeFile(file) : setJdFile(file);
            }
        },
        [],
    );

    async function analyze() {
        if (!resumeFile || loading) return;
        setLoading(true);
        setResult(null);

        // Show processing pipeline animation
        const processingSteps: PipelineStep[] = [
            { step: "Resume Parsing", status: "processing", detail: "Extracting text from PDF..." },
            { step: "JD Parsing", status: "waiting", detail: "" },
            { step: "Resume Classification", status: "waiting", detail: "" },
            { step: "Skill Extraction", status: "waiting", detail: "" },
            { step: "Skill Matching", status: "waiting", detail: "" },
            { step: "Semantic Analysis", status: "waiting", detail: "" },
            { step: "ATS Score", status: "waiting", detail: "" },
            { step: "ML Recommendations", status: "waiting", detail: "" },
            { step: "AI Recommendations", status: "waiting", detail: "" },
            { step: "Final Analysis", status: "waiting", detail: "" },
        ];
        setPipeline(processingSteps);

        // Animate steps
        let stepIdx = 0;
        const interval = setInterval(() => {
            stepIdx++;
            if (stepIdx < processingSteps.length) {
                setPipeline((prev) =>
                    prev.map((s, i) =>
                        i < stepIdx
                            ? { ...s, status: "done", detail: s.detail || "Complete" }
                            : i === stepIdx
                                ? { ...s, status: "processing", detail: "Processing..." }
                                : s,
                    ),
                );
            }
        }, 800);

        try {
            const resp = await api.resumeAnalyze(resumeFile, jdFile ?? undefined);
            clearInterval(interval);
            setResult(resp);
            if (resp.pipeline) setPipeline(resp.pipeline);
            toast({ title: "Analysis Complete", description: `ATS Score: ${resp.atsScore}/100` });
            loadHistory();
        } catch (e: any) {
            clearInterval(interval);
            setPipeline([]);
            toast({
                title: "Analysis Failed",
                description: e?.details || e?.error || e?.message || "Something went wrong",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }

    const scoreInfo = result ? getScoreColor(result.atsScore) : null;

    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 pt-20 pb-8 space-y-6">
                {/* Header */}
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        📝 ATS Resume Analyzer
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Upload your Resume PDF (required) & optionally a Job Description • ML-powered skill matching + Gemini AI recommendations
                    </p>
                </div>

                {/* Upload Section */}
                <div className="grid gap-4 md:grid-cols-2">
                    {/* Resume Upload */}
                    <Card
                        className={`p-6 border-2 border-dashed transition-all duration-300 cursor-pointer ${resumeDrag
                            ? "border-primary bg-primary/5 scale-[1.01]"
                            : resumeFile
                                ? "border-green-500/50 bg-green-500/5"
                                : "border-border hover:border-primary/50 hover:bg-muted/30"
                            }`}
                        onDragOver={(e) => { e.preventDefault(); setResumeDrag(true); }}
                        onDragLeave={() => setResumeDrag(false)}
                        onDrop={handleDrop("resume")}
                        onClick={() => {
                            const input = document.createElement("input");
                            input.type = "file";
                            input.accept = ".pdf,.txt";
                            input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) setResumeFile(file);
                            };
                            input.click();
                        }}
                    >
                        <div className="text-center space-y-3">
                            <div className="text-4xl">{resumeFile ? "✅" : "📄"}</div>
                            <div>
                                <h3 className="font-semibold text-lg">
                                    {resumeFile ? resumeFile.name : "Upload Resume"}
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {resumeFile
                                        ? `${(resumeFile.size / 1024).toFixed(1)} KB`
                                        : "Drag & drop or click to browse • PDF only"}
                                </p>
                            </div>
                            {resumeFile && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-xs text-destructive"
                                    onClick={(e) => { e.stopPropagation(); setResumeFile(null); }}
                                >
                                    Remove
                                </Button>
                            )}
                        </div>
                    </Card>

                    {/* JD Upload */}
                    <Card
                        className={`p-6 border-2 border-dashed transition-all duration-300 cursor-pointer ${jdDrag
                            ? "border-primary bg-primary/5 scale-[1.01]"
                            : jdFile
                                ? "border-green-500/50 bg-green-500/5"
                                : "border-border hover:border-primary/50 hover:bg-muted/30"
                            }`}
                        onDragOver={(e) => { e.preventDefault(); setJdDrag(true); }}
                        onDragLeave={() => setJdDrag(false)}
                        onDrop={handleDrop("jd")}
                        onClick={() => {
                            const input = document.createElement("input");
                            input.type = "file";
                            input.accept = ".pdf,.txt";
                            input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) setJdFile(file);
                            };
                            input.click();
                        }}
                    >
                        <div className="text-center space-y-3">
                            <div className="text-4xl">{jdFile ? "✅" : "📋"}</div>
                            <div>
                                <h3 className="font-semibold text-lg">
                                    {jdFile ? jdFile.name : "Upload Job Description (Optional)"}
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {jdFile
                                        ? `${(jdFile.size / 1024).toFixed(1)} KB`
                                        : "Drag & drop or click to browse • Optional"}
                                </p>
                            </div>
                            {jdFile && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-xs text-destructive"
                                    onClick={(e) => { e.stopPropagation(); setJdFile(null); }}
                                >
                                    Remove
                                </Button>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Analyze Button */}
                <div className="flex justify-center">
                    <Button
                        size="lg"
                        onClick={analyze}
                        disabled={!resumeFile || loading}
                        className="px-12 py-6 text-lg font-semibold gradient-primary text-primary-foreground border-0 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <span className="animate-spin">⚙️</span> Analyzing...
                            </span>
                        ) : (
                            "🚀 Analyze Resume"
                        )}
                    </Button>
                </div>

                {/* Pipeline + Results Layout */}
                {(pipeline.length > 0 || result) && (
                    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
                        {/* Main Results */}
                        <div className="space-y-6">
                            {/* ATS Score Card */}
                            {result && scoreInfo && (
                                <Card className="p-6">
                                    <div className="flex flex-wrap items-center gap-8">
                                        {/* Score Gauge */}
                                        <div className="relative w-36 h-36 flex-shrink-0">
                                            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                                                <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/20" />
                                                <circle
                                                    cx="60" cy="60" r="50" fill="none" strokeWidth="10"
                                                    strokeDasharray={`${result.atsScore * 3.14} ${314 - result.atsScore * 3.14}`}
                                                    strokeLinecap="round"
                                                    className={scoreInfo.color}
                                                    style={{ transition: "stroke-dasharray 1s ease-out" }}
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <span className={`text-3xl font-bold ${scoreInfo.color}`}>{result.atsScore}</span>
                                                <span className="text-xs text-muted-foreground">/100</span>
                                            </div>
                                        </div>

                                        {/* Score Details */}
                                        <div className="flex-1 min-w-0 space-y-3">
                                            <div>
                                                <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${result.atsScore >= 80 ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                                                    result.atsScore >= 60 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" :
                                                        result.atsScore >= 40 ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" :
                                                            "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                                    }`}>
                                                    {scoreInfo.label}
                                                </span>
                                                <span className="ml-3 text-sm text-muted-foreground">
                                                    Category: <strong>{result.categoryPrediction}</strong> ({Math.round(result.categoryConfidence * 100)}%)
                                                </span>
                                            </div>

                                            {/* Score Breakdown Bars */}
                                            <div className="space-y-2">
                                                {[
                                                    { label: "Skill Match", value: result.scoreBreakdown.skillMatch, weight: "40%" },
                                                    { label: "Category Relevance", value: result.scoreBreakdown.categoryRelevance, weight: "20%" },
                                                    { label: "Keyword Density", value: result.scoreBreakdown.keywordDensity, weight: "15%" },
                                                    { label: "Format Quality", value: result.scoreBreakdown.formatQuality, weight: "10%" },
                                                    { label: "Experience Match", value: result.scoreBreakdown.experienceMatch, weight: "15%" },
                                                ].map((b) => (
                                                    <div key={b.label} className="flex items-center gap-2 text-xs">
                                                        <span className="w-32 truncate font-medium">{b.label}</span>
                                                        <div className="flex-1 h-2 bg-muted/40 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-1000 ${b.value >= 70 ? "bg-green-500" : b.value >= 40 ? "bg-yellow-500" : "bg-red-500"
                                                                    }`}
                                                                style={{ width: `${b.value}%` }}
                                                            />
                                                        </div>
                                                        <span className="w-12 text-right text-muted-foreground">{b.value}% <span className="text-[10px]">({b.weight})</span></span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            )}

                            {/* Skills Analysis */}
                            {result && (
                                <div className="grid gap-4 md:grid-cols-3">
                                    {/* Matched Skills */}
                                    <Card className="p-4">
                                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-green-500" /> Matched Skills ({result.matchedSkills.length})
                                        </h3>
                                        <ScrollArea className="h-40">
                                            <div className="flex flex-wrap gap-1.5">
                                                {result.matchedSkills.map((s) => (
                                                    <span key={s} className="px-2 py-0.5 rounded-md text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                                        {s}
                                                    </span>
                                                ))}
                                                {result.matchedSkills.length === 0 && (
                                                    <span className="text-xs text-muted-foreground">No matching skills found</span>
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </Card>

                                    {/* Missing Skills */}
                                    <Card className="p-4">
                                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-red-500" /> Missing Skills ({result.missingSkills.length})
                                        </h3>
                                        <ScrollArea className="h-40">
                                            <div className="flex flex-wrap gap-1.5">
                                                {result.missingSkills.map((s) => (
                                                    <span key={s} className="px-2 py-0.5 rounded-md text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                                        {s}
                                                    </span>
                                                ))}
                                                {result.missingSkills.length === 0 && (
                                                    <span className="text-xs text-muted-foreground">All JD skills matched! 🎉</span>
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </Card>

                                    {/* Additional Skills */}
                                    <Card className="p-4">
                                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-blue-500" /> Extra Skills ({result.additionalSkills.length})
                                        </h3>
                                        <ScrollArea className="h-40">
                                            <div className="flex flex-wrap gap-1.5">
                                                {result.additionalSkills.slice(0, 30).map((s) => (
                                                    <span key={s} className="px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                                        {s}
                                                    </span>
                                                ))}
                                                {result.additionalSkills.length === 0 && (
                                                    <span className="text-xs text-muted-foreground">No extra skills</span>
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </Card>
                                </div>
                            )}

                            {/* Recommendations */}
                            {result && (
                                <Card className="p-6">
                                    <h3 className="text-lg font-semibold mb-4">💡 Recommendations</h3>

                                    {/* Tab Buttons */}
                                    <div className="flex gap-2 mb-4">
                                        {[
                                            { key: "final" as const, label: "🏆 Best Combined", count: result.finalRecommendations.length },
                                            { key: "gemini" as const, label: "✨ Gemini AI", count: result.geminiRecommendations.length },
                                            { key: "ml" as const, label: "🤖 ML Model", count: result.mlRecommendations.length },
                                        ].map((tab) => (
                                            <Button
                                                key={tab.key}
                                                size="sm"
                                                variant={activeTab === tab.key ? "default" : "outline"}
                                                onClick={() => setActiveTab(tab.key)}
                                                className="text-xs"
                                            >
                                                {tab.label} ({tab.count})
                                            </Button>
                                        ))}
                                    </div>

                                    {/* Recommendation List */}
                                    <div className="space-y-3">
                                        {(activeTab === "final"
                                            ? result.finalRecommendations
                                            : activeTab === "gemini"
                                                ? result.geminiRecommendations
                                                : result.mlRecommendations
                                        ).map((rec, i) => (
                                            <div key={i} className="flex gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                                                    {i + 1}
                                                </span>
                                                <p className="text-sm leading-relaxed">{rec}</p>
                                            </div>
                                        ))}
                                        {(activeTab === "final" ? result.finalRecommendations : activeTab === "gemini" ? result.geminiRecommendations : result.mlRecommendations).length === 0 && (
                                            <p className="text-sm text-muted-foreground text-center py-4">No recommendations available</p>
                                        )}
                                    </div>
                                </Card>
                            )}
                        </div>

                        {/* Side Panel: Pipeline + History */}
                        <div className="space-y-4">
                            {/* Pipeline */}
                            <Card className="p-4">
                                <h3 className="text-sm font-semibold mb-3">🔄 Analysis Pipeline</h3>
                                <div className="space-y-1.5">
                                    {pipeline.map((p, i) => (
                                        <div key={i} className="flex items-start gap-2 text-xs">
                                            <span className="w-5 text-center flex-shrink-0 mt-0.5">
                                                {p.status === "done"
                                                    ? STEP_ICONS[p.step] || "✅"
                                                    : p.status === "processing"
                                                        ? <span className="animate-pulse">⏳</span>
                                                        : "⬜"}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <span className={`font-medium ${p.status === "done" ? "" : "text-muted-foreground"}`}>
                                                    {p.step}
                                                </span>
                                                {p.detail && p.status === "done" && (
                                                    <div className="text-muted-foreground text-[11px] truncate">{p.detail}</div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            {/* History */}
                            <Card className="p-4">
                                <h3 className="text-sm font-semibold mb-3">📜 Past Analyses</h3>
                                {historyLoading ? (
                                    <p className="text-xs text-muted-foreground">Loading...</p>
                                ) : history.length > 0 ? (
                                    <ScrollArea className="h-[250px] pr-2">
                                        <div className="space-y-2">
                                            {history.map((h) => {
                                                const sc = getScoreColor(h.atsScore);
                                                return (
                                                    <div key={h._id} className="rounded-lg border border-border p-3 space-y-1.5">
                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-lg font-bold ${sc.color}`}>{h.atsScore}</span>
                                                            <span className="text-[10px] text-muted-foreground">
                                                                {new Date(h.createdAt).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs truncate" title={h.resumeFileName}>
                                                            📄 {h.resumeFileName}
                                                        </div>
                                                        <div className="text-xs truncate text-muted-foreground" title={h.jdFileName}>
                                                            📋 {h.jdFileName}
                                                        </div>
                                                        <div className="text-[11px] text-muted-foreground">
                                                            {h.categoryPrediction}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </ScrollArea>
                                ) : (
                                    <p className="text-xs text-muted-foreground">No analyses yet. Upload files to get started!</p>
                                )}
                            </Card>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
