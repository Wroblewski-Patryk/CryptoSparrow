# Working Agreements

- Tiny, single-purpose changes.
- Docs and implementation stay in sync.
- Findings-first review style.
- No done state without validation evidence.
- Keep ownership and security checks explicit for sensitive areas.
- Keep repository artifacts in English.
- Keep AI/user communication in the user's language.
- Delegate via subagents only with explicit ownership and non-overlapping scope.
- Before each commit, run tests for impacted areas and record the exact command(s).
- Treat every change as cross-module by default: check callers/consumers and update all affected paths in the same task.
- Never remove potentially shared code without verifying no remaining runtime/test/doc references.
- Keep commits tiny and reversible: one logical concern per commit, no mixed refactor+feature payloads.

## Documentation Parity Policy (Mandatory)
- Treat documentation parity as release-blocking for structural changes.
- Any change in `apps/api/src/modules/*` directory inventory must include same-change update of `docs/modules/system-modules.md`.
- Any change in `apps/web/src/features/*` directory inventory must include same-change update of `docs/modules/system-modules.md`.
- Any change in route inventory under `apps/web/src/app/**/page.tsx` must include same-change update of `docs/architecture/dashboard-route-map.md`.
- Any moved/renamed canonical docs file must include same-change update of `docs/README.md`.
- Delivery queue updates must be reflected in both `docs/planning/mvp-next-commits.md` and `docs/planning/mvp-execution-plan.md` in the same task.

## Documentation Parity Sustainment (Cadence and Ownership)
- Cadence:
  - Run `pnpm run docs:parity:check -- --json --output docs/operations/_artifacts-docs-parity-<UTC_TIMESTAMP>.json` at least once per week.
  - Run the same command immediately after any route/module inventory change, before closing the task.
- Ownership:
  - The active delivery agent for the current queue task is responsible for generating parity evidence and syncing canonical docs in the same commit.
  - The release/ops owner for the wave validates that the latest parity artifact is referenced in canonical docs before deployment sign-off.
- Evidence contract:
  - Keep the latest parity artifact under `docs/operations/`.
  - Publish a short evidence note summarizing command, counts, and PASS/FAIL outcome.
  - Update `mvp-next-commits.md` and `mvp-execution-plan.md` together when parity sustainment tasks are completed.

## Runtime Optimization Flag Rollout (Mandatory)
- Runtime CPU/DB optimizations must be shipped behind explicit feature flags before broad rollout.
- Required flags for this wave:
  - `RUNTIME_TOPOLOGY_CACHE_ENABLED`
  - `RUNTIME_TELEMETRY_THROTTLE_ENABLED`
  - `WEB_RUNTIME_ADAPTIVE_POLLING_ENABLED`
  - `WEB_RUNTIME_SSE_PREFERRED_ENABLED`
- Never couple multiple optimization slices to one non-reversible release switch.
- Staged enable sequence is mandatory (per environment: stage -> prod canary -> prod full):
  1. `RUNTIME_TOPOLOGY_CACHE_ENABLED`
  2. `RUNTIME_TELEMETRY_THROTTLE_ENABLED`
  3. `WEB_RUNTIME_ADAPTIVE_POLLING_ENABLED`
  4. `WEB_RUNTIME_SSE_PREFERRED_ENABLED`
- Canary gate before each next flag:
  - minimum 15 minutes of stable runtime,
  - no critical runtime alerts,
  - no operator-reported trading decision drift.
- For runtime regressions, rollback sequence is deterministic:
  - disable affected flag first,
  - validate parity/safety behavior,
  - then patch implementation.
- Rollback matrix (operator shorthand):

| Signal | First rollback action |
| --- | --- |
| runtime decision latency spike or CPU surge in signal loop | disable `RUNTIME_TOPOLOGY_CACHE_ENABLED` |
| DB write spike from runtime sessions/stats | disable `RUNTIME_TELEMETRY_THROTTLE_ENABLED` |
| API/read pressure spike from dashboard polling cadence | disable `WEB_RUNTIME_ADAPTIVE_POLLING_ENABLED` |
| runtime widgets staleness/reconnect churn after stream rollout | disable `WEB_RUNTIME_SSE_PREFERRED_ENABLED` |

- Each optimization commit must include targeted regression tests proving behavior parity when flag is enabled.
