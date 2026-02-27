const MAX_RANGE_DAYS = 366;

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function daysBetweenInclusive(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  return Math.floor((end - start) / 86_400_000) + 1;
}

function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function resolveRange(url: URL): { from: string; to: string } | { error: string; status: number } {
  const today = new Date();
  const defaultTo = toDateOnly(today);
  const start = new Date(today);
  start.setDate(start.getDate() - 6);
  const defaultFrom = toDateOnly(start);

  const from = url.searchParams.get("from") ?? defaultFrom;
  const to = url.searchParams.get("to") ?? defaultTo;

  if (!isDateOnly(from) || !isDateOnly(to)) {
    return { error: "Invalid date format. Use YYYY-MM-DD.", status: 400 };
  }
  if (from > to) {
    return { error: "`from` must be <= `to`.", status: 400 };
  }

  const rangeDays = daysBetweenInclusive(from, to);
  if (rangeDays > MAX_RANGE_DAYS) {
    return { error: `Date range too large. Max ${MAX_RANGE_DAYS} days.`, status: 400 };
  }

  return { from, to };
}

export function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  };
}
