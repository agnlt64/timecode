"use client";

import { LanguageDonut } from "@/app/components/charts";
import { RangePicker, useDashboardData } from "@/app/components/dashboard-shell";

export default function LanguagesPage() {
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
      {stats && !loading ? <LanguageDonut items={stats.languages} /> : null}
    </div>
  );
}
