# V1 Multi-Entity Assistant Runtime Evidence Pack (2026-03-23)

Purpose: close V1 gate for multi-entity assistant runtime (`user -> bot -> market-group -> strategy` with assistant topology `1 + up to 4`) and provide one verification index.

## Scope Closed in This Pack
- Multi-bot / multi-market-group runtime domain
- Assistant configuration domain (`main + 4 slots`)
- Deterministic orchestration and policy safety
- Explainability and operator readiness
- Performance and parity evidence for assistant path

## Exit Criteria Checklist (Assistant Runtime)
- [x] Canonical runtime model and merge contract documented
  - `docs/planning/open-decisions.md`
  - `docs/architecture/runtime-signal-merge-contract.md`
- [x] Data model supports bot->group->strategy graph and assistant topology
  - `BotMarketGroup`, `MarketGroupStrategyLink`
  - `BotAssistantConfig`, `BotSubagentConfig`
- [x] Ownership-safe API contracts for graph + assistant config
  - runtime graph endpoint
  - assistant config CRUD + slot validation
- [x] Runtime executes deterministic assistant flow with fail-closed behavior
  - planner -> subagent fan-out -> merge
  - timeout handling, partial failure tolerance, sanitized traces
- [x] Operational safety active
  - assistant circuit breaker with strategy-only degradation
  - mandate/forbidden-action policy gate before approval
- [x] Explainability in dashboard
  - assistant dry-run timeline (final decision + per-slot status/latency)
- [x] Cross-mode parity validated
  - `apps/api/src/modules/engine/assistantOrchestrator.parity.test.ts`
- [x] Performance benchmarked against target profile (`3x4x4x5`) with thresholds
  - `docs/operations/v1-assistant-load-profile-2026-03-23.md`
  - `docs/operations/_artifacts-assistant-load-2026-03-23.json`
- [x] Assistant incident runbook published
  - `docs/operations/v1-assistant-incident-runbook.md`

## Verification Commands (Latest Local Run)
1. `pnpm --filter api test -- src/modules/engine/assistantOrchestrator.parity.test.ts`
2. `pnpm --filter api run test:load:assistant-profile`

## Result
- Status: `PASS` for assistant-runtime-specific V1 gate.
- Decision: assistant runtime track is ready for release-candidate integration under existing global V1 external gates (production observation/sign-offs).

## Remaining Non-Assistant Global Gates
- Production SLO observation window
- Target environment backup/restore evidence
- Formal release sign-offs

These global gates remain tracked in:
- `docs/operations/v1-release-candidate-checklist.md`
- `docs/operations/v1-rc-external-gates-runbook.md`
