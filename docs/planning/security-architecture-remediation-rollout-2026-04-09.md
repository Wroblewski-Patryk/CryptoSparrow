# Security + Architecture Remediation Rollout Plan (2026-04-09)

Source audit: `security_best_practices_report.md`
Linked execution phase: `docs/planning/mvp-execution-plan.md` (`Phase 40`, `SAR-01..SAR-14`)

## Goals
- Close high/medium-risk security findings first, without behavior drift for trading-critical paths.
- Restore confidence in security regression signals (failing upload e2e must be green again).
- Improve maintainability by decomposing oversized modules and introducing clearer data boundaries.
- Roll out safely using immutable SHA promotion (`DEV -> STAGE -> PROD`) with explicit rollback criteria.

## Scope Mapping (Audit Finding -> Task)
- `F-07` -> `SAR-01` (restore upload security test cleanup order).
- `F-01` -> `SAR-02` (trusted proxy chain + forwarded-header hardening).
- `F-02` -> `SAR-03` (public origin from trusted config, not request headers).
- `F-03` -> `SAR-04` (checkout callback URL allowlist/canonical fallback).
- `F-06` -> `SAR-05`, `SAR-09` (profile-sensitive abuse throttling + stage verification).
- `F-05` -> `SAR-06` (public `/ready` information minimization).
- `F-04` -> `SAR-07` (remove production `unsafe-inline` scripts).
- `F-08` -> `SAR-10`, `SAR-11`, `SAR-12` (file-size guardrail decomposition).
- `F-09` -> `SAR-13` (repository boundaries for high-change API modules).
- All findings + rollout evidence -> `SAR-14`.

## Delivery Waves (Tiny-Commit Order)

### Wave 1 - Immediate Security Signal Recovery and Trust Boundaries
1. `SAR-01`: fix upload e2e cleanup FK order and re-enable security signal.
2. `SAR-02`: harden proxy trust and forwarded-header handling.
3. `SAR-03`: harden upload/avatar public-origin derivation.
4. `SAR-04`: enforce callback URL trust contract for checkout flows.
5. `SAR-05`: add throttling on profile-sensitive routes.

Exit criteria:
- `pnpm --filter api test -- src/modules/upload/upload.e2e.test.ts` passes.
- New/updated security contract tests pass for proxy/origin/callback paths.

### Wave 2 - Defense-in-Depth and Verification
1. `SAR-06`: reduce public `/ready` response detail.
2. `SAR-07`: ship nonce/hash CSP path and remove script `unsafe-inline`.
3. `SAR-08`: expand regression coverage for newly hardened controls.
4. `SAR-09`: execute stage abuse-throttling verification and capture evidence.

Exit criteria:
- `pnpm --filter api test -- src/router/security-headers.test.ts src/middleware/requireTrustedOrigin.test.ts src/modules/upload/upload.e2e.test.ts` passes.
- No functional regressions in profile/payment security-sensitive flows.

### Wave 3 - Architecture Risk Reduction
1. `SAR-10`: split `backtests.service.ts`.
2. `SAR-11`: split `runtimeSignalLoop.service.ts`.
3. `SAR-12`: split `BotsManagement.tsx`.
4. `SAR-13`: add API repository boundaries for high-change modules.

Exit criteria:
- `pnpm run quality:guardrails` passes file-size budgets.
- Touched module tests/typechecks pass.

## Environment Rollout Plan

### DEV (implementation and local validation)
Required for each task:
- Run targeted tests for touched area.
- Keep one logical change per commit.
- Update planning files after each completed task.

Required baseline checks before promoting wave to STAGE:
- `pnpm audit --prod`
- `pnpm run quality:guardrails`
- Wave-specific targeted API/web tests.

### STAGE (pre-prod verification on immutable SHA)
For each wave promotion:
- Deploy same SHA validated in DEV.
- Run smoke for auth, profile, uploads, subscription checkout intents.
- Verify `/health` and `/ready` behavior.
- For Wave 2: execute abuse-throttling check (`SAR-09`) and capture notes.

Promotion gate to PROD:
- No critical/high-severity regressions.
- Security suites green.
- Evidence captured in operations docs.

### PROD (controlled rollout)
- Promote exact green STAGE SHA.
- Enhanced observation window after deploy (errors, auth failures, upload path, checkout intent failures, rate-limit spikes).
- If no anomalies, continue with next wave.

## Rollback Policy
- Trigger immediate rollback to previous stable SHA on:
  - auth/session breakage,
  - upload/profile critical failures,
  - checkout callback misrouting,
  - unexpected broad request rejection from proxy/origin hardening.
- After rollback:
  - confirm `/health` and `/ready` are green,
  - re-run focused regression for failed surface,
  - create a reduced-scope hotfix task before retry.

## Evidence to Capture
- Security hardening summary per wave (what changed, what was tested, residual risk).
- Test command outputs (exact commands used).
- Stage rollout notes (smoke, abuse-throttling verification, observed metrics).
- Rollback drill result in `SAR-14` (even if no real rollback was needed).
