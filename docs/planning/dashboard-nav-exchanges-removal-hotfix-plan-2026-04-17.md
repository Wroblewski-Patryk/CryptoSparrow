# Dashboard Nav Exchanges Removal Hotfix Plan (2026-04-17)

Status: ready-for-implementation  
Execution mode: tiny-commit (single-task commit)

## Problem
- `Exchanges` link reappeared in main dashboard navigation.
- This is unwanted product behavior (link should not be in top-level menu).
- Regression source identified:
  - commit `1b91763` (`feat(web-nav): restore Exchanges->Wallets->Markets order (WLT-19)`).

## Goal
- Remove `Exchanges` from top-level dashboard navigation (desktop + mobile menu).
- Keep remaining nav links intact, especially wallet/markets flow.

## Scope
1. Dashboard header navigation config:
   - `apps/web/src/ui/layout/dashboard/Header.tsx`
2. Header navigation regression test:
   - `apps/web/src/ui/layout/dashboard/Header.responsive.test.tsx`

## Out of Scope
- Removing exchanges routes/pages from app.
- Changing API-key management module behavior.
- Broader IA redesign.

## Tiny Commit Task

### NAVHF-01
`fix(web-nav): remove top-level Exchanges link from dashboard menu regression`
- Required changes:
  - remove top-level `Exchanges` nav item in header menu model.
  - keep deterministic ordering of remaining items after removal.
  - update responsive header test assertions accordingly.
- Done when:
  - `Exchanges` is not visible in main nav (desktop/mobile).
  - wallet/markets entries still render and route correctly.
  - regression test suite for header passes.

## Validation
- `pnpm --filter web test -- src/ui/layout/dashboard/Header.responsive.test.tsx`
- `pnpm --filter web run typecheck`

## Acceptance Criteria
1. Main dashboard nav no longer shows `Exchanges`.
2. No navigation regression for `Wallets` and `Markets`.
3. Test coverage reflects new canonical menu contract.
