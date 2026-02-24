import {
  LanguageDonut,
  ProjectStackedChart,
  TrendLineChart,
  WeekdayBarChart
} from "~/components/charts";
import { RangePicker, useDashboardData } from "~/components/dashboard-shell";

export default function OverviewRoute() {
  const { range, setRange, stats, loading, error, totalLabel, activeDays, rangeLabel } = useDashboardData();

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <h2 className="text-2xl font-semibold">Overview</h2>
        <p className="mt-1 text-sm text-slate-400">Default interval: 1 week.</p>
        <div className="mt-4">
          <RangePicker range={range} onChange={setRange} />
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3">
            <p className="text-xs text-slate-400">Total coded</p>
            <p className="text-xl font-semibold">{totalLabel}</p>
          </div>
          <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3">
            <p className="text-xs text-slate-400">Active days</p>
            <p className="text-xl font-semibold">{activeDays}</p>
          </div>
          <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3 col-span-2">
            <p className="text-xs text-slate-400">Range</p>
            <p className="font-mono text-sm text-slate-300">{rangeLabel}</p>
          </div>
        </div>
      </header>

      {loading ? <p className="text-slate-400">Loading dashboard...</p> : null}
      {error ? <p className="text-red-300">{error}</p> : null}

      {stats ? (
        <>
          <ProjectStackedChart items={stats.projectDaily} />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <WeekdayBarChart items={stats.weekday} />
            <LanguageDonut items={stats.languages} />
          </div>
          <TrendLineChart items={stats.dailyTotals} />
        </>
      ) : null}
    </div>
  );
}
