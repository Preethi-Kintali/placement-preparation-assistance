import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, TrendingDown, Star } from "lucide-react";
import type { Evaluation } from "@/lib/types";

interface Props {
  evaluations: Evaluation[];
  onContinue: () => void;
}

export function EvaluationDashboard({ evaluations, onContinue }: Props) {
  const avgScore = evaluations.reduce((s, e) => s + e.score, 0) / evaluations.length;

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-success";
    if (score >= 5) return "text-warning";
    return "text-destructive";
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold gradient-text">Evaluation Results</h2>
        <p className="text-muted-foreground mt-1">Here's how you performed</p>
      </div>

      <Card className="shadow-elevated">
        <CardContent className="py-8 flex items-center justify-center gap-8">
          <div className="text-center">
            <div className={`text-5xl font-bold ${getScoreColor(avgScore)}`}>
              {avgScore.toFixed(1)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Average Score</p>
          </div>
          <div className="h-16 w-px bg-border" />
          <div className="text-center">
            <div className="text-3xl font-bold">{evaluations.length}</div>
            <p className="text-sm text-muted-foreground mt-1">Questions</p>
          </div>
          <div className="h-16 w-px bg-border" />
          <div className="text-center">
            <div className="text-3xl font-bold text-success">
              {evaluations.filter((e) => e.score >= 7).length}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Strong Answers</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {evaluations.map((ev, i) => (
          <Card key={i} className="shadow-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium line-clamp-1 flex-1 mr-4">
                  Q{i + 1}: {ev.question}
                </CardTitle>
                <Badge className={`${ev.score >= 7 ? "bg-success" : ev.score >= 5 ? "bg-warning" : "bg-destructive"} text-primary-foreground`}>
                  <Star className="w-3 h-3 mr-1" /> {ev.score}/10
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="flex items-center gap-1 text-success font-medium mb-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Strengths
                </div>
                <p className="text-muted-foreground">{ev.feedback}</p>
              </div>
              <div>
                <div className="flex items-center gap-1 text-warning font-medium mb-1">
                  <TrendingDown className="w-3.5 h-3.5" /> Improvement
                </div>
                <p className="text-muted-foreground">{ev.improvement}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-center">
        <Button onClick={onContinue} className="gradient-bg text-primary-foreground hover:opacity-90">
          Generate Roadmap <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
