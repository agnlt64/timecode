# API Specification (V1)

Base URL: `http://127.0.0.1:4821/api/v1`
Content type: `application/json`

## 1. Health

### `GET /health`

Response:

```json
{
  "status": "ok",
  "version": "0.1.0",
  "schemaVersion": 1
}
```

## 2. Ingest Events

### `POST /events`

Request:

```json
{
  "events": [
    {
      "id": "sha256...",
      "machineId": "b36f...",
      "editor": "vscode",
      "os": "linux/ubuntu",
      "projectName": "timecode",
      "projectPath": null,
      "filePath": null,
      "language": "TypeScript",
      "startedAt": "2026-02-23T12:00:00.000Z",
      "endedAt": "2026-02-23T12:00:30.000Z",
      "durationSeconds": 30,
      "isWrite": true
    }
  ]
}
```

Response:

```json
{
  "accepted": 1,
  "duplicates": 0,
  "rejected": 0
}
```

Status codes:
- `200` success (partial accepted allowed)
- `400` invalid payload
- `413` too many events in one request

## 3. Summary Stats

### `GET /stats/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`

Response:

```json
{
  "from": "2026-02-01",
  "to": "2026-02-23",
  "totalSeconds": 12345,
  "activeDays": 16,
  "averageSecondsPerActiveDay": 771
}
```

## 4. Breakdown by Language

### `GET /stats/languages?from=YYYY-MM-DD&to=YYYY-MM-DD`

Response:

```json
{
  "items": [
    { "language": "TypeScript", "seconds": 7200, "percentage": 58.4 },
    { "language": "Go", "seconds": 4200, "percentage": 34.1 }
  ]
}
```

## 5. Breakdown by Project

### `GET /stats/projects?from=YYYY-MM-DD&to=YYYY-MM-DD`

Response:

```json
{
  "items": [
    { "projectName": "timecode", "seconds": 8600, "percentage": 69.7 }
  ]
}
```

## 6. Daily Timeline

### `GET /stats/timeline?from=YYYY-MM-DD&to=YYYY-MM-DD`

Response:

```json
{
  "items": [
    { "day": "2026-02-20", "seconds": 1800 },
    { "day": "2026-02-21", "seconds": 3600 }
  ]
}
```

## 7. Export Image

### `GET /export/image?from=YYYY-MM-DD&to=YYYY-MM-DD&theme=light&title=...`

Response:
- `200` with `image/png`
- `400` for invalid range

## 8. Constraints

- Max range in V1: 366 days.
- Max events per ingest call: 500.
- All dates interpreted in local timezone.
