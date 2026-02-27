# Timecode

Timecode is a free, open-source, self-hosted coding activity tracker. It automatically measures how much time you spend coding in VS Code and shows your stats in a local web dashboard — no accounts, no cloud, no data leaving your machine.

## How it works

1. The **VS Code extension** runs in the background and tracks which project and language you are working on. It batches activity into time segments and periodically sends them to the local dashboard API.
2. The **dashboard** is a Next.js app that receives events from the extension, stores them in a local SQLite database, and displays charts for your coding history.

## Components

| Directory | Description |
|-----------|-------------|
| `timecode-ext/` | VS Code extension |
| `dashboard/` | Next.js dashboard and API |
| `shared/` | Shared TypeScript types |

## Getting started

### 1. Start the dashboard

```bash
cd dashboard
npm install
npm run db:push   # creates / migrates the SQLite database
npm run dev       # starts at http://localhost:3000
```

### 2. Install the extension

Open `timecode-ext/` in VS Code and press **F5** to launch a development instance, or package it with `vsce package` and install the `.vsix` file.

The extension connects to `http://127.0.0.1:3000` by default (configurable via `timecode.dashboardUrl`).

## Dashboard

Open [http://localhost:3000](http://localhost:3000) to see:

- **Overview** — daily coding time over a date range
- **Projects** — time broken down by project
- **Languages** — time broken down by programming language
- **Weekdays** — average activity by day of the week

## Data

All data is stored in `~/.config/timecode/timecode.db` (SQLite). You can change the path by setting the `TIMECODE_DB_PATH` environment variable before starting the dashboard.
