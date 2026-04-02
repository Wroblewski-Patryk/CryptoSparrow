# DEV -> STAGE -> PROD Promotion Contract (Immutable SHA)

Date: 2026-04-03  
Scope: CI/CD delivery contract for CryptoSparrow deployment pipeline.

## Goal
Guarantee that production receives exactly the same verified code revision that passed all STAGE gates.

Core principle: **build once, verify once, promote the same immutable commit SHA**.

## Canonical Promotion Flow
1. Developer lands changes in `develop` (or configured integration branch).
2. CI builds and deploys candidate SHA to `STAGE`.
3. STAGE gate pack executes (build/test/migrate/health/smoke/workers).
4. If and only if all required gates are green, pipeline promotes the same SHA to `PROD`.
5. PROD post-deploy gates run.
6. If PROD gates fail, automatic rollback moves services to previous stable release.

## Stage Deployment Automation Entry Point
- Workflow: `.github/workflows/deploy-stage.yml`
- Trigger: push to `develop` (and manual `workflow_dispatch`)
- Required secret: `COOLIFY_STAGE_DEPLOY_HOOK_URL`

## Immutable SHA Invariants
The following are non-negotiable:
1. `PROD` deployment input SHA must equal the SHA validated on `STAGE`.
2. No rebuild from changed source between STAGE pass and PROD rollout.
3. Promotion metadata must include:
   - candidate SHA,
   - stage gate report ID/path,
   - promotion timestamp,
   - operator/automation identity.
4. Any mismatch (`stageSha != prodCandidateSha`) hard-fails promotion.

## Stage Gate Pack (Required)
A candidate is eligible for promotion only when all required checks pass:
1. Monorepo install + build (`api`, `web`) pass.
2. Migration gate pass:
   - migration step succeeded on stage DB,
   - no blocking drift detected.
3. Critical tests pass (contract/e2e suite baseline for impacted modules).
4. API health + readiness pass.
5. Web smoke pass (UI route reachability + API connectivity baseline).
6. Worker readiness pass (`workers/health`, `workers/ready`, runtime queue sanity).

## Promotion Eligibility Rules
Candidate is promotable only when:
- all required STAGE gates are green,
- no unresolved blocking incidents are attached to candidate SHA,
- branch protection rules are satisfied for target branch,
- evidence artifact is generated and stored.

If any rule fails: promotion is blocked and `PROD` remains unchanged.

## PROD Rollout and Post-Deploy Gates
After immutable SHA promotion:
1. Deploy `api`, `web`, and `workers` in controlled sequence.
2. Execute post-deploy gates:
   - API health/readiness,
   - web availability smoke,
   - workers readiness + queue heartbeat.
3. Record rollout status and timestamps in deployment evidence log.

## Automatic Rollback Contract
Rollback is triggered when any required PROD post-deploy gate fails.

Rollback behavior:
1. Revert to previous stable deployment artifact/tag for affected services.
2. Keep failed SHA and gate failure details in incident evidence.
3. Mark candidate as `ROLLBACK_REQUIRED` and block automatic re-promotion until a new eligible SHA is validated.

## Evidence and Audit Contract
Each promotion attempt must emit machine-readable evidence (JSON/Markdown) with:
- `stageSha`,
- `prodSha`,
- gate results map,
- decision (`PROMOTED` / `BLOCKED` / `ROLLED_BACK`),
- timestamps and service scope,
- rollback reason (if any).

Evidence artifacts are mandatory for operational traceability and release audits.

## Ownership
- CI pipeline owns gate execution and promotion decisioning.
- Ops owner owns Coolify deployment wiring and runtime health policy.
- Release owner signs off blocked/rollback incidents before reopening promotion flow.

## Fail-Closed Policy
Any uncertainty in gate state, artifact state, or SHA identity results in blocked promotion.

There is no "best effort" promotion path to production.
