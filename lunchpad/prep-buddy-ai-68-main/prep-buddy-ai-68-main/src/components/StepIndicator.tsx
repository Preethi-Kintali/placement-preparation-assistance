import { CheckCircle2 } from "lucide-react";
import type { Step } from "@/lib/types";

const steps: { key: Step; label: string }[] = [
  { key: "company", label: "Select Company" },
  { key: "questions", label: "Interview" },
  { key: "evaluate", label: "Evaluation" },
  { key: "roadmap", label: "Roadmap" },
];

const stepOrder: Step[] = ["company", "questions", "evaluate", "roadmap"];

export function StepIndicator({ current }: { current: Step }) {
  const currentIdx = stepOrder.indexOf(current);

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold transition-all ${
                done
                  ? "bg-success text-success-foreground"
                  : active
                  ? "gradient-bg text-primary-foreground shadow-elevated"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {done ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
            </div>
            <span
              className={`hidden sm:inline text-sm font-medium ${
                active ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div
                className={`w-8 h-0.5 ${
                  done ? "bg-success" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
