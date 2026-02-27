"use client";

import { ProjectStackedChart } from "@/app/components/charts";
import { RangePicker, useDashboardData } from "@/app/components/dashboard-shell";

export default function ProjectsPage() {
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
      {stats && !loading ? <ProjectStackedChart items={stats.projectDaily} /> : null}
    </div>
  );
}
