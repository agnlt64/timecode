import { TrendLineChart, WeekdayBarChart } from "~/components/charts";
import { RangePicker, useDashboardData } from "~/components/dashboard-shell";

export default function WeekdaysRoute() {
  const { range, setRange, stats, loading, error } = useDashboardData();

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <h2 className="text-2xl font-semibold">Weekdays</h2>
        <div className="mt-4">
          <RangePicker range={range} onChange={setRange} />
        </div>
      </header>
      {loading ? <p className="text-slate-400">Loading...</p> : null}
      {error ? <p className="text-red-300">{error}</p> : null}
      {stats ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <WeekdayBarChart items={stats.weekday} />
          <TrendLineChart items={stats.dailyTotals} />
        </div>
      ) : null}
    </div>
  );
}
