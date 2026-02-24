import { formatDuration } from "~/lib/stats";

type ProjectDailyItem = { day: string; projectName: string; seconds: number };
type WeekdayItem = { dayOfWeek: number; seconds: number };
type LanguageItem = { language: string; seconds: number };
type DailyTotalItem = { day: string; seconds: number };

const COLORS = [
  "#22d3ee",
  "#f59e0b",
  "#34d399",
  "#f87171",
  "#a78bfa",
  "#fb7185",
  "#60a5fa",
  "#fbbf24"
];

function colorFor(index: number): string {
  return COLORS[index % COLORS.length];
}

export function ProjectStackedChart({ items }: { items: ProjectDailyItem[] }) {
  const byDay = new Map<string, { projectName: string; seconds: number }[]>();
  for (const item of items) {
    const dayItems = byDay.get(item.day) ?? [];
    dayItems.push({ projectName: item.projectName, seconds: item.seconds });
    byDay.set(item.day, dayItems);
  }

  const days = [...byDay.keys()].sort();
  const totals = days.map((day) => (byDay.get(day) ?? []).reduce((acc, x) => acc + x.seconds, 0));
  const maxTotal = Math.max(1, ...totals);

  const projects = Array.from(new Set(items.map((x) => x.projectName)));
  const projectColor = new Map(projects.map((p, i) => [p, colorFor(i)]));

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="text-lg font-semibold">Project Time per Day (Stacked)</h3>
      <p className="mt-1 text-sm text-slate-400">Each column is a day; each segment is a project.</p>
      <div className="mt-5 flex gap-3 items-end min-h-56">
        {days.length === 0 ? <p className="text-slate-400 text-sm">No data in this range.</p> : null}
        {days.map((day, dayIndex) => {
          const dayItems = [...(byDay.get(day) ?? [])].sort((a, b) => b.seconds - a.seconds);
          const total = totals[dayIndex] ?? 0;
          const height = (total / maxTotal) * 220;
          return (
            <div key={day} className="flex-1 min-w-0">
              <div className="h-56 flex items-end justify-center">
                <div className="w-full max-w-18 rounded-md overflow-hidden border border-slate-700" style={{ height }}>
                  {dayItems.map((seg) => {
                    const segHeight = Math.max(8, (seg.seconds / total) * height);
                    return (
                      <div
                        key={`${day}-${seg.projectName}`}
                        className="w-full"
                        style={{
                          height: segHeight,
                          backgroundColor: projectColor.get(seg.projectName)
                        }}
                        title={`${seg.projectName}: ${formatDuration(seg.seconds)}`}
                      />
                    );
                  })}
                </div>
              </div>
              <p className="mt-2 text-center text-xs text-slate-300">{day.slice(5)}</p>
              <p className="text-center text-xs text-slate-500">{formatDuration(total)}</p>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-300">
        {projects.map((project) => (
          <div key={project} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: projectColor.get(project) }} />
            {project}
          </div>
        ))}
      </div>
    </section>
  );
}

export function WeekdayBarChart({ items }: { items: WeekdayItem[] }) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const map = new Map(items.map((item) => [item.dayOfWeek, item.seconds]));
  const values = order.map((d) => map.get(d) ?? 0);
  const max = Math.max(1, ...values);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="text-lg font-semibold">Weekday Coding Pattern</h3>
      <p className="mt-1 text-sm text-slate-400">How much you coded on each day of the week.</p>
      <div className="mt-4 grid grid-cols-7 gap-2 items-end min-h-48">
        {order.map((weekday, idx) => {
          const seconds = values[idx] ?? 0;
          const h = (seconds / max) * 160;
          return (
            <div key={weekday} className="text-center">
              <div className="h-40 flex items-end justify-center">
                <div
                  className="w-8 rounded-md bg-cyan-400/80 border border-cyan-300/30"
                  style={{ height: Math.max(4, h) }}
                  title={`${labels[weekday]}: ${formatDuration(seconds)}`}
                />
              </div>
              <p className="mt-2 text-xs text-slate-300">{labels[weekday]}</p>
              <p className="text-[10px] text-slate-500">{formatDuration(seconds)}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function LanguageDonut({ items }: { items: LanguageItem[] }) {
  const total = items.reduce((acc, i) => acc + i.seconds, 0);
  const slices: string[] = [];
  let cursor = 0;

  items.forEach((item, idx) => {
    const pct = total > 0 ? (item.seconds / total) * 100 : 0;
    slices.push(`${colorFor(idx)} ${cursor}% ${cursor + pct}%`);
    cursor += pct;
  });

  const gradient = slices.length > 0 ? `conic-gradient(${slices.join(", ")})` : "conic-gradient(#334155 0% 100%)";

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="text-lg font-semibold">Language Share</h3>
      <p className="mt-1 text-sm text-slate-400">Time proportion by language.</p>
      <div className="mt-4 flex items-center gap-6">
        <div className="relative h-40 w-40 rounded-full" style={{ background: gradient }}>
          <div className="absolute inset-6 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-sm text-slate-300">
            {formatDuration(total)}
          </div>
        </div>
        <div className="space-y-2 text-sm">
          {items.length === 0 ? <p className="text-slate-400">No language data.</p> : null}
          {items.map((item, idx) => {
            const pct = total > 0 ? (item.seconds / total) * 100 : 0;
            return (
              <div key={item.language} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorFor(idx) }} />
                <span className="w-30 truncate text-slate-300">{item.language}</span>
                <span className="text-slate-500">{pct.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function TrendLineChart({ items }: { items: DailyTotalItem[] }) {
  const sorted = [...items].sort((a, b) => a.day.localeCompare(b.day));
  const max = Math.max(1, ...sorted.map((i) => i.seconds));
  const width = 620;
  const height = 200;
  const points = sorted.map((item, i) => {
    const x = sorted.length > 1 ? (i / (sorted.length - 1)) * width : width / 2;
    const y = height - (item.seconds / max) * height;
    return { x, y, day: item.day, seconds: item.seconds };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="text-lg font-semibold">Daily Trend</h3>
      <p className="mt-1 text-sm text-slate-400">Useful to spot momentum and low-output days.</p>
      {points.length === 0 ? (
        <p className="mt-4 text-slate-400 text-sm">No trend data in this range.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height + 28}`} className="w-full min-w-[620px]">
            <polyline points={polyline} fill="none" stroke="#22d3ee" strokeWidth="3" />
            {points.map((p) => (
              <g key={p.day}>
                <circle cx={p.x} cy={p.y} r="4" fill="#22d3ee" />
                <text x={p.x} y={height + 18} textAnchor="middle" fill="#94a3b8" fontSize="10">
                  {p.day.slice(5)}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}
    </section>
  );
}
