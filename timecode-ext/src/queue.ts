import type { TimecodeEvent } from "./types";

const MAX_BATCH = 100;
const FLUSH_INTERVAL_MS = 30_000;
const FLUSH_TIMEOUT_MS = 10_000;

export function localDayString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export class EventQueue {
  private pending: TimecodeEvent[] = [];
  private flushTimer: NodeJS.Timeout | undefined;
  private eventsUrl = "";
  private dailyTotalsUrl = "";
  private todaySeconds = 0;
  private todayDay = "";
  private lastError: string | null = null;

  configure(dashboardUrl: string): void {
    const base = dashboardUrl.replace(/\/$/, "");
    this.eventsUrl = `${base}/api/v1/events`;
    this.dailyTotalsUrl = `${base}/api/v1/stats/daily-totals`;
    this.stopTimer();
    this.startTimer();
    this.syncTodayFromApi().catch(() => {});
  }

  enqueue(event: TimecodeEvent): void {
    this.pending.push(event);

    // Update today's running total immediately for the status bar.
    const today = localDayString(new Date());
    if (this.todayDay !== today) {
      this.todaySeconds = 0;
      this.todayDay = today;
    }
    if (localDayString(new Date(event.startedAt)) === today) {
      this.todaySeconds += event.durationSeconds;
    }

    if (this.pending.length >= MAX_BATCH) {
      this.flush().catch(() => {});
    }
  }

  async flush(): Promise<void> {
    if (!this.eventsUrl || this.pending.length === 0) {
      return;
    }

    // Take up to MAX_BATCH events; put them back on failure.
    const batch = this.pending.splice(0, MAX_BATCH);

    try {
      const res = await fetch(this.eventsUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ events: batch }),
        signal: AbortSignal.timeout(FLUSH_TIMEOUT_MS)
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      this.lastError = null;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : "Failed to send events";
      this.pending.unshift(...batch);
    }
  }

  stop(): void {
    this.stopTimer();
  }

  getError(): string | null {
    return this.lastError;
  }

  getTodaySeconds(day: string): number {
    return this.todayDay === day ? this.todaySeconds : 0;
  }

  getPendingCount(): number {
    return this.pending.length;
  }

  private startTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(() => {});
    }, FLUSH_INTERVAL_MS);
  }

  private stopTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  private async syncTodayFromApi(): Promise<void> {
    if (!this.dailyTotalsUrl) {
      return;
    }
    const today = localDayString(new Date());
    try {
      const res = await fetch(`${this.dailyTotalsUrl}?from=${today}&to=${today}`, {
        signal: AbortSignal.timeout(5_000)
      });
      if (!res.ok) {
        return;
      }
      const data = await res.json() as { items: Array<{ day: string; seconds: number }> };
      const item = data.items.find(i => i.day === today);
      this.todayDay = today;
      this.todaySeconds = item?.seconds ?? 0;
    } catch {
      // Dashboard may not be running yet; status bar will show locally accumulated value.
    }
  }
}
