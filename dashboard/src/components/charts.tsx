import { useState } from "react";
import { formatDuration, formatShortDate } from "@/lib/stats";

type ProjectDailyItem = { day: string; projectName: string; seconds: number };
type WeekdayItem     = { dayOfWeek: number; seconds: number };
type LanguageItem    = { language: string; seconds: number };
type DailyTotalItem  = { day: string; seconds: number };

const PALETTE = [
  "#f5a623", // amber
  "#f07262", // coral
  "#72c4a4", // mint
  "#7ab0d4", // sky
  "#b490d4", // lavender
  "#d4b07a", // gold
  "#70b870", // sage
  "#d48090", // rose
];

const clr = (i: number) => PALETTE[i % PALETTE.length]!;

/* ── Activity Bars ─────────────────────────────────────────── */

export function ActivityBars({ items }: { items: DailyTotalItem[] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const sorted = [...items].sort((a, b) => a.day.localeCompare(b.day));
  const max    = Math.max(1, ...sorted.map((i) => i.seconds));

  if (sorted.length === 0) {
    return <p className="text-sm text-muted">No data for this period.</p>;
  }

  const hoveredItem = sorted.find((i) => i.day === hovered) ?? null;
  const step = sorted.length > 21 ? 7 : sorted.length > 10 ? 3 : 1;

  return (
    <div className="space-y-2">
      {/* Hover status line */}
      <div className="h-5">
        {hoveredItem ? (
          <span className="text-[11px] font-mono text-text">
            {hoveredItem.day} · {formatDuration(hoveredItem.seconds)}
          </span>
        ) : (
          <span className="text-[11px] font-mono text-muted select-none">—</span>
        )}
      </div>

      {/* Bars */}
      <div className="flex items-end gap-px" style={{ height: 96 }}>
        {sorted.map((item, i) => {
          const pct     = (item.seconds / max) * 100;
          const isEmpty = item.seconds === 0;
          const isHov   = hovered === item.day;

          return (
            <div
              key={item.day}
              className="flex-1 flex flex-col items-stretch justify-end h-full cursor-default"
              onMouseEnter={() => setHovered(item.day)}
              onMouseLeave={() => setHovered(null)}
            >
              <div
                className="rounded-sm bar-grow-y transition-colors"
                style={{
                  height:          `${Math.max(isEmpty ? 0 : 2, pct)}%`,
                  backgroundColor: isHov ? "#fff" : isEmpty ? "#221d22" : "#f5a623",
                  opacity:         isHov ? 1 : isEmpty ? 0.5 : 0.5 + (pct / 100) * 0.5,
                  animationDelay:  `${i * 15}ms`,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Date labels */}
      <div className="flex gap-px">
        {sorted.map((item, i) => (
          <div key={item.day} className="flex-1 text-center">
            <span className="text-[8px] font-mono text-muted leading-none">
              {i % step === 0 ? formatShortDate(item.day) : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Project Bars ───────────────────────────────────────────── */

export function ProjectBars({ items }: { items: ProjectDailyItem[] }) {
  const totals = new Map<string, number>();
  for (const item of items) {
    totals.set(item.projectName, (totals.get(item.projectName) ?? 0) + item.seconds);
  }

  const sorted = [...totals.entries()]
    .filter(([, s]) => s > 60)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  const max = Math.max(1, ...sorted.map(([, s]) => s));

  if (sorted.length === 0) {
    return <p className="text-sm text-muted">No project data for this period.</p>;
  }

  return (
    <div className="space-y-3">
      {sorted.map(([name, seconds], i) => {
        const pct = (seconds / max) * 100;
        return (
          <div
            key={name}
            className="grid items-center gap-4"
            style={{ gridTemplateColumns: "minmax(80px, 180px) 1fr 52px" }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="shrink-0 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: clr(i) }}
              />
              <span className="text-sm text-text truncate">{name}</span>
            </div>

            <div className="relative overflow-hidden rounded-full" style={{ height: 3, backgroundColor: "#221d22" }}>
              <div
                className="h-full rounded-full bar-grow-x"
                style={{
                  width:           `${pct}%`,
                  backgroundColor: clr(i),
                  animationDelay:  `${i * 50}ms`,
                }}
              />
            </div>

            <span className="text-[11px] font-mono text-muted text-right tabular-nums">
              {formatDuration(seconds)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Language Tape ──────────────────────────────────────────── */

export function LanguageTape({ items }: { items: LanguageItem[] }) {
  const visible = items.filter((i) => i.seconds > 60).slice(0, 8);
  const total   = visible.reduce((acc, i) => acc + i.seconds, 0);

  if (visible.length === 0) {
    return <p className="text-sm text-muted">No language data for this period.</p>;
  }

  const segments = visible.map((item, i) => ({
    ...item,
    pct:   total > 0 ? (item.seconds / total) * 100 : 0,
    color: clr(i),
  }));

  return (
    <div className="space-y-4">
      {/* Tape */}
      <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
        {segments.map((seg) => (
          <div
            key={seg.language}
            title={`${seg.language} · ${formatDuration(seg.seconds)} · ${seg.pct.toFixed(0)}%`}
            style={{ width: `${seg.pct}%`, backgroundColor: seg.color, minWidth: 3 }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="space-y-2.5">
        {segments.map((seg) => (
          <div key={seg.language} className="flex items-center gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-sm text-text flex-1 truncate">{seg.language}</span>
            <span className="text-[11px] font-mono text-muted tabular-nums">
              {formatDuration(seg.seconds)}
            </span>
            <span className="text-[11px] font-mono text-muted tabular-nums w-7 text-right">
              {seg.pct.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Weekday Chart ──────────────────────────────────────────── */

export function WeekdayChart({ items }: { items: WeekdayItem[] }) {
  const ORDER  = [1, 2, 3, 4, 5, 6, 0] as const;
  const LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  const map    = new Map(items.map((i) => [i.dayOfWeek, i.seconds]));
  const values = ORDER.map((d) => map.get(d) ?? 0);
  const max    = Math.max(1, ...values);
  const today  = new Date().getDay();

  return (
    <div className="flex items-end gap-2" style={{ height: 100 }}>
      {ORDER.map((weekday, i) => {
        const seconds = values[i]!;
        const pct     = (seconds / max) * 100;
        const isToday = weekday === today;

        return (
          <div key={weekday} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="w-full flex flex-col justify-end" style={{ height: 72 }}>
              {seconds > 0 && (
                <span className="block text-center text-[8px] font-mono text-muted mb-1 leading-none">
                  {formatDuration(seconds)}
                </span>
              )}
              <div
                className="w-full rounded-sm bar-grow-y"
                style={{
                  height:          `${Math.max(pct, seconds > 0 ? 4 : 0)}%`,
                  backgroundColor: isToday ? "#f5a623" : "#221d22",
                  animationDelay:  `${i * 40}ms`,
                }}
              />
            </div>
            <span
              className={`text-[9px] font-mono ${
                isToday ? "text-accent font-medium" : "text-muted"
              }`}
            >
              {LABELS[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
