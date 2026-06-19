import { createFileRoute, useParams } from "@tanstack/react-router";
import {
  LanguageDonut,
  ProjectStackedChart,
  TrendLineChart,
  WeekdayBarChart
} from "@/components/charts";
import {
  LoadingSkeleton,
  RangePicker,
  StatCard,
  useDashboardData
} from "@/components/dashboard-shell";
import { formatShortDate } from "@/lib/stats";

export const Route = createFileRoute("/$machineId/")({
  component: OverviewPage,
});

function OverviewPage() {
  const { machineId } = useParams({ from: "/$machineId/" });
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

  const imageUrl = `/api/v1/image?from=${range.from}&to=${range.to}&machineId=${encodeURIComponent(machineId)}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <RangePicker range={range} onChange={setRange} />
        <a
          href={imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-muted text-sm font-medium hover:text-white hover:bg-surface-hover transition-colors"
        >
          Export image
        </a>
      </div>

      {loading ? <LoadingSkeleton /> : null}

      {error ? (
        <div className="rounded-xl bg-surface border border-red-900/40 p-4 text-red-400 text-sm">
          {error}
        </div>
      ) : null}

      {stats && !loading ? (
        <>
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
              detail={bestDayDate ? formatShortDate(bestDayDate) : undefined}
              accent="amber"
            />
          </div>

          <TrendLineChart items={stats.dailyTotals} />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <ProjectStackedChart items={stats.projectDaily} />
            <LanguageDonut items={stats.languages} />
          </div>

          <WeekdayBarChart items={stats.weekday} />
        </>
      ) : null}
    </div>
  );
}
