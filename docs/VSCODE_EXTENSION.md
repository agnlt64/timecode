# VS Code Extension Spec (V1)

## 1. Responsibilities

- Detect active coding sessions.
- Emit heartbeat events.
- Avoid counting idle time.
- Persist temporary queue if local server is unavailable.
- Send batched events to local API.

## 2. Extension Configuration

Suggested settings:
- `timecode.enabled` (bool, default `true`)
- `timecode.apiBaseUrl` (string, default `http://127.0.0.1:4821`)
- `timecode.heartbeatSeconds` (int, default `30`)
- `timecode.includeFilePaths` (bool, default `false`)
- `timecode.includeProjectPaths` (bool, default `false`)
- `timecode.idleThresholdSeconds` (int, default `120`)

## 3. Signals to Capture

- Active editor change
- Text document change
- File save
- Window focus gain/loss
- Keyboard activity timestamps

## 4. Heartbeat Logic

1. Start heartbeat timer when VS Code window is focused.
2. Mark user as active on editor changes or typing.
3. If no activity for `idleThresholdSeconds`, pause tracking.
4. Emit event every `heartbeatSeconds` while active.
5. When project/language changes, flush current segment and start new segment.

## 5. Event Payload

```json
{
  "id": "sha256(...)",
  "machineId": "b36f...",
  "editor": "vscode",
  "projectName": "timecode",
  "projectPath": "/Users/antonin/dev/timecode",
  "filePath": "/Users/antonin/dev/timecode/src/index.ts",
  "language": "TypeScript",
  "startedAt": "2026-02-23T12:00:00.000Z",
  "endedAt": "2026-02-23T12:00:30.000Z",
  "durationSeconds": 30,
  "isWrite": true
}
```

## 6. Offline/Retry Behavior

- Keep in-memory queue for transient failures.
- Persist queue to extension storage on shutdown.
- Retry with exponential backoff capped at 30s.
- Drop malformed events; never drop valid events silently.

## 7. Status UX

- Status bar item:
  - `Timecode: Tracking`
  - `Timecode: Idle`
  - `Timecode: Server Offline`
- Command palette:
  - `Timecode: Open Dashboard`
  - `Timecode: Show Tracking Status`
  - `Timecode: Restart Connection`

## 8. Security

- Send only to configured localhost endpoint by default.
- Validate HTTPS/localhost if user changes endpoint.
- Avoid logging sensitive file paths unless debug mode enabled.
