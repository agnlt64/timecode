import { mkdirSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  HealthResponse,
  IngestEventsRequest,
  IngestEventsResponse,
  TimecodeEvent
} from "../shared/types";

const PORT = Number(process.env.TIMECODE_PORT ?? 4821);
const HOST = process.env.TIMECODE_HOST ?? "127.0.0.1";
const DB_PATH = process.env.TIMECODE_DB_PATH ?? join(homedir(), ".config", "timecode", "timecode.db");
const VERSION = "0.1.0";
const SCHEMA_VERSION = 1;
const MAX_INGEST_EVENTS = 500;
const MAX_RANGE_DAYS = 366;

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
  res.end(JSON.stringify(data));
}

function isIsoDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function isTimecodeEvent(value: unknown): value is TimecodeEvent {
  if (!value || typeof value !== "object") return false;

  const event = value as Partial<TimecodeEvent>;

  return (
    typeof event.id === "string" &&
    typeof event.machineId === "string" &&
    typeof event.os === "string" &&
    typeof event.editor === "string" &&
    typeof event.projectName === "string" &&
    (event.projectPath === null || typeof event.projectPath === "string") &&
    (event.filePath === null || typeof event.filePath === "string") &&
    typeof event.language === "string" &&
    typeof event.startedAt === "string" &&
    isIsoDate(event.startedAt) &&
    typeof event.endedAt === "string" &&
    isIsoDate(event.endedAt) &&
    Date.parse(event.endedAt) > Date.parse(event.startedAt) &&
    typeof event.durationSeconds === "number" &&
    event.durationSeconds > 0 &&
    typeof event.isWrite === "boolean"
  );
}

function parseIngestRequest(value: unknown): IngestEventsRequest | null {
  if (!value || typeof value !== "object") return null;

  const payload = value as Partial<IngestEventsRequest>;
  if (!Array.isArray(payload.events)) return null;

  return payload.events.every(isTimecodeEvent)
    ? ({ events: payload.events } as IngestEventsRequest)
    : null;
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const rawBody = Buffer.concat(chunks).toString("utf-8");
  return JSON.parse(rawBody);
}

