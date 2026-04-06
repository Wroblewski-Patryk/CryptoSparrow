# Runtime Incident Triage Matrix

Purpose: provide deterministic first-response triage for runtime-critical production incidents.

## Usage Rule
1. Identify the dominant symptom.
2. Run checks in order (left to right).
3. Apply mitigation if check confirms issue.
4. Escalate to rollback when rollback criteria are met.

## Matrix
| Symptom | Primary checks | First mitigation | Rollback trigger |
| --- | --- | --- | --- |
| No new runtime signals for active bots | `/workers/runtime-freshness`, `/alerts`, latest `BotRuntimeSession.lastHeartbeatAt` | Restart `execution` worker and resubscribe stream loop | No recovery within 10 minutes or freshness remains `FAIL` |
| Heartbeat stale / worker missing | `/workers/health`, `/workers/ready`, `/alerts` (`worker_heartbeat_missing`) | Restart affected worker process and confirm heartbeat update | Worker keeps crash-looping after 2 restart attempts |
| Market data stale | `/alerts` (`market_data_staleness`), `WORKER_LAST_MARKET_DATA_AT`, stream connectivity logs | Restart market-stream / market-data workers and verify symbol subscriptions | Staleness persists > 5 minutes after restart |
| Runtime signal lag spike | `/metrics` (`runtime.signalLag.lastMs`), `/workers/runtime-freshness` | Reduce load (pause non-critical bots), verify queue lag and stream latency | Signal lag exceeds hard threshold for 3 consecutive checks |
| Repeated runtime restarts | `/metrics` (`runtime.restarts.total`), runtime worker logs | Pause live bots, investigate stall reason (`NO_EVENT`/`NO_HEARTBEAT`) | Restart count keeps increasing after containment actions |
| Reconciliation drift / orphan execution state | `/alerts` (`runtime_reconciliation_drift`), reconciliation logs, open orders/positions parity | Run startup reconciliation, cancel orphan pending orders, resync positions | Drift remains after reconciliation pass or live exposure risk is confirmed |
| Delayed exchange ACK / order path degraded | exchange adapter logs, `/metrics` exchange failures, pending orders age | Throttle new order submissions, retry with safe backoff, keep DCA/close path priority | Pending order age exceeds safety window and closure path is blocked |

## Escalation Checklist
- Assign incident commander.
- Freeze active deployment promotion.
- Capture evidence:
  - `/workers/runtime-freshness` response payload,
  - `/alerts` response payload,
  - `/metrics` snapshot,
  - worker logs for last 15 minutes.
- If rollback trigger is met, execute `docs/operations/deployment-rollback-playbook.md`.

## Linked Runbooks
- `docs/operations/v1-ops-runbook.md`
- `docs/operations/deployment-readiness-gates.md`
- `docs/operations/deployment-rollback-playbook.md`
