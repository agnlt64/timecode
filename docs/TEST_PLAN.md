# Test Plan (V1)

## 1. Scope

Validate ingestion accuracy, aggregation correctness, dashboard behavior, and export stability.

## 2. Unit Tests

Server:
- Event validation rules
- Idempotent insert behavior
- Daily aggregate upsert logic
- Date range parsing and timezone handling

Extension:
- Heartbeat segmentation logic
- Idle detection transitions
- Retry queue behavior

Frontend:
- Date range state and URL sync
- Formatters (duration, percentages)

## 3. Integration Tests

- POST events then query all stats endpoints.
- Verify duplicates do not inflate totals.
- Verify custom ranges include correct day boundaries.
- Verify export endpoint returns valid PNG bytes.

## 4. End-to-End Tests

- Simulate typing activity in VS Code dev host.
- Confirm dashboard updates within expected delay.
- Confirm export image content for known fixture data.

## 5. Manual Test Checklist

1. Start server with empty DB.
2. Track 5-10 minutes of coding in 2 languages.
3. Check Today and 7D views.
4. Restart extension and verify no duplicate spikes.
5. Disconnect server, create queued events, reconnect, verify recovery.
6. Export PNG for custom range and inspect readability.

## 6. Performance Checks

- Ingest 100k events fixture.
- Ensure summary queries remain under 200ms on local machine.
- Ensure export remains under 2s for 30-day range.

## 7. Regression Gates (Pre-release)

- All unit/integration tests pass.
- No critical manual checklist failures.
- Schema migration test from fresh DB passes.
