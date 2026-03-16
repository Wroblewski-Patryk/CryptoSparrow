# V1 Alert Rules Baseline

## Goal
Provide minimal actionable alerting for production trading safety and runtime health.

## Rule Group: Failed Orders
- Name: `exchange_live_order_failures_spike`
- Condition: `exchange.live_order.failed` events >= 3 in 5 minutes.
- Severity: `SEV-2`
- Action:
  1. Notify on-call channel.
  2. Verify exchange status and retry behavior.
  3. Consider temporary live-mode pause if failures continue.

## Rule Group: Stale Market Data
- Name: `market_data_staleness`
- Condition: no fresh candle ingestion for core symbols for > 2 polling intervals.
- Severity: `SEV-2`
- Action:
  1. Verify data provider connectivity.
  2. Restart affected ingestion worker/process.
  3. Keep live execution paused until data freshness recovers.

## Rule Group: Worker Health
- Name: `worker_heartbeat_missing`
- Condition: worker heartbeat missing for > 60 seconds.
- Severity: `SEV-1` (execution worker) / `SEV-2` (non-execution worker).
- Action:
  1. Attempt worker restart.
  2. Validate queue lag and in-flight jobs.
  3. Trigger rollback/incident flow if restart fails.

## Notification Policy
- Primary target: operations on-call.
- Secondary target: product/operator lead for SEV-1 and prolonged SEV-2.
- Re-notify every 15 minutes while condition persists.
