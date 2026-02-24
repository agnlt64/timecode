import { useEffect, useMemo, useState } from "react";

import {
  defaultWeekRange,
  fetchDashboardStats,
  formatDuration,
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

  return {
    range,
    setRange,
    stats,
    loading,
    error,
    totalSeconds,
    activeDays,
    totalLabel: formatDuration(totalSeconds),
    rangeLabel: rangeLabel(range)
  };
}

export function RangePicker({
  range,
  onChange
}: {
  range: DateRange;
  onChange: (next: DateRange) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
      <button
        className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-sm"
        onClick={() => onChange(defaultWeekRange())}
      >
        Last 7 days
      </button>
      <label className="text-sm text-slate-400">From</label>
      <input
        type="date"
        className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
        value={range.from}
        onChange={(e) => onChange({ ...range, from: e.target.value })}
      />
      <label className="text-sm text-slate-400">To</label>
      <input
        type="date"
        className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
        value={range.to}
        onChange={(e) => onChange({ ...range, to: e.target.value })}
      />
    </div>
  );
}
