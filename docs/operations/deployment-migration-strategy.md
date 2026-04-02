# Deployment Migration Strategy (Pipeline + Ownership)

Date: 2026-04-03  
Scope: Database migration policy for `DEV -> STAGE -> PROD` rollout.

## Goal
Make DB migrations safe, deterministic, and auditable during automated deployment promotion.

## Ownership Model
- **Developer (author)**:
  - prepares migration in PR,
  - documents backward-compatibility impact,
  - marks risk level (`low`/`medium`/`high`) in release notes.
- **CI pipeline**:
  - runs migration checks on STAGE,
  - blocks promotion when migration gate fails.
- **Release owner / on-call**:
  - approves high-risk migration windows,
  - handles incident path and rollback coordination.

## Migration Policy (Non-Negotiable)
1. Production migration is allowed only after STAGE migration success for the same SHA.
2. Migration step is part of required stage/prod gate pack.
3. Failing migration blocks promotion (fail-closed).
4. No destructive schema change in same release without compatibility window:
   - first deploy: expand/compat mode,
   - second deploy: cleanup/drop only after app code no longer depends on old schema.

## Pipeline Sequence

### 1) STAGE validation
Run for candidate SHA:
1. `pnpm --filter api exec prisma migrate status`
2. `pnpm --filter api exec prisma migrate deploy`
3. post-migration health/readiness checks

Expected result:
- migration command exits `0`,
- no pending drift that would invalidate promotion,
- app boots with migrated schema.

### 2) Promotion eligibility
Promotion to PROD is allowed only if STAGE migration gate is green and linked to the same SHA evidence.

### 3) PROD rollout
For promoted SHA:
1. backup checkpoint (or verified recent backup artifact),
2. `pnpm --filter api exec prisma migrate deploy`,
3. API/web/workers post-deploy gates.

If migration or health fails, trigger rollback playbook and mark candidate blocked.

## Backward-Compatible Release Pattern
Recommended two-phase schema evolution:
1. **Expand**:
   - add nullable columns/tables/indexes,
   - keep old fields operational.
2. **Switch**:
   - deploy application logic using new schema.
3. **Contract** (later release):
   - remove old columns/constraints only after runtime evidence confirms no usage.

## Incident Handling
If migration fails:
1. stop promotion immediately,
2. keep previous stable version in service,
3. capture incident evidence:
   - migration name,
   - failing SQL/error,
   - SHA and environment,
   - operator actions.
4. require fresh fix SHA and green STAGE migration gate before next promotion attempt.

## Evidence Contract
Each rollout writes migration evidence with:
- SHA,
- environment (`stage` or `prod`),
- applied migration list,
- command exit status,
- timestamp,
- operator/automation identity.

Evidence must be attached to release checklist before sign-off.
