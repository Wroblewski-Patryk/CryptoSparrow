# V1 Assistant Runtime Load Benchmark (2026-03-23)

## Goal
Validate assistant orchestration performance for target profile:
- `3 bots x 4 market groups x 4 strategies x 5 agents`

## Command
- `pnpm --filter api run test:load:assistant-profile`

## Benchmark Contract
- Total decisions per run: `1200` (`25` cycles x `3x4x4`)
- Agent topology per decision:
  - `1 main planner`
  - `4 enabled subagents`
- Concurrency: `8`
- Gates:
  - `p95 <= 120ms`
  - `p99 <= 220ms`
  - `timeoutRate <= 1%`
  - `failures = 0`

## Result
- Status: `PASS`
- Runtime: `28.3ms`
- Throughput: `1200.00 decisions/s`
- Latency:
  - `min: 0.082ms`
  - `p50: 0.153ms`
  - `p95: 0.478ms`
  - `p99: 0.947ms`
  - `max: 1.621ms`
- Reliability:
  - `failures: 0`
  - `timeout statuses: 0 / 4800`
  - `timeoutRate: 0.00000`

## Raw Artifact
- `docs/operations/_artifacts-assistant-load-2026-03-23.json`

## Notes
- This run is a deterministic local benchmark of orchestration overhead (planner + subagent dispatch + merge path).
- Exchange I/O and external network latency are intentionally out of scope for this benchmark and are covered by separate runtime/live SLO evidence.
