# Timecode V1 Architecture

## 1. Stack Decision

V1 stack:
- VS Code extension: TypeScript
- Local backend/API: Node.js + TypeScript
- Storage: SQLite
- Dashboard: local web UI served by Node.js API server
- Charting: lightweight JS chart library
- API client: `axios`
- Image export: server-side PNG generation in Node.js (for example `satori` + `resvg-js` or `@napi-rs/canvas`)

Reasoning:
- Single language across extension + backend + frontend improves velocity.
- SQLite provides reliable local persistence and fast aggregation.
- Node.js + npm aligns with official VS Code extension guidance and keeps tooling predictable.

## 2. High-Level Components

1. VS Code extension
   - Collects activity heartbeats.
   - Sends batched events to local API.
2. Local API server
   - Validates and persists events.
   - Exposes stats query endpoints.
   - Generates export images.
3. SQLite database
   - Raw activity events
   - Daily aggregates
4. Web dashboard
   - Query-based charts and tables
   - Custom date range picker
   - Export action

## 3. Runtime Topology (Single Machine)

- Extension runs inside VS Code process.
- Node.js server runs as local process (default `127.0.0.1:4821`).
- DB file at `~/.config/timecode/timecode.db`.
- Dashboard served from local server at `http://127.0.0.1:4821`.

## 4. Data Flow

1. User edits code in VS Code.
2. Extension emits heartbeat events every `N` seconds when active.
3. Extension POSTs events to `/api/v1/events`.
4. Server writes raw events and updates daily aggregates.
5. Dashboard calls stats endpoints for selected period.
6. Export route renders and returns PNG.

## 5. Reliability Strategy

- Idempotent event writes using deterministic event hash.
- SQLite transactions for batch inserts.
- WAL mode for safer concurrent reads/writes.
- Local retry queue in extension if server unavailable.

## 6. Privacy Model

- Local-only transport (`localhost`).
- No outbound network calls in V1.
- Store only needed metadata:
  - project name
  - normalized file path (configurable)
  - language
  - timestamps and durations

## 7. Future-Proofing for V2

- Keep `machine_id` column even in single-machine mode.
- Keep event IDs globally unique.
- Avoid assumptions that all data comes from one editor forever.
