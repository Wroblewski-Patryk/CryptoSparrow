# Critical Maintainability Hardening Plan (2026-04-05)

## Why now
- Runtime and dashboard features are already broad; current file sizes increase regression risk and slow safe iteration.
- Repository hygiene drift (mixed lockfiles, stale deps, likely dead helpers) can cause build/deploy inconsistency.
- We need tiny, reversible commits before next feature wave (live exchange expansion).

## Scope
- In scope:
  - Modular split of largest API/Web runtime files with no behavior drift.
  - Repo hygiene cleanup (lockfile policy, unused dependency, dead helpers).
  - Lightweight quality guardrails preventing recurrence.
- Out of scope:
  - Business logic redesign.
  - UI/UX behavior changes.
  - Contract changes for API payloads.

## Guardrails
- One task = one logical commit.
- No behavior drift: keep endpoint contracts and UI snapshots stable.
- Run targeted tests after every extraction step.
- If any parity regression appears, rollback current tiny commit only.

## Workstreams

### WS1: Repo hygiene first
1. `ARCH-02` Remove `apps/api/package-lock.json`; enforce pnpm-only lockfile policy.
2. `ARCH-03` Remove unused `prima` dependency from API; run API typecheck + targeted tests.
3. `ARCH-04` Audit and remove dead helpers (`TableToolbar`, `basic.service`) only if zero imports.

### WS2: API monolith split (`bots.service.ts`)
1. `ARCH-05` Extract runtime position serialization (DCA/TTP/TSL shaping) into dedicated module.
2. `ARCH-06` Extract session stats aggregation/query logic into focused read-services.
3. Keep existing service as orchestration layer only (facade style).

### WS3: Web monolith split
1. `ARCH-07` Split `HomeLiveWidgets.tsx` into sections: signals rail, open positions table, trade history table, runtime sidebar.
2. `ARCH-08` Split `BotsManagement.tsx` into route shell + runtime blocks (filters/session switcher/tables/cards).
3. Preserve existing i18n keys and table behavior.

### WS4: Asset and guardrail hardening
1. `ARCH-09` Optimize oversized public assets (`hero-sky.png`, default avatar) without visual drift.
2. `ARCH-10` Add quality guardrail script for max-file-size budget and lockfile consistency.

## Acceptance criteria
- No API contract drift for bots runtime endpoints.
- Dashboard and bots runtime render same data and refresh behavior as before refactor.
- `pnpm` lockfile policy is consistent (no npm lockfile).
- Large-file budget check available and documented.
- Relevant typecheck/tests pass for each changed area.

## Validation matrix
- API:
  - `pnpm --filter api typecheck`
  - targeted bots/runtime tests
- Web:
  - `pnpm --filter web typecheck`
  - targeted dashboard/bots component tests
- Repo:
  - lockfile consistency check
  - file-size guardrail check

## Rollback strategy
- Revert only current tiny commit.
- Keep extracted modules additive-first, then switch imports, then remove old code in follow-up commit.
- If a split causes instability, freeze split sequence and continue hygiene-only tasks.

## Task map
- `ARCH-01` docs/contract for split boundaries and parity rules.
- `ARCH-02..ARCH-04` hygiene cleanup.
- `ARCH-05..ARCH-08` monolith decomposition.
- `ARCH-09..ARCH-10` preventive hardening.
