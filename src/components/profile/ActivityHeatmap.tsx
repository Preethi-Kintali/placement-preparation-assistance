import { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type DayRow = {
  dateKey: string; // YYYY-MM-DD
  count: number;
};

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function toUtcDateKey(d: Date) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function parseUtcDateKey(key: string): Date {
  const [y, m, day] = String(key).split("-").map((x) => Number(x));
  return new Date(Date.UTC(y || 1970, (m || 1) - 1, day || 1));
}

function addUtcDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

function intensityClass(level: number) {
  // Uses theme tokens only.
  if (level <= 0) return "bg-muted/60";
  if (level === 1) return "bg-primary/20";
  if (level === 2) return "bg-primary/35";
  if (level === 3) return "bg-primary/55";
  return "bg-primary/80";
}

export function ActivityHeatmap({ days }: { days: DayRow[] }) {
  const map = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of days || []) m.set(d.dateKey, Number(d.count || 0));
    return m;
  }, [days]);

  const { cells, max } = useMemo(() => {
    const today = new Date();
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const start = addUtcDays(end, -364);

    const out: Array<{ dateKey: string; count: number; dow: number }> = [];
    let maxCount = 0;
    for (let i = 0; i < 365; i++) {
      const d = addUtcDays(start, i);
      const key = toUtcDateKey(d);
      const count = Number(map.get(key) ?? 0);
      maxCount = Math.max(maxCount, count);
      out.push({ dateKey: key, count, dow: d.getUTCDay() });
    }
    return { cells: out, max: maxCount };
  }, [map]);

  const levelFor = (count: number) => {
    if (!count) return 0;
    if (max <= 1) return 4;
    const pct = count / max;
    if (pct <= 0.25) return 1;
    if (pct <= 0.5) return 2;
    if (pct <= 0.75) return 3;
    return 4;
  };

  // GitHub/LeetCode style: columns are weeks, rows are days of week.
  const startDate = useMemo(() => {
    const first = parseUtcDateKey(cells[0]?.dateKey || toUtcDateKey(new Date()));
    return first;
  }, [cells]);
  const firstDow = startDate.getUTCDay();

  // Build columns where each column is 7 cells (Sun..Sat)
  const columns = useMemo(() => {
    const cols: Array<Array<{ dateKey: string; count: number } | null>> = [];
    let col: Array<{ dateKey: string; count: number } | null> = new Array(7).fill(null);
    for (let i = 0; i < firstDow; i++) col[i] = null;

    let idx = 0;
    for (const c of cells) {
      // If first column had padding, place accordingly.
      const targetDow = c.dow;
      col[targetDow] = { dateKey: c.dateKey, count: c.count };
      // If Saturday, push column and start new.
      if (targetDow === 6) {
        cols.push(col);
        col = new Array(7).fill(null);
      }
      idx++;
    }
    // Push last partial column
    if (col.some((x) => x)) cols.push(col);
    return cols;
  }, [cells, firstDow]);

  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-flex gap-1">
        {columns.map((col, cIdx) => (
          <div key={cIdx} className="flex flex-col gap-1">
            {col.map((cell, rIdx) => {
              if (!cell) {
                return <div key={rIdx} className="h-3 w-3 rounded-sm bg-transparent" />;
              }
              const level = levelFor(cell.count);
              return (
                <Tooltip key={cell.dateKey}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "h-3 w-3 rounded-sm transition-colors",
                        intensityClass(level)
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <div className="font-medium">{cell.dateKey}</div>
                      <div className="text-muted-foreground">{cell.count} activities</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
