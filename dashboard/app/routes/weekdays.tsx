import { TrendLineChart, WeekdayBarChart } from "~/components/charts";
import { RangePicker, useDashboardData } from "~/components/dashboard-shell";

export default function WeekdaysRoute() {
  const { range, setRange, stats, loading, error } = useDashboardData();

  return (
    <div className="space-y-5">
      <RangePicker range={range} onChange={setRange} />
      {loading ? (
        <div className="animate-pulse rounded-xl bg-surface border border-border h-64" />
      ) : null}
      {error ? (
        <div className="rounded-xl bg-surface border border-red-900/40 p-4 text-red-400 text-sm">
          {error}
        </div>
      ) : null}
      {stats && !loading ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <WeekdayBarChart items={stats.weekday} />
          <TrendLineChart items={stats.dailyTotals} />
        </div>
      ) : null}
    </div>
  );
}
