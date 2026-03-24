# V1 Local Cutover Checklist (Legacy Bot -> New Runtime)

Purpose: execute a controlled local migration from legacy bot runtime to CryptoSparrow runtime with minimal risk.

One-command dry-run helper (with artifact output):
- `pnpm run ops:cutover:dry-run`
- Optional flags: `--skip-infra`, `--skip-client`

## Pre-Cutover
1. Confirm Docker services are healthy:
   - `pnpm go-live:infra:up`
2. Confirm app baseline:
   - `pnpm --filter api build`
   - `pnpm --filter web build`
3. Confirm critical smoke checks:
   - `pnpm test:go-live:server`
   - `pnpm test:go-live:client`
4. Export/record legacy runtime settings snapshot:
   - strategy list
   - symbol filters
   - position/risk limits
   - live mode and consent state

## Cutover Steps
1. Freeze legacy bot writes (do not open new positions from legacy runtime).
2. Verify no in-flight unmanaged actions in legacy process.
3. Start CryptoSparrow server + required worker processes.
4. Import/verify strategy + bot configuration parity.
5. Validate connectivity and readiness:
   - `GET /health`
   - `GET /ready`
   - `GET /workers/ready`
6. Enable runtime in safe order:
   - `PAPER` first,
   - then `LIVE` only after consent and risk checks.

## Post-Cutover Validation
1. Verify market stream health in dashboard.
2. Verify signal/order/position lifecycle events are logged.
3. Verify no duplicate execution from legacy runtime.
4. Verify `/metrics` and `/alerts` for first 30 minutes.
5. Record cutover timestamp and operator.

## Abort Conditions (Immediate Rollback Trigger)
- repeated order failures with no exchange-side explanation,
- stale market data beyond expected threshold,
- missing worker heartbeat,
- inconsistent position state between runtime and exchange.

## Evidence Record Template
- Cutover date/time (UTC):
- Operator:
- Legacy freeze confirmation:
- New runtime readiness checks:
- Post-cutover validation outcome:
- Rollback required: `yes/no`
- Dry-run artifact references:

