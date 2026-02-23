# Setup and Runbook (V1)

## 1. Monorepo Layout (Recommended)

```text
timecode/
  apps/
    extension/      # VS Code extension (TypeScript)
    server/         # Bun API + dashboard
  packages/
    shared/         # shared types and utils
  docs/
```

## 2. Prerequisites

- Node.js LTS
- Bun (latest stable)
- VS Code
- SQLite (CLI optional for debugging)

## 3. Environment Variables

Server:
- `TIMECODE_DB_PATH` default `~/.config/timecode/timecode.db`
- `TIMECODE_PORT` default `4821`
- `TIMECODE_HOST` default `127.0.0.1`

## 4. Local Dev Workflow

1. Start API/dashboard server.
2. Launch VS Code extension in Extension Development Host.
3. Open dashboard in browser.
4. Edit files in dev host and verify metrics update.

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
