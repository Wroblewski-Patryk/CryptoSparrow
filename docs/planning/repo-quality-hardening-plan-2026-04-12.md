# Repo Quality Hardening Plan (2026-04-12)

Goal: improve reliability, maintainability, and guardrails compliance across `apps/api` and `apps/web`.

## Scope
1. Split oversized files violating guardrails.
2. Unify symbol/baseCurrency normalization in critical flows.
3. Remove production `as any` typing escapes.
4. Replace scattered `console.log` usage with shared structured logger.
5. Harden theme bootstrap script maintainability and edge-case behavior.

Additional execution lanes (derived from the same scope):
6. Complete web `BacktestRunDetails` modularization.
7. Complete API normalization migration in bots/backtests runtime paths.
8. Close Prisma typing in profile/basic flow and remove casts.

## Execution Order
1. QH-01: remove `as any` in profile basic service.
2. QH-02: introduce shared logger and migrate top API entrypoints.
3. QH-03: harden web theme bootstrap contract.
4. QH-04: normalize API symbol/baseCurrency hotspots.
5. QH-05: split web `BacktestRunDetails`.
6. QH-06: split oversized API bots e2e suite.
7. QH-07: remove remaining web normalization local variants.
8. QH-08: final guardrails/lint/typecheck/test evidence pass.

## Done Criteria
1. `pnpm run lint` passes without warnings.
2. `pnpm run typecheck` passes in both apps.
3. `pnpm run quality:guardrails` passes.
4. No `as any` in production paths touched by this plan.
5. No local ad-hoc normalization variants in target modules.

