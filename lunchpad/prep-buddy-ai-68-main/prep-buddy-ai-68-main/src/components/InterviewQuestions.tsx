import { useState } from "react";
import { Loader2, ArrowRight, MessageSquare, Code, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { evaluateAnswer } from "@/lib/api";
import type { Questions, Evaluation } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

interface Props {
  questions: Questions;
  onComplete: (evaluations: Evaluation[]) => void;
}

const icons = { technical: Code, project: Briefcase, behavioral: MessageSquare };
const labels = { technical: "Technical", project: "Project-Based", behavioral: "Behavioral" };
const colors = { technical: "bg-primary/10 text-primary", project: "bg-accent/10 text-accent", behavioral: "bg-success/10 text-success" };

export function InterviewQuestions({ questions, onComplete }: Props) {
  const allQuestions = [
    ...questions.technical.map((q) => ({ q, type: "technical" as const })),
    ...questions.project.map((q) => ({ q, type: "project" as const })),
    ...questions.behavioral.map((q) => ({ q, type: "behavioral" as const })),
  ];

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const current = allQuestions[currentIdx];
  const Icon = icons[current.type];

  const handleSubmit = async () => {
    const answer = answers[currentIdx]?.trim();
    if (!answer) return;
    setLoading(true);
    try {
      const evalResult = await evaluateAnswer(current.q, answer);
      const newEvals = [...evaluations, evalResult];
      setEvaluations(newEvals);

      if (currentIdx < allQuestions.length - 1) {
        setCurrentIdx(currentIdx + 1);
      } else {
        onComplete(newEvals);
      }
    } catch (e: any) {
      toast({ title: "Evaluation error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold gradient-text">Interview Questions</h2>
        <Badge variant="outline" className="text-sm">
          {currentIdx + 1} / {allQuestions.length}
        </Badge>
      </div>

      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="h-2 rounded-full gradient-bg transition-all"
          style={{ width: `${((currentIdx + 1) / allQuestions.length) * 100}%` }}
        />
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${colors[current.type]}`}>
              <Icon className="w-4 h-4" />
            </div>
            <Badge variant="secondary">{labels[current.type]}</Badge>
          </div>
          <CardTitle className="text-lg mt-3">{current.q}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Type your answer here..."
            value={answers[currentIdx] || ""}
            onChange={(e) => setAnswers({ ...answers, [currentIdx]: e.target.value })}
            rows={6}
            className="resize-none"
          />
          <Button
            onClick={handleSubmit}
            disabled={!answers[currentIdx]?.trim() || loading}
            className="w-full gradient-bg text-primary-foreground hover:opacity-90"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Evaluating...</>
            ) : currentIdx < allQuestions.length - 1 ? (
              <>Submit & Next <ArrowRight className="w-4 h-4 ml-2" /></>
            ) : (
              "Submit & View Results"
            )}
          </Button>
        </CardContent>
      </Card>

      {evaluations.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          ✓ {evaluations.length} answers evaluated — Avg score: {(evaluations.reduce((s, e) => s + e.score, 0) / evaluations.length).toFixed(1)}/10
        </div>
      )}
    </div>
  );
}
