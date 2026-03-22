# Repo Migration Plan (`apps/web|server` -> `apps/web|api`)

## Goal
Prepare a non-breaking staged migration from:
- `apps/web` -> `apps/web`
- `apps/api` -> `apps/api`

and keep `apps/mobile` as bootstrap-only until web+api reach stability target.

## Constraints
- No destructive rename in one step.
- CI and local scripts must keep working during transition.
- Docs must reflect both current and target naming while migration is in progress.
- Mobile stays scaffolded only (no runtime parity claim before delivery gates).

## Staged Rollout
1. **Stage A: Alias Readiness (no folder rename yet)**
   - Add naming aliases in docs and planning.
   - Keep all existing commands valid (`backend/dev`, `frontend/dev`).
   - Ensure no hardcoded path assumptions block future rename.

2. **Stage B: Script and CI Dual Naming**
   - Introduce dual script aliases for future names (`web/*`, `api/*`) while preserving current scripts.
   - Update CI filters to tolerate both old/new app names.

3. **Stage C: Folder Rename**
   - Rename folders in one dedicated change:
     - `apps/web` -> `apps/web`
     - `apps/api` -> `apps/api`
   - Immediately patch imports/docs/scripts/CI paths.
   - Run focused smoke suite for auth/dashboard/runtime critical path.

4. **Stage D: Deprecation Cleanup**
   - Remove temporary compatibility aliases after at least one stabilization cycle.
   - Keep migration note in docs/changelog for historical traceability.

## Definition of Done
- Root scripts, CI, and docs point to target naming.
- No broken relative links/path references.
- `mvp-next-commits` and execution plans no longer track rename as pending.


