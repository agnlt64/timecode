import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { TimecodeEvent, IngestEventsResponse } from "@shared/types";

const DB_PATH = process.env.TIMECODE_DB_PATH ?? join(homedir(), ".config", "timecode", "timecode.db");
const SCHEMA_VERSION = 1;

type StatementSync = ReturnType<DatabaseSync["prepare"]>;

interface DbState {
  db: DatabaseSync;
  insertEventStmt: StatementSync;
  upsertDailyStatsStmt: StatementSync;
  queryProjectDailyStmt: StatementSync;
  queryWeekdayStmt: StatementSync;
  queryLanguagesStmt: StatementSync;
  queryDailyTotalsStmt: StatementSync;
}

declare global {
  // eslint-disable-next-line no-var
  var __timecodeState: DbState | undefined;
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

function getState(): DbState {
  if (!global.__timecodeState) {
    const db = openDatabase();
    global.__timecodeState = {
      db,
      insertEventStmt: db.prepare(`
        INSERT INTO events (
          id, machine_id, editor, os, project_name, project_path, file_path,
          language, started_at, ended_at, duration_seconds, is_write
        ) VALUES (
          @id, @machine_id, @editor, @os, @project_name, @project_path, @file_path,
          @language, @started_at, @ended_at, @duration_seconds, @is_write
        )
        ON CONFLICT(id) DO NOTHING
      `),
      upsertDailyStatsStmt: db.prepare(`
        INSERT INTO daily_stats (
          day, project_name, language, total_seconds, active_seconds, events_count
        ) VALUES (
          @day, @project_name, @language, @duration_seconds, @duration_seconds, 1
        )
        ON CONFLICT(day, project_name, language) DO UPDATE SET
          total_seconds = total_seconds + excluded.total_seconds,
          active_seconds = active_seconds + excluded.active_seconds,
          events_count = events_count + 1,
          updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      `),
      queryProjectDailyStmt: db.prepare(`
        SELECT day, project_name AS projectName, SUM(total_seconds) AS seconds
        FROM daily_stats
        WHERE day BETWEEN ? AND ?
        GROUP BY day, project_name
        ORDER BY day ASC, seconds DESC
      `),
      queryWeekdayStmt: db.prepare(`
        SELECT CAST(strftime('%w', day) AS INTEGER) AS dayOfWeek, SUM(total_seconds) AS seconds
        FROM daily_stats
        WHERE day BETWEEN ? AND ?
        GROUP BY dayOfWeek
      `),
      queryLanguagesStmt: db.prepare(`
        SELECT language, SUM(total_seconds) AS seconds
        FROM daily_stats
        WHERE day BETWEEN ? AND ?
        GROUP BY language
        ORDER BY seconds DESC
      `),
      queryDailyTotalsStmt: db.prepare(`
        SELECT day, SUM(total_seconds) AS seconds
        FROM daily_stats
        WHERE day BETWEEN ? AND ?
        GROUP BY day
        ORDER BY day ASC
      `)
    };
  }
  return global.__timecodeState;
}

function localDayFromISO(isoUtc: string): string {
  const d = new Date(isoUtc);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ingestEvents(events: TimecodeEvent[]): IngestEventsResponse {
  const { db, insertEventStmt, upsertDailyStatsStmt } = getState();
  const result: IngestEventsResponse = { accepted: 0, duplicates: 0, rejected: 0 };

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

export function queryProjectDaily(from: string, to: string) {
  return getState().queryProjectDailyStmt.all(from, to);
}

export function queryWeekday(from: string, to: string) {
  return getState().queryWeekdayStmt.all(from, to);
}

export function queryLanguages(from: string, to: string) {
  return getState().queryLanguagesStmt.all(from, to);
}

export function queryDailyTotals(from: string, to: string) {
  return getState().queryDailyTotalsStmt.all(from, to);
}
