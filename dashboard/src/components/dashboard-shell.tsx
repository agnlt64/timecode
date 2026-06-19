import { useEffect, useMemo, useState } from "react";
import { useParams } from "@tanstack/react-router";
import {
  bestDay,
  defaultWeekRange,
  fetchDashboardStats,
  formatDuration,
  last14DaysRange,
  last30DaysRange,
  type DashboardStats,
  type DateRange,
  rangeLabel,
} from "@/lib/stats";

export function useDashboardData() {
  const { machineId } = useParams({ strict: false }) as { machineId: string };
  const [range, setRange] = useState<DateRange>(defaultWeekRange());
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchDashboardStats(range, machineId)
      .then((data) => { if (active) setStats(data); })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load stats");
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [range.from, range.to, machineId]);

  const totalSeconds = useMemo(
    () => (stats ? stats.dailyTotals.reduce((acc, x) => acc + x.seconds, 0) : 0),
    [stats],
  );

  const activeDays = useMemo(
    () => (stats ? stats.dailyTotals.filter((x) => x.seconds > 0).length : 0),
    [stats],
  );

  const totalDays = useMemo(
    () => (stats ? Math.max(1, stats.dailyTotals.length) : 1),
    [stats],
  );

  const dailyAverage = useMemo(
    () => (activeDays > 0 ? Math.round(totalSeconds / activeDays) : 0),
    [totalSeconds, activeDays],
  );

  const best = useMemo(() => (stats ? bestDay(stats.dailyTotals) : null), [stats]);

  return {
    range,
    setRange,
    stats,
    loading,
    error,
    totalSeconds,
    activeDays,
    totalDays,
    dailyAverage,
    bestDay: best,
    totalLabel: formatDuration(totalSeconds),
    dailyAverageLabel: formatDuration(dailyAverage),
    bestDayLabel: best ? formatDuration(best.seconds) : "—",
    bestDayDate: best?.day ?? "",
    rangeLabel: rangeLabel(range),
  };
}

type RangePreset = "7d" | "14d" | "30d" | "custom";

export function RangePicker({
  range,
  onChange,
}: {
  range: DateRange;
  onChange: (next: DateRange) => void;
}) {
  const [active, setActive] = useState<RangePreset>("7d");
  const [showCustom, setShowCustom] = useState(false);

  function select(preset: RangePreset) {
    setActive(preset);
    if (preset === "7d")     { setShowCustom(false); onChange(defaultWeekRange()); }
    else if (preset === "14d") { setShowCustom(false); onChange(last14DaysRange()); }
    else if (preset === "30d") { setShowCustom(false); onChange(last30DaysRange()); }
    else { setShowCustom(true); }
  }

  const presets: { key: RangePreset; label: string }[] = [
    { key: "7d", label: "7d" },
    { key: "14d", label: "14d" },
    { key: "30d", label: "30d" },
    { key: "custom", label: "custom" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-0.5 rounded border border-border bg-surface p-0.5">
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => select(p.key)}
            className={`px-3 py-1 rounded-sm text-[11px] font-mono transition-colors ${
              active === p.key
                ? "bg-accent-dim text-accent"
                : "text-muted hover:text-text"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="rounded border border-border bg-surface px-2 py-1 text-[11px] font-mono text-text focus:outline-none focus:border-accent transition-colors"
            value={range.from}
            onChange={(e) => onChange({ ...range, from: e.target.value })}
          />
          <span className="text-xs text-muted font-mono">→</span>
          <input
            type="date"
            className="rounded border border-border bg-surface px-2 py-1 text-[11px] font-mono text-text focus:outline-none focus:border-accent transition-colors"
            value={range.to}
            onChange={(e) => onChange({ ...range, to: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

export function LoadingSkeleton() {
  return (
    <div className="space-y-10 animate-pulse">
      <div className="h-20 w-56 rounded bg-surface" />
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-lg bg-surface h-20" />
        ))}
      </div>
      <div className="rounded-lg bg-surface h-28" />
      <div className="rounded-lg bg-surface h-44" />
      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-lg bg-surface h-40" />
        <div className="rounded-lg bg-surface h-40" />
      </div>
    </div>
  );
}
