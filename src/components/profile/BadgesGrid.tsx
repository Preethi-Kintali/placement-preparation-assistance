import { cn } from "@/lib/utils";

type BadgeDef = { id: string; title: string; description: string };
type Unlocked = { id: string; unlockedAt: string | Date };

export function BadgesGrid({ all, unlocked }: { all: BadgeDef[]; unlocked: Unlocked[] }) {
  const unlockedSet = new Set((unlocked || []).map((b) => b.id));

  return (
    <div className="grid grid-cols-2 gap-2">
      {(all || []).map((b) => {
        const isUnlocked = unlockedSet.has(b.id);
        return (
          <div
            key={b.id}
            className={cn(
              "rounded-xl border p-3 transition-colors",
              isUnlocked
                ? "border-primary/30 bg-primary/5"
                : "border-border/60 bg-card/40 opacity-70"
            )}
          >
            <div className="text-sm font-semibold">{b.title}</div>
            <div className="text-xs text-muted-foreground">{b.description}</div>
          </div>
        );
      })}
    </div>
  );
}
