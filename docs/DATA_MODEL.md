# Timecode V1 Data Model

## 1. Storage Path

- Default DB path: `~/.config/timecode/timecode.db`
- Parent directory created on first run.

## 2. SQLite Pragmas

Set at startup:
- `PRAGMA journal_mode = WAL;`
- `PRAGMA synchronous = NORMAL;`
- `PRAGMA foreign_keys = ON;`
- `PRAGMA temp_store = MEMORY;`

## 3. Tables

### 3.1 `events`

Raw heartbeat/activity events.

```sql
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,                -- deterministic hash for idempotency
  machine_id TEXT NOT NULL,           -- stable local machine identifier
  editor TEXT NOT NULL,               -- "vscode"
  os TEXT NOT NULL
  project_name TEXT NOT NULL,
  project_path TEXT,                  -- optional, privacy configurable
  file_path TEXT,                     -- optional, privacy configurable
  language TEXT NOT NULL,
  started_at TEXT NOT NULL,           -- ISO-8601 UTC
  ended_at TEXT NOT NULL,             -- ISO-8601 UTC
  duration_seconds INTEGER NOT NULL,  -- bounded > 0
  is_write INTEGER NOT NULL,          -- 0/1
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
```

Indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_events_started_at ON events(started_at);
CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_name);
CREATE INDEX IF NOT EXISTS idx_events_language ON events(language);
```

### 3.2 `daily_stats`

Pre-aggregated summaries for fast dashboard queries.

```sql
CREATE TABLE IF NOT EXISTS daily_stats (
  day TEXT NOT NULL,                  -- YYYY-MM-DD in local timezone boundary
  project_name TEXT NOT NULL,
  language TEXT NOT NULL,
  total_seconds INTEGER NOT NULL,
  active_seconds INTEGER NOT NULL,    -- currently same as total_seconds in v1
  events_count INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (day, project_name, language)
);
```

Indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_daily_day ON daily_stats(day);
CREATE INDEX IF NOT EXISTS idx_daily_project ON daily_stats(project_name);
CREATE INDEX IF NOT EXISTS idx_daily_language ON daily_stats(language);
```

### 3.3 `meta`

App state and schema versioning.

```sql
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

Required key:
- `schema_version = 1`

## 4. Event Constraints

- `duration_seconds` must be in `[1, heartbeat_interval + jitter_allowance]`.
- `ended_at` must be greater than `started_at`.
- Reject events more than 7 days in the future.
- Accept late events up to 30 days old for delayed writes.

## 5. Aggregate Update Rule

On each inserted event:
1. Resolve local day bucket from `started_at` in user timezone.
2. Upsert `(day, project_name, language)` row.
3. Increment seconds and count.

## 6. Retention

V1 default: keep all data.
Optional future setting:
- compact raw events older than N months into daily-only data.
