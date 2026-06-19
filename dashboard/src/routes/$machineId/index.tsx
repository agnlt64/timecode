import { createFileRoute, useParams } from "@tanstack/react-router";
import { ActivityBars, LanguageTape, ProjectBars, WeekdayChart } from "@/components/charts";
import { LoadingSkeleton, RangePicker, useDashboardData } from "@/components/dashboard-shell";
import { formatDate, formatDuration, formatShortDate } from "@/lib/stats";

export const Route = createFileRoute("/$machineId/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { machineId } = useParams({ from: "/$machineId/" });
  const {
    range,
    setRange,
    stats,
    loading,
    error,
    totalSeconds,
    activeDays,
    totalDays,
    dailyAverage,
    bestDay,
  } = useDashboardData();

  const imageUrl = `/api/v1/image?from=${range.from}&to=${range.to}&machineId=${encodeURIComponent(machineId)}`;

  return (
    <div className="space-y-12">
      {/* ── Controls ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap fade-up">
        <RangePicker range={range} onChange={setRange} />
        <a
          href={imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-mono text-muted hover:text-text transition-colors"
        >
          export image ↗
        </a>
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="rounded-lg border border-red/20 bg-red/5 px-4 py-3 text-sm text-red">
          {error}
        </div>
      ) : stats ? (
        <>
          {/* ── Hero ── */}
          <div className="fade-up fade-up-1">
            <div className="flex items-end gap-5 flex-wrap">
              <span className="font-mono font-semibold leading-none tracking-tight text-accent"
                style={{ fontSize: "clamp(3rem, 10vw, 5rem)" }}>
                {formatDuration(totalSeconds)}
              </span>
              <div className="pb-1 space-y-1">
                <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-muted">
                  total coded
                </p>
                <p className="text-[11px] font-mono text-muted">
                  {formatDate(range.from)} – {formatDate(range.to)}
                </p>
              </div>
            </div>
          </div>

          {/* ── Stats ── */}
          <div className="grid grid-cols-3 gap-3 fade-up fade-up-2">
            <StatCard
              label="Active days"
              value={String(activeDays)}
              sub={`of ${totalDays}`}
            />
            <StatCard
              label="Daily average"
              value={formatDuration(dailyAverage)}
            />
            <StatCard
              label="Best day"
              value={bestDay ? formatDuration(bestDay.seconds) : "—"}
              sub={bestDay ? formatShortDate(bestDay.day) : undefined}
              highlight
            />
          </div>

          {/* ── Activity ── */}
          <section className="fade-up fade-up-3">
            <Label>Activity</Label>
            <ActivityBars items={stats.dailyTotals} />
          </section>

          {/* ── Projects ── */}
          <section className="fade-up fade-up-4">
            <Label>Projects</Label>
            <ProjectBars items={stats.projectDaily} />
          </section>

          {/* ── Languages + Weekday ── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 fade-up fade-up-4">
            <section>
              <Label>Languages</Label>
              <LanguageTape items={stats.languages} />
            </section>
            <section>
              <Label>Weekdays</Label>
              <WeekdayChart items={stats.weekday} />
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-muted mb-5">
      {children}
    </p>
  );
}

function StatCard({
  label,
  value,
  sub,
  highlight = false,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-4">
      <p className="text-[10px] font-mono tracking-[0.15em] uppercase text-muted">{label}</p>
      <p
        className={`mt-2 text-2xl font-mono font-medium tabular-nums ${
          highlight ? "text-accent" : "text-text"
        }`}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-[11px] font-mono text-muted">{sub}</p>
      )}
    </div>
  );
}
