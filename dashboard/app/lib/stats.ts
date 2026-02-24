export type DateRange = { from: string; to: string };

export type ProjectDailyItem = { day: string; projectName: string; seconds: number };
export type WeekdayItem = { dayOfWeek: number; seconds: number };
export type LanguageItem = { language: string; seconds: number };
export type DailyTotalItem = { day: string; seconds: number };

export interface DashboardStats {
  range: DateRange;
  projectDaily: ProjectDailyItem[];
  weekday: WeekdayItem[];
  languages: LanguageItem[];
  dailyTotals: DailyTotalItem[];
}

function toDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function defaultWeekRange(): DateRange {
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(toDate.getDate() - 6);
  return { from: toDateOnly(fromDate), to: toDateOnly(toDate) };
}

export function last14DaysRange(): DateRange {
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(toDate.getDate() - 13);
  return { from: toDateOnly(fromDate), to: toDateOnly(toDate) };
}

export function last30DaysRange(): DateRange {
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(toDate.getDate() - 29);
  return { from: toDateOnly(fromDate), to: toDateOnly(toDate) };
}

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4821";
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`);
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}) for ${path}`);
  }
  return (await res.json()) as T;
}

export async function fetchDashboardStats(range: DateRange): Promise<DashboardStats> {
  const query = `from=${range.from}&to=${range.to}`;

  const [projectDaily, weekday, languages, dailyTotals] = await Promise.all([
    fetchJson<{ items: ProjectDailyItem[] }>(`/api/v1/stats/project-daily?${query}`),
    fetchJson<{ items: WeekdayItem[] }>(`/api/v1/stats/weekday?${query}`),
    fetchJson<{ items: LanguageItem[] }>(`/api/v1/stats/languages?${query}`),
    fetchJson<{ items: DailyTotalItem[] }>(`/api/v1/stats/daily-totals?${query}`)
  ]);

  return {
    range,
    projectDaily: projectDaily.items,
    weekday: weekday.items,
    languages: languages.items,
    dailyTotals: dailyTotals.items
  };
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  if (m > 0) {
    return `${m}m`;
  }
  return "0m";
}

export function rangeLabel(range: DateRange): string {
  return `${range.from} → ${range.to}`;
}

export function bestDay(dailyTotals: DailyTotalItem[]): DailyTotalItem | null {
  if (dailyTotals.length === 0) return null;
  return dailyTotals.reduce((best, item) => (item.seconds > best.seconds ? item : best), dailyTotals[0]);
}
