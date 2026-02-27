# Timecode — Dashboard

The Timecode dashboard is a Next.js app that receives coding activity from the VS Code extension, stores it locally, and visualizes your stats.

## What it does

- Exposes a REST API that the VS Code extension posts events to
- Stores all events in a local SQLite database at `~/.config/timecode/timecode.db`
- Displays charts for coding time by day, project, language, and weekday

## Setup

```bash
npm install
npm run db:push   # create or update the SQLite database schema
npm run dev       # start at http://localhost:3000
```

Set `TIMECODE_DB_PATH` to use a custom database location:

```bash
TIMECODE_DB_PATH=/path/to/timecode.db npm run dev
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Overview — daily coding time over a selected date range |
| `/projects` | Time broken down by project |
| `/languages` | Time broken down by programming language |
| `/weekdays` | Average activity by day of the week |

## API

The dashboard also serves the API consumed by the VS Code extension:

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/events` | Ingest a batch of coding events |
| `GET /api/v1/stats/daily-totals` | Total seconds per day |
| `GET /api/v1/stats/projects` | Seconds per project per day |
| `GET /api/v1/stats/languages` | Seconds per language |
| `GET /api/v1/stats/weekday` | Average seconds by day of week |
| `GET /api/v1/health` | Health check |

All stat endpoints accept `from` and `to` query parameters (format: `YYYY-MM-DD`).

## Database

The schema is managed with Prisma. Run `npm run db:push` after any schema change or on first install.

To target a custom database path when pushing the schema, set `TIMECODE_DB_PATH` before running the command.
