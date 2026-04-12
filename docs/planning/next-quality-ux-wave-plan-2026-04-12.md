# Next Quality & UX Wave (2026-04-12)

Goal: continue architecture + reliability improvements after `QH-01..QH-08` with focus on user-facing consistency and lower error surface.

## Scope
1. Profile timezone preference as account-level setting (API-validated + persisted).
2. Wallet create/edit UX flow redesign (LIVE/PAPER mode clarity + deterministic conditional fields).
3. Exchange-driven wallet metadata options (`marketType`, `baseCurrency`) instead of fragile manual assumptions.
4. Shared form-core normalization/error helpers reused by wallets/markets/backtests.
5. Runtime-safe async helpers for profile/wallet critical save flows.

## Execution Order
1. `NX-01` profile timezone persistence (done).
2. `NX-02` wallet form mode UX refactor.
3. `NX-03` wallet metadata sourcing from exchange capabilities.
4. `NX-04` shared forms-core normalization/error layer.
5. `NX-05` async-state/retry hardening.

## Done Criteria
1. No regression in `profile basic` contract (`GET/PATCH /dashboard/profile/basic`).
2. Wallet form toggles show only mode-relevant fields (no stale PAPER/LIVE leakage).
3. `marketType/baseCurrency` options resolved from exchange capability source in wallet flows.
4. Reduced ad-hoc form normalization duplication in target modules.
5. Validation: lint/typecheck targeted tests + guardrails remain PASS.
