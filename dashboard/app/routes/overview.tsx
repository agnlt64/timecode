import {
  LanguageDonut,
  ProjectStackedChart,
  TrendLineChart,
  WeekdayBarChart
} from "~/components/charts";
import {
  LoadingSkeleton,
  RangePicker,
  StatCard,
  useDashboardData
} from "~/components/dashboard-shell";

export default function OverviewRoute() {
  const {
    range,
    setRange,
    stats,
    loading,
    error,
    totalLabel,
    activeDays,
    totalDays,
    dailyAverageLabel,
    bestDayLabel,
    bestDayDate
  } = useDashboardData();

  return (
    <div className="space-y-5">
      {/* Range picker */}
      <RangePicker range={range} onChange={setRange} />

      {/* Loading */}
      {loading ? <LoadingSkeleton /> : null}

      {/* Error */}
      {error ? (
        <div className="rounded-xl bg-surface border border-red-900/40 p-4 text-red-400 text-sm">
          {error}
        </div>
      ) : null}

      {stats && !loading ? (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-in">
            <StatCard label="Total coded" value={totalLabel} />
            <StatCard
              label="Active days"
              value={String(activeDays)}
              detail={`out of ${totalDays}`}
            />
            <StatCard label="Daily average" value={dailyAverageLabel} />
            <StatCard
              label="Best day"
              value={bestDayLabel}
              detail={bestDayDate ? bestDayDate.slice(5) : undefined}
              accent="amber"
            />
          </div>

          {/* Trend chart */}
          <TrendLineChart items={stats.dailyTotals} />

          {/* Projects + Languages side by side */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <ProjectStackedChart items={stats.projectDaily} />
            <LanguageDonut items={stats.languages} />
          </div>

          {/* Weekday chart */}
          <WeekdayBarChart items={stats.weekday} />
        </>
      ) : null}
    </div>
  );
}
