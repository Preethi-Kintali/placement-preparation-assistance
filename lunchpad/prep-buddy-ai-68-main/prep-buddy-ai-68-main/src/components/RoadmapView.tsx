import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Props {
  roadmap: string;
  onReset: () => void;
}

export function RoadmapView({ roadmap, onReset }: Props) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold gradient-text">Your Preparation Roadmap</h2>
        <p className="text-muted-foreground mt-1">A personalized 2-week plan based on your performance</p>
      </div>

      <Card className="shadow-elevated">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <CardTitle>2-Week Preparation Plan</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{roadmap}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button onClick={onReset} variant="outline" className="gap-2">
          <RotateCcw className="w-4 h-4" /> Start Over
        </Button>
      </div>
    </div>
  );
}
