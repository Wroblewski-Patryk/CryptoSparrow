# Post-MVP Exchange Adapter Rollout Milestones

## Goal
Define expansion plan for adding exchange adapters beyond Binance while preserving runtime safety, contract consistency, and operational observability.

## Milestone 1: Adapter Contract Hardening (P0)
- Freeze adapter interface requirements:
  - market data fetch/stream,
  - order placement/cancel/close,
  - position/account state mapping,
  - error normalization taxonomy.
- Add compatibility matrix for required capabilities (spot/futures, hedge support, rate limits).
- Acceptance:
  - contract tests against adapter mocks,
  - no Binance behavior regressions.

## Milestone 2: Candidate Exchange Selection (P0)
- Define scoring criteria:
  - API reliability,
  - liquidity/market coverage,
  - API limits and websocket stability,
  - jurisdiction/compliance fit.
- Select first two non-Binance exchanges for staged rollout.
- Acceptance:
  - signed-off selection document,
  - risk notes and fallback decisions per candidate.

## Milestone 3: First Adapter Implementation (P1)
- Implement first additional exchange adapter behind feature flag.
- Add exchange-specific symbol/precision/order-rule normalization.
- Add safety constraints for unsupported order parameters.
- Acceptance:
  - integration suite for order lifecycle and position reconciliation,
  - paper-mode validation before any live enablement.

## Milestone 4: Observability and Guardrails (P1)
- Extend metrics/alerts dimensions with `exchange` label.
- Add per-exchange failure/retry dashboards.
- Add per-exchange kill-switch and emergency-disable controls.
- Acceptance:
  - alert drill for adapter outage scenario,
  - runbook update with exchange-specific recovery steps.

## Milestone 5: Staged Rollout (P1)
- Stage A: internal paper-only validation.
- Stage B: limited live beta with selected users.
- Stage C: general availability after stability window.
- Acceptance:
  - gate criteria per stage (error rate, latency, order failure threshold),
  - rollback checklist per exchange adapter.

## Milestone 6: Multi-Exchange UX and Entitlements (P2)
- Update dashboard exchange management UX for multi-adapter context.
- Add entitlement controls for exchange access by plan/tier.
- Ensure clear safety messaging when switching primary execution exchange.

## Sequencing Notes
- Deliver one additional exchange end-to-end before parallelizing further adapters.
- Keep each adapter isolated behind feature flags and explicit release gates.
- Reuse V1 cutover/rollback patterns for each new exchange rollout.
