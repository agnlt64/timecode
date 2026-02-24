import { ProjectStackedChart } from "~/components/charts";
import { RangePicker, useDashboardData } from "~/components/dashboard-shell";

export default function ProjectsRoute() {
  const { range, setRange, stats, loading, error } = useDashboardData();

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <h2 className="text-2xl font-semibold">Projects</h2>
        <div className="mt-4">
          <RangePicker range={range} onChange={setRange} />
        </div>
      </header>
      {loading ? <p className="text-slate-400">Loading...</p> : null}
      {error ? <p className="text-red-300">{error}</p> : null}
      {stats ? <ProjectStackedChart items={stats.projectDaily} /> : null}
    </div>
  );
}
