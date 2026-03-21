# V1 Load Baseline Evidence (2026-03-21)

## Run Context
- Mode: `baseline`
- Command: `pnpm --filter server test:load:baseline`
- Target URL: `http://localhost:3001`
- Duration: `30000ms`
- Concurrency: `20`
- Paths (default): `/health`, `/ready`, `/metrics`, `/workers/health`

## Thresholds
- Max error rate: `<= 0.02` (2%)
- Expected: no timeout spikes and stable latency under baseline load

## Results
- Total requests: `40382`
- Successes: `40382`
- Failures: `0`
- Timeout failures: `0`
- Throughput: `1345.57 req/s`
- Error rate: `0.0000`
- Latency:
  - min: `5ms`
  - p50: `11ms`
  - p95: `37ms`
  - p99: `72ms`
  - max: `221ms`

## Pass/Fail
- Error budget gate: `PASS` (`0 <= 0.02`)
- Baseline latency gate: `PASS` (p95/p99 stable for current baseline profile)

## Raw Artifact
- `docs/operations/_artifacts-load-baseline-2026-03-21.txt`
