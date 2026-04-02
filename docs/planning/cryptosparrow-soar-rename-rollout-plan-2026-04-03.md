# Controlled Rename Rollout Plan: `CryptoSparrow` -> `Soar`

Date: 2026-04-03  
Task: `DPL-12 docs(rename-plan)`

## Goal
Execute global rename in a safe, staged way with explicit risk gates and rollback checkpoints, without breaking runtime behavior, auth/session continuity, or deployment stability.

## Inputs
- Rename audit: `docs/planning/cryptosparrow-soar-rename-audit-2026-04-03.md`
- Deployment contract: `docs/operations/dev-stage-prod-promotion-contract.md`
- Readiness gates: `docs/operations/deployment-readiness-gates.md`
- Rollback playbook: `docs/operations/deployment-rollback-playbook.md`

## Rename Principles (Non-Negotiable)
1. **Compatibility first** for runtime-critical identifiers.
2. **No one-shot breaking rename** across auth/storage/deployment layers.
3. Every wave must pass STAGE gates before PROD.
4. Every wave has explicit rollback checkpoint.
5. Fail-closed: if any gate/evidence is missing, stop rollout.

## Wave Plan

### Wave 0 - Preparation (already completed)
Scope:
- token inventory and risk classification.

Exit gate:
- audit published and linked in canonical planning docs.

Rollback:
- not needed (docs-only baseline).

### Wave 1 - Safe Brand Surface (UI + docs)
Scope:
- visible branding copy in web UI and public docs,
- app title/metadata/manifest labels,
- non-critical textual references in guidance docs.

Out of scope:
- JWT issuer/audience,
- localStorage keys,
- service worker cache keys,
- domains and deployment identifiers.

Risk gate:
- web build + smoke + visual sanity,
- i18n regression smoke for header/footer/nav.

Rollback checkpoint:
- revert UI/docs-only commits (no data/protocol impact).

### Wave 2 - Runtime Compatibility Bridges
Scope:
- introduce dual-read/dual-accept for legacy/new runtime identifiers:
  - storage keys (`cryptosparrow-*` -> `soar-*`),
  - auth claims transition window (issuer/audience acceptance strategy),
  - theme/cache compatibility migration policy.

Risk gate:
- auth/session regression suite,
- dashboard runtime refresh smoke,
- backward compatibility checks for existing users.

Rollback checkpoint:
- keep old keys as source-of-truth; disable new write path by feature flag or revert.

### Wave 3 - Infrastructure and Domain Migration
Scope:
- domain transition plan (`cryptosparrow.*` -> `soar.*` if approved),
- Coolify project/env naming updates,
- DB/container/script default naming updates where required.

Risk gate:
- full deployment gate pack on STAGE for new infra names,
- TLS/DNS validation,
- post-deploy smoke checklist pass.

Rollback checkpoint:
- DNS/env rollback to previous names,
- redeploy previous stable artifacts.

### Wave 4 - Legacy Cleanup
Scope:
- remove compatibility aliases and deprecated tokens after observation window.

Prerequisite:
- no active dependency on legacy tokens in logs/metrics/support incidents.

Risk gate:
- regression suite + operational smoke,
- sign-off from release owner.

Rollback checkpoint:
- restore compatibility shims and legacy aliases.

## Mandatory Risk Gates per Wave
Each wave requires:
1. STAGE deployment for candidate SHA.
2. Required gates (`G1..G6`) pass.
3. Rollback target SHA identified and validated.
4. Evidence artifact with:
   - wave id,
   - impacted surfaces,
   - gate results,
   - sign-off decision.

No wave may proceed to PROD without these conditions.

## Observation Windows
- Wave 1: short observation window (UI/docs only).
- Wave 2: extended observation (session/auth/storage continuity).
- Wave 3: extended observation (infra/domain stability).
- Wave 4: cleanup only after prior wave stability is confirmed.

Exact durations are set by release owner based on incident load and change scope.

## Ownership Matrix
- Product/Docs owner: Wave 1 narrative alignment.
- Frontend owner: Wave 1 + parts of Wave 2.
- Backend/Security owner: Wave 2 auth/storage compatibility.
- Ops owner: Wave 3 infra/domain rollout.
- Release owner: wave sign-off and go/no-go decisions.

## Deliverable Sequence (Implementation Backlog Hint)
1. execute Wave 1 (safe copy rename),
2. add Wave 2 compatibility bridges,
3. plan and execute Wave 3 infra/domain switch,
4. run Wave 4 cleanup.

Each step should be split into tiny commit tasks with separate test/evidence entries.
