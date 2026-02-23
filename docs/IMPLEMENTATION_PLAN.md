# V1 Implementation Plan

## Milestone 1: Foundations

Deliverables:
- Simplified repo scaffold (`server`, `shared`, `extension`)
- Shared type definitions for event payloads and stats responses
- SQLite initialization + migrations (schema version 1)
- Health endpoint

Exit criteria:
- Server boots and creates DB successfully.

## Milestone 2: Ingestion Pipeline

Deliverables:
- Extension heartbeat collection
- Idle detection
- Batch POST to `/api/v1/events`
- Server event validation and idempotent insert
- Aggregate upsert to `daily_stats`

Exit criteria:
- 30 minutes simulated usage produces correct totals.

## Milestone 3: Dashboard MVP

Deliverables:
- Date range selector with presets
- KPI cards
- Timeline chart
- Language/project breakdowns
- API integration for all stats endpoints

Exit criteria:
- Data visible and consistent across all dashboard panels.

## Milestone 4: PNG Export

Deliverables:
- `/api/v1/export/image` endpoint
- Render template and theming
- Dashboard export button wiring

Exit criteria:
- PNG export works for any valid custom range.

## Milestone 5: Hardening

Deliverables:
- Retry queue persistence in extension
- Basic error handling and logs
- Unit/integration test coverage for critical paths
- Manual QA checklist completion

Exit criteria:
- Stable local usage for several days without data corruption.

## Suggested Build Order

1. Schema + `/events` endpoint
2. Extension event producer
3. Stats query endpoints
4. Dashboard views
5. PNG export
6. Reliability and QA pass
