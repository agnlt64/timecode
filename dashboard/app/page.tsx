"use client";

import {
  LanguageDonut,
  ProjectStackedChart,
  TrendLineChart,
  WeekdayBarChart
} from "@/app/components/charts";
import {
  LoadingSkeleton,
  RangePicker,
  StatCard,
  useDashboardData
} from "@/app/components/dashboard-shell";
import { formatShortDate } from "@/app/lib/stats";

export default function OverviewPage() {
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
      <RangePicker range={range} onChange={setRange} />

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
