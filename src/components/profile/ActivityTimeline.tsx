import { useMemo } from "react";
import { CheckCircle2, FileText, Sparkles, Target } from "lucide-react";

type TimelineEvent = {
  id: string;
  type: string;
  title: string;
  createdAt: string;
  meta?: Record<string, any>;
};

function iconFor(type: string) {
  if (type === "roadmap_day_complete") return CheckCircle2;
  if (type === "weekly_test_completed" || type === "grand_test_completed" || type === "exam_completed") return FileText;
  if (type === "interview_completed") return Target;
  return Sparkles;
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export function ActivityTimeline({ events }: { events: TimelineEvent[] }) {
  const items = useMemo(() => (events || []).slice(0, 40), [events]);

  if (!items.length) {
    return <div className="text-sm text-muted-foreground">No activity yet — your progress will appear here.</div>;
  }

  return (
    <div className="space-y-3">
      {items.map((e) => {
        const Icon = iconFor(e.type);
        return (
          <div key={e.id} className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/60 p-3">
            <div className="mt-0.5 h-9 w-9 rounded-xl bg-muted/60 flex items-center justify-center">
              <Icon className="h-4 w-4 text-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{e.title}</div>
              <div className="text-xs text-muted-foreground">{formatWhen(e.createdAt)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
