import { createFileRoute } from "@tanstack/react-router";
import { ProjectStackedChart } from "@/components/charts";
import { RangePicker, useDashboardData } from "@/components/dashboard-shell";

export const Route = createFileRoute("/$machineId/projects")({
  component: ProjectsPage,
});

function ProjectsPage() {
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
