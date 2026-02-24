import { useEffect, useMemo, useState } from "react";

import {
  bestDay,
  defaultWeekRange,
  fetchDashboardStats,
  formatDuration,
  last14DaysRange,
  last30DaysRange,
  type DashboardStats,
  type DateRange,
  rangeLabel
} from "~/lib/stats";

export function useDashboardData() {
  const [range, setRange] = useState<DateRange>(defaultWeekRange());
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchDashboardStats(range)
      .then((data) => {
        if (!active) return;
        setStats(data);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load stats");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [range.from, range.to]);

  const totalSeconds = useMemo(() => {
    if (!stats) return 0;
    return stats.dailyTotals.reduce((acc, x) => acc + x.seconds, 0);
  }, [stats]);

  const activeDays = useMemo(() => {
    if (!stats) return 0;
    return stats.dailyTotals.filter((x) => x.seconds > 0).length;
  }, [stats]);

  const totalDays = useMemo(() => {
    if (!stats) return 1;
    return Math.max(1, stats.dailyTotals.length);
  }, [stats]);

  const dailyAverage = useMemo(() => {
    return activeDays > 0 ? Math.round(totalSeconds / activeDays) : 0;
  }, [totalSeconds, activeDays]);

  const best = useMemo(() => {
    if (!stats) return null;
    return bestDay(stats.dailyTotals);
  }, [stats]);

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
    rangeLabel: rangeLabel(range)
  };
}

type RangePreset = "7d" | "14d" | "30d" | "custom";

export function RangePicker({
  range,
  onChange
}: {
  range: DateRange;
  onChange: (next: DateRange) => void;
}) {
  const [activePreset, setActivePreset] = useState<RangePreset>("7d");
  const [showCustom, setShowCustom] = useState(false);

  function selectPreset(preset: RangePreset) {
    setActivePreset(preset);
    if (preset === "7d") {
      setShowCustom(false);
      onChange(defaultWeekRange());
    } else if (preset === "14d") {
      setShowCustom(false);
      onChange(last14DaysRange());
    } else if (preset === "30d") {
      setShowCustom(false);
      onChange(last30DaysRange());
    } else {
      setShowCustom(true);
    }
  }

  const presets: { key: RangePreset; label: string }[] = [
    { key: "7d", label: "7 days" },
    { key: "14d", label: "14 days" },
    { key: "30d", label: "30 days" },
    { key: "custom", label: "Custom" }
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center rounded-lg border border-border bg-surface p-1 gap-0.5">
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => selectPreset(p.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activePreset === p.key
                ? "bg-accent-dim text-accent"
                : "text-muted hover:text-white hover:bg-surface-hover"
              }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {showCustom && (
        <div className="flex items-center gap-2 animate-in">
          <label className="text-sm text-muted">From</label>
          <input
            type="date"
            className="rounded-md bg-surface border border-border px-2.5 py-1.5 text-sm focus:outline-none focus:border-accent transition-colors"
            value={range.from}
            onChange={(e) => onChange({ ...range, from: e.target.value })}
          />
          <label className="text-sm text-muted">to</label>
          <input
            type="date"
            className="rounded-md bg-surface border border-border px-2.5 py-1.5 text-sm focus:outline-none focus:border-accent transition-colors"
            value={range.to}
            onChange={(e) => onChange({ ...range, to: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

export function StatCard({
  label,
  value,
  detail,
  accent = "teal",
  className = ""
}: {
  label: string;
  value: string;
  detail?: string;
  accent?: "teal" | "amber";
  className?: string;
}) {
  const accentColor = accent === "amber" ? "text-amber" : "text-accent";

  return (
    <div className={`rounded-xl bg-surface border border-border p-4 ${className}`}>
      <p className="text-xs text-muted uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accentColor}`}>{value}</p>
      {detail && <p className="mt-0.5 text-xs text-muted">{detail}</p>}
    </div>
  );
}

export function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl bg-surface border border-border p-4 h-20" />
        ))}
      </div>
      <div className="rounded-xl bg-surface border border-border h-64" />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-xl bg-surface border border-border h-56" />
        <div className="rounded-xl bg-surface border border-border h-56" />
      </div>
    </div>
  );
}
