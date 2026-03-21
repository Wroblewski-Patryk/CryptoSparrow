# MVP/V1 SLO Catalog

Purpose: define measurable service objectives for MVP/V1 runtime and bind each objective to currently exposed metric sources.

## Measurement Window and Reporting
- Default observation window: rolling 30 days (SLO), with weekly operator review.
- Fast operational view: last 24h and last 7d for incident response and release checks.
- Source endpoints:
  - `GET /health`
  - `GET /ready`
  - `GET /workers/health`
  - `GET /workers/ready`
  - `GET /metrics`
  - `GET /alerts`

## SLO-1: API Availability
- Objective (MVP): >= 99.5% successful health/readiness checks per 30-day window.
- Objective (V1): >= 99.9% successful health/readiness checks per 30-day window.
- SLI:
  - success = `GET /health` and `GET /ready` return `200`.
  - availability = successful probes / total probes.
- Source metrics:
  - probe logs from platform uptime checks.
  - `GET /metrics` `http.status5xx` trend as supporting signal.

## SLO-2: API Reliability (Server Error Budget)
- Objective (MVP): 5xx ratio < 1.0% of total HTTP requests per 30-day window.
- Objective (V1): 5xx ratio < 0.5% of total HTTP requests per 30-day window.
- SLI:
  - error ratio = `http.status5xx / http.requestsTotal`.
- Source metrics:
  - `GET /metrics` -> `http.requestsTotal`, `http.status5xx`.

## SLO-3: API Latency
- Objective (MVP): average API duration <= 400ms in rolling 24h.
- Objective (V1): average API duration <= 250ms in rolling 24h.
- SLI:
  - latency average = `http.avgDurationMs`.
- Source metrics:
  - `GET /metrics` -> `http.avgDurationMs`, `http.totalDurationMs`.

## SLO-4: Worker Execution Health
- Objective (MVP): worker health/readiness checks >= 99.0% success in 30-day window.
- Objective (V1): worker health/readiness checks >= 99.5% success in 30-day window.
- SLI:
  - success = `GET /workers/health` and `GET /workers/ready` return `200`.
  - readiness failure in split mode (`503`) consumes budget.
- Source metrics:
  - worker probe logs from runtime checks.
  - `GET /workers/ready` response payload (`status`, `missing`) for diagnostics.

## SLO-5: Queue Lag Safety
- Objective (MVP): queue lag for `execution` stays <= 20 for >= 99% of samples.
- Objective (V1): queue lag for `execution` stays <= 10 for >= 99% of samples.
- SLI:
  - lag samples = `worker.queueLag.execution`.
  - compliance = samples within threshold / total samples.
- Source metrics:
  - `GET /metrics` -> `worker.queueLag.execution`.
  - supporting signals: `worker.queueLag.marketData`, `worker.queueLag.backtest`.

## SLO-6: Live Order Path Stability
- Objective (MVP): order failure ratio < 2.0% of order attempts.
- Objective (V1): order failure ratio < 1.0% of order attempts.
- SLI:
  - failure ratio = `exchange.orderFailures / exchange.orderAttempts`.
  - retry pressure (non-SLO but watch): `exchange.orderRetries / exchange.orderAttempts`.
- Source metrics:
  - `GET /metrics` -> `exchange.orderAttempts`, `exchange.orderFailures`, `exchange.orderRetries`.

## Alert-to-SLO Mapping
- `exchange_live_order_failures_spike` maps to SLO-6 burn risk.
- `market_data_staleness` maps to SLO-5 and runtime reliability risk.
- `worker_heartbeat_missing` maps to SLO-4 and SLO-5 burn risk.
- Alert definitions: `docs/operations/v1-alert-rules.md`.

## Exit-Evidence Requirements
- For V1 exit criteria, collect:
  1. 7-day and 30-day SLI snapshots for each SLO.
  2. incidents/alerts that consumed error budget.
  3. operator summary (pass/fail per SLO with mitigation for failed objectives).

## Notes and Constraints
- Current API exposes aggregate counters/gauges; percentile latency SLO (p95/p99) requires additional histogram metrics and is out of current MVP instrumentation scope.
- Until external monitoring backend is introduced, `GET /metrics` snapshots and scheduled exports are the canonical local evidence source.
