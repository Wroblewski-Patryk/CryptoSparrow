# V1 Incident Drill Log

Date: 2026-03-16

## Drill 1: Exchange Order Failure Spike
- Trigger: simulated repeated `exchange.live_order.failed` events.
- Expected behavior:
  1. `/alerts` reports `exchange_live_order_failures_spike`.
  2. On-call acknowledges incident and pauses live path if needed.
- Outcome: alert path verified at API level; runbook action sequence confirmed.
- Follow-up:
  - Add external alert delivery integration (chat/pager).

## Drill 2: Stale Market Data + Queue Pressure
- Trigger: stale `WORKER_LAST_MARKET_DATA_AT` and elevated market-data queue lag.
- Expected behavior:
  1. `/alerts` reports `market_data_staleness` and `market_data_queue_lag_high`.
  2. Operator restarts ingestion worker and confirms recovery.
- Outcome: detection conditions verified and linked to recovery steps in runbook.
- Follow-up:
  - Automate freshness timestamp updates from ingestion runtime.

## Drill 3: Missing Worker Heartbeat
- Trigger: stale `WORKER_LAST_HEARTBEAT_AT`.
- Expected behavior:
  1. `/alerts` reports `worker_heartbeat_missing` as `SEV-1`.
  2. Incident commander initiates worker restart and rollback decision gate.
- Outcome: SEV classification and response ownership are clear.
- Follow-up:
  - Add worker liveness source independent from process env state.
