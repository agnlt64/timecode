# Setup and Runbook (V1)

## 1. Project Layout (Simplified)

```text
timecode/
  server/           # local API + dashboard
  shared/           # shared types and contracts
  extension/        # VS Code extension (to be added/expanded)
  docs/
```

## 2. Prerequisites

- Node.js LTS
- npm
- VS Code
- SQLite (CLI optional for debugging)

## 3. Environment Variables

Server:
- `TIMECODE_DB_PATH` default `~/.config/timecode/timecode.db`
- `TIMECODE_PORT` default `4821`
- `TIMECODE_HOST` default `127.0.0.1`

## 4. Local Dev Workflow

1. Install dependencies with `npm install`.
2. Start API/dashboard server.
3. Launch VS Code extension in Extension Development Host.
4. Open dashboard in browser.
5. Edit files in dev host and verify metrics update.

## 5. Production-Like Local Run

- Run server as background process (launch agent/system service optional).
- Extension points to localhost API.

## 6. Observability (Local)

- Server logs:
  - requests
  - ingest counts
  - errors with request id
- Extension logs:
  - queue length
  - last successful send
  - connectivity failures

## 7. Backup

- Backup DB file periodically:
  - `~/.config/timecode/timecode.db`
- Restore by replacing DB file while server is stopped.
