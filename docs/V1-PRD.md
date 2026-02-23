# Timecode V1 Product Requirements

## 1. Objective

Build a local-first coding activity tracker similar in spirit to WakaTime, with zero infrastructure cost for the user.

## 2. Goals

- Track coding activity on a single machine in VS Code.
- Show useful coding stats in a local web dashboard.
- Export a shareable image for a custom date range.
- Keep the stack open-source, self-hostable, and offline-friendly.

## 3. Non-Goals (V1)

- Multi-device sync
- Team features
- Cloud hosting
- Billing or auth
- IDEs other than VS Code

## 4. Primary User

Solo developer using VS Code on one computer who wants private time tracking and visual summaries.

## 5. Functional Requirements

1. Capture coding activity events from VS Code.
2. Persist events locally in SQLite.
3. Aggregate stats by time period, language, and project.
4. Display dashboard views for:
   - Today
   - Last 7 days
   - Last 30 days
   - Custom range
5. Export a PNG image of selected stats for a custom period.
6. Support local timezone for all displayed time values.

## 6. Quality Requirements

- Local-only by default
- Fast dashboard load for typical single-user datasets
- Crash-safe writes
- Minimal CPU usage while tracking
- Privacy-first defaults

## 7. Success Criteria

- Installation to first tracked event in less than 10 minutes.
- Dashboard loads in less than 1 second for 6 months of typical usage.
- Export image generated in less than 2 seconds for common ranges.
- No data loss on normal shutdown/restart cycles.

## 8. Risks

- Overcounting due to idle time
- Event duplication on extension restart
- Schema rigidity if sync is introduced later

## 9. Out of Scope Deferred Decisions

- Cross-editor support
- Remote/mobile dashboard
- Account model and encrypted sync
