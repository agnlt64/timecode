# Timecode — VS Code Extension

The Timecode extension automatically tracks your coding activity in VS Code and sends it to your local Timecode dashboard.

## What it does

- Detects when you are actively coding and records time segments with project name, language, and timestamps
- Stops counting when VS Code loses focus or you have been idle for too long
- Batches events and sends them to the dashboard API in the background
- Shows today's total coding time in the status bar

## Requirements

The [Timecode dashboard](https://github.com/agnlt64/timecode/tree/main/dashboard) must be running locally. By default the extension connects to `http://127.0.0.1:3000`.

## Status bar

The status bar item shows your total coding time for today and the current tracking state:

- `Timecode: Spent 2h 15m coding` — actively tracking
- `Timecode: Spent 2h 15m coding (Idle)` — no recent activity
- `Timecode: Spent 2h 15m coding (API Error)` — cannot reach the dashboard

Click the status bar item to see more details including queued events and the last API error.

## Commands

| Command | Description |
|---------|-------------|
| `Timecode: Open Dashboard` | Opens the dashboard URL in your browser |
| `Timecode: Show Tracking Status` | Shows current state, today's total, and queue info |
| `Timecode: Flush Event Queue` | Immediately sends all pending events to the API |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `timecode.enabled` | `true` | Enable or disable activity tracking |
| `timecode.dashboardUrl` | `http://127.0.0.1:3000` | URL of your local Timecode dashboard |
| `timecode.heartbeatSeconds` | `30` | How often (in seconds) to record a time segment while active |
| `timecode.idleThresholdSeconds` | `120` | Seconds of inactivity before tracking pauses |
| `timecode.includeFilePaths` | `false` | Include absolute file paths in event payloads |
| `timecode.includeProjectPaths` | `false` | Include project root paths in event payloads |

## Privacy

By default, only the project name and language are recorded — no file contents, no file paths, no project paths. Enable `timecode.includeFilePaths` or `timecode.includeProjectPaths` to opt in to storing those.