function localDayFromISO(isoUtc: string): string {
  const d = new Date(isoUtc);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

function resolveRange(url: URL): { from: string; to: string } | { error: string; status: number } {
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

function openDatabase(): DatabaseSync {
  mkdirSync(dirname(DB_PATH), { recursive: true });

  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA temp_store = MEMORY;");

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      machine_id TEXT NOT NULL,
      editor TEXT NOT NULL,
      os TEXT NOT NULL,
      project_name TEXT NOT NULL,
      project_path TEXT,
      file_path TEXT,
      language TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      is_write INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_events_started_at ON events(started_at);
    CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_name);
    CREATE INDEX IF NOT EXISTS idx_events_language ON events(language);

    CREATE TABLE IF NOT EXISTS daily_stats (
      day TEXT NOT NULL,
      project_name TEXT NOT NULL,
      language TEXT NOT NULL,
      total_seconds INTEGER NOT NULL,
      active_seconds INTEGER NOT NULL,
      events_count INTEGER NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      PRIMARY KEY (day, project_name, language)
    );

    CREATE INDEX IF NOT EXISTS idx_daily_day ON daily_stats(day);
    CREATE INDEX IF NOT EXISTS idx_daily_project ON daily_stats(project_name);
    CREATE INDEX IF NOT EXISTS idx_daily_language ON daily_stats(language);

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  db.prepare(`
    INSERT INTO meta (key, value)
    VALUES ('schema_version', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(String(SCHEMA_VERSION));

  return db;
}

const db = openDatabase();

const insertEventStmt = db.prepare(`
  INSERT INTO events (
    id,
    machine_id,
    editor,
    os,
    project_name,
    project_path,
    file_path,
    language,
    started_at,
    ended_at,
    duration_seconds,
    is_write
  ) VALUES (
    @id,
    @machine_id,
    @editor,
    @os,
    @project_name,
    @project_path,
    @file_path,
    @language,
    @started_at,
    @ended_at,
    @duration_seconds,
    @is_write
  )
  ON CONFLICT(id) DO NOTHING
`);

const upsertDailyStatsStmt = db.prepare(`
  INSERT INTO daily_stats (
    day,
    project_name,
    language,
    total_seconds,
    active_seconds,
    events_count
  ) VALUES (
    @day,
    @project_name,
    @language,
    @duration_seconds,
    @duration_seconds,
    1
  )
  ON CONFLICT(day, project_name, language) DO UPDATE SET
    total_seconds = total_seconds + excluded.total_seconds,
    active_seconds = active_seconds + excluded.active_seconds,
    events_count = events_count + 1,
    updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
`);

const queryProjectDailyStmt = db.prepare(`
  SELECT day, project_name AS projectName, SUM(total_seconds) AS seconds
  FROM daily_stats
  WHERE day BETWEEN ? AND ?
  GROUP BY day, project_name
  ORDER BY day ASC, seconds DESC
`);

const queryWeekdayStmt = db.prepare(`
  SELECT CAST(strftime('%w', day) AS INTEGER) AS dayOfWeek, SUM(total_seconds) AS seconds
  FROM daily_stats
  WHERE day BETWEEN ? AND ?
  GROUP BY dayOfWeek
`);

const queryLanguagesStmt = db.prepare(`
  SELECT language, SUM(total_seconds) AS seconds
  FROM daily_stats
  WHERE day BETWEEN ? AND ?
  GROUP BY language
  ORDER BY seconds DESC
`);

const queryDailyTotalsStmt = db.prepare(`
  SELECT day, SUM(total_seconds) AS seconds
  FROM daily_stats
  WHERE day BETWEEN ? AND ?
  GROUP BY day
  ORDER BY day ASC
`);

function ingestEvents(events: TimecodeEvent[]): IngestEventsResponse {
  const result: IngestEventsResponse = {
    accepted: 0,
    duplicates: 0,
    rejected: 0
  };

  db.exec("BEGIN");
  try {
    for (const event of events) {
      const insertResult = insertEventStmt.run({
        id: event.id,
        machine_id: event.machineId,
        editor: event.editor,
        os: event.os,
        project_name: event.projectName,
        project_path: event.projectPath,
        file_path: event.filePath,
        language: event.language,
        started_at: event.startedAt,
        ended_at: event.endedAt,
        duration_seconds: event.durationSeconds,
        is_write: event.isWrite ? 1 : 0
      });

      if (insertResult.changes === 0) {
        result.duplicates += 1;
        continue;
      }

      upsertDailyStatsStmt.run({
        day: localDayFromISO(event.startedAt),
        project_name: event.projectName,
        language: event.language,
        duration_seconds: event.durationSeconds
      });

      result.accepted += 1;
    }
    db.exec("COMMIT");
    return result;
  } catch {
    db.exec("ROLLBACK");
    throw new Error("Failed to ingest events");
  }
}

const server = createServer(async (req, res) => {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);

  if (method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (method === "GET" && url.pathname === "/api/v1/health") {
    const response: HealthResponse = {
      status: "ok",
      version: VERSION,
      schemaVersion: SCHEMA_VERSION
    };
    sendJson(res, 200, response);
    return;
  }

  if (method === "POST" && url.pathname === "/api/v1/events") {
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return;
    }

    const payload = parseIngestRequest(body);
    if (!payload) {
      sendJson(res, 400, { error: "Invalid /events payload" });
      return;
    }

    if (payload.events.length > MAX_INGEST_EVENTS) {
      sendJson(res, 413, { error: `Too many events. Max ${MAX_INGEST_EVENTS} per request.` });
      return;
    }

    try {
      const result = ingestEvents(payload.events);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : "Server error" });
    }
    return;
  }

  if (method === "GET" && url.pathname === "/api/v1/stats/project-daily") {
    const range = resolveRange(url);
    if ("error" in range) {
      sendJson(res, range.status, { error: range.error });
      return;
    }

    const items = queryProjectDailyStmt.all(range.from, range.to);
    sendJson(res, 200, { from: range.from, to: range.to, items });
    return;
  }

  if (method === "GET" && url.pathname === "/api/v1/stats/weekday") {
    const range = resolveRange(url);
    if ("error" in range) {
      sendJson(res, range.status, { error: range.error });
      return;
    }

    const items = queryWeekdayStmt.all(range.from, range.to);
    sendJson(res, 200, { from: range.from, to: range.to, items });
    return;
  }

  if (method === "GET" && url.pathname === "/api/v1/stats/languages") {
    const range = resolveRange(url);
    if ("error" in range) {
      sendJson(res, range.status, { error: range.error });
      return;
    }

    const items = queryLanguagesStmt.all(range.from, range.to);
    sendJson(res, 200, { from: range.from, to: range.to, items });
    return;
  }

  if (method === "GET" && url.pathname === "/api/v1/stats/daily-totals") {
    const range = resolveRange(url);
    if ("error" in range) {
      sendJson(res, range.status, { error: range.error });
      return;
    }

    const items = queryDailyTotalsStmt.all(range.from, range.to);
    sendJson(res, 200, { from: range.from, to: range.to, items });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`timecode server listening on http://${HOST}:${PORT}`);
  console.log(`timecode database path: ${DB_PATH}`);
});
