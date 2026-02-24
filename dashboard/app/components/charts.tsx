import { formatDuration } from "~/lib/stats";

type ProjectDailyItem = { day: string; projectName: string; seconds: number };
type WeekdayItem = { dayOfWeek: number; seconds: number };
type LanguageItem = { language: string; seconds: number };
type DailyTotalItem = { day: string; seconds: number };

const COLORS = [
  "#2dd4bf", // teal
  "#f59e0b", // amber
  "#ef4444", // red
  "#3b82f6", // blue
  "#a78bfa", // violet
  "#f97316", // orange
  "#06b6d4", // cyan
  "#84cc16"  // lime
];

function colorFor(index: number): string {
  return COLORS[index % COLORS.length];
}

/* ─── Project Horizontal Bars ─── */

export function ProjectStackedChart({ items }: { items: ProjectDailyItem[] }) {
  // Aggregate total per project
  const projectTotals = new Map<string, number>();
  for (const item of items) {
    projectTotals.set(item.projectName, (projectTotals.get(item.projectName) ?? 0) + item.seconds);
  }

  const sorted = [...projectTotals.entries()]
    .sort((a, b) => b[1] - a[1]);

  const maxSeconds = Math.max(1, ...sorted.map(([, s]) => s));

  if (sorted.length === 0) {
    return (
      <section className="rounded-xl bg-surface border border-border p-5 animate-in">
        <h3 className="text-base font-semibold">Projects</h3>
        <p className="mt-3 text-sm text-muted">No project data in this range.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl bg-surface border border-border p-5 animate-in">
      <h3 className="text-base font-semibold">Projects</h3>
      <p className="mt-1 text-xs text-muted">Total time per project</p>
      <div className="mt-4 space-y-3">
        {sorted.map(([name, seconds], idx) => {
          const pct = (seconds / maxSeconds) * 100;
          return (
            <div key={name} className="group">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: colorFor(idx) }}
                  />
                  <span className="text-sm">{name}</span>
                </div>
                <span className="text-sm text-muted font-mono">{formatDuration(seconds)}</span>
              </div>
              <div className="h-2 rounded-full bg-[#222226] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: colorFor(idx)
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── Weekday Bar Chart ─── */

export function WeekdayBarChart({ items }: { items: WeekdayItem[] }) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const map = new Map(items.map((item) => [item.dayOfWeek, item.seconds]));
  const values = order.map((d) => map.get(d) ?? 0);
  const max = Math.max(1, ...values);

  const today = new Date().getDay(); // 0=Sun, 1=Mon, etc.

  return (
    <section className="rounded-xl bg-surface border border-border p-5 animate-in">
      <h3 className="text-base font-semibold">Weekday Pattern</h3>
      <p className="mt-1 text-xs text-muted">Average coding time per day of the week</p>
      <div className="mt-4 flex gap-2 items-end h-44">
        {order.map((weekday, idx) => {
          const seconds = values[idx] ?? 0;
          const h = (seconds / max) * 140;
          const isToday = weekday === today;
          return (
            <div key={weekday} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-muted font-mono">
                {seconds > 0 ? formatDuration(seconds) : ""}
              </span>
              <div className="w-full flex items-end justify-center h-32">
                <div
                  className="w-full max-w-10 rounded-t-md transition-all duration-500"
                  style={{
                    height: Math.max(3, h),
                    backgroundColor: isToday ? "#2dd4bf" : "#3a3a3e"
                  }}
                  title={`${labels[weekday]}: ${formatDuration(seconds)}`}
                />
              </div>
              <span className={`text-xs ${isToday ? "text-accent font-medium" : "text-muted"}`}>
                {labels[weekday]}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── Language Donut ─── */

export function LanguageDonut({ items }: { items: LanguageItem[] }) {
  const total = items.reduce((acc, i) => acc + i.seconds, 0);
  const slices: string[] = [];
  let cursor = 0;

  items.forEach((item, idx) => {
    const pct = total > 0 ? (item.seconds / total) * 100 : 0;
    slices.push(`${colorFor(idx)} ${cursor}% ${cursor + pct}%`);
    cursor += pct;
  });

  const gradient =
    slices.length > 0
      ? `conic-gradient(${slices.join(", ")})`
      : "conic-gradient(#2a2a2e 0% 100%)";

  return (
    <section className="rounded-xl bg-surface border border-border p-5 animate-in">
      <h3 className="text-base font-semibold">Languages</h3>
      <p className="mt-1 text-xs text-muted">Time proportion by language</p>
      <div className="mt-4 flex items-center gap-6">
        <div className="relative h-36 w-36 shrink-0 rounded-full" style={{ background: gradient }}>
          <div className="absolute inset-5 rounded-full bg-surface flex items-center justify-center">
            <span className="text-sm font-mono text-muted">{formatDuration(total)}</span>
          </div>
        </div>
        <div className="space-y-2 text-sm min-w-0">
          {items.length === 0 ? (
            <p className="text-muted">No language data.</p>
          ) : null}
          {items.map((item, idx) => {
            const pct = total > 0 ? (item.seconds / total) * 100 : 0;
            return (
              <div key={item.language} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: colorFor(idx) }}
                />
                <span className="truncate">{item.language}</span>
                <span className="text-muted ml-auto shrink-0 font-mono text-xs">
                  {pct.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── Daily Trend Area Chart ─── */

export function TrendLineChart({ items }: { items: DailyTotalItem[] }) {
  const sorted = [...items].sort((a, b) => a.day.localeCompare(b.day));
  const max = Math.max(1, ...sorted.map((i) => i.seconds));

  const width = 620;
  const height = 180;
  const padTop = 10;
  const padBottom = 30;
  const chartH = height - padTop - padBottom;

  const points = sorted.map((item, i) => {
    const x = sorted.length > 1 ? (i / (sorted.length - 1)) * width : width / 2;
    const y = padTop + chartH - (item.seconds / max) * chartH;
    return { x, y, day: item.day, seconds: item.seconds };
  });

  // Build smooth polyline
  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Area fill path
  const areaPath =
    points.length > 1
      ? `M${points[0].x},${padTop + chartH} ` +
      points.map((p) => `L${p.x},${p.y}`).join(" ") +
      ` L${points[points.length - 1].x},${padTop + chartH} Z`
      : "";

  // Y-axis labels
  const ySteps = 4;
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
    const seconds = Math.round((max / ySteps) * (ySteps - i));
    const y = padTop + (i / ySteps) * chartH;
    return { seconds, y };
  });

  if (points.length === 0) {
    return (
      <section className="rounded-xl bg-surface border border-border p-5 animate-in">
        <h3 className="text-base font-semibold">Daily Trend</h3>
        <p className="mt-3 text-sm text-muted">No trend data in this range.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl bg-surface border border-border p-5 animate-in">
      <h3 className="text-base font-semibold">Daily Trend</h3>
      <p className="mt-1 text-xs text-muted">Spot momentum and low-output days</p>
      <div className="mt-4 overflow-x-auto">
        <svg viewBox={`-50 0 ${width + 60} ${height}`} className="w-full min-w-[500px]">
          {/* Y-axis grid lines */}
          {yLabels.map(({ seconds, y }) => (
            <g key={seconds}>
              <line x1={0} y1={y} x2={width} y2={y} stroke="#2a2a2e" strokeWidth="1" />
              <text x={-8} y={y + 4} textAnchor="end" fill="#a1a1aa" fontSize="10" fontFamily="JetBrains Mono, monospace">
                {formatDuration(seconds)}
              </text>
            </g>
          ))}

          {/* Area fill */}
          {areaPath && <path d={areaPath} fill="rgba(45, 212, 191, 0.08)" />}

          {/* Line */}
          <polyline points={polyline} fill="none" stroke="#2dd4bf" strokeWidth="2" />

          {/* Points */}
          {points.map((p) => (
            <g key={p.day}>
              <circle cx={p.x} cy={p.y} r="3" fill="#2dd4bf" />
              <text
                x={p.x}
                y={padTop + chartH + 18}
                textAnchor="middle"
                fill="#a1a1aa"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                {p.day.slice(5)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}
