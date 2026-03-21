# Post-MVP Admin Panel Milestones

## Goal
Define implementation milestones for owner/admin control panel after MVP/V1 evidence gates.

## Milestone 1: Plan and Entitlement Controls (P0)
- Pricing plan CRUD (free/simple/advanced baseline + custom plans).
- Entitlement editor:
  - bot limits by mode (`PAPER`, `LIVE`)
  - backtest concurrency limits
  - interval/cadence option enablement
- Validation and audit logging for every plan/entitlement change.
- Acceptance:
  - deterministic API contract tests,
  - admin UI confirmation flow and rollback-safe change history.

## Milestone 2: Manual Grants and Overrides (P0)
- Manual subscription grant create/update/end flow.
- Start modes: `now` and scheduled `start_at`.
- Automatic return-to-previous-plan behavior.
- Mandatory reason capture and category selection for early grant end.
- Acceptance:
  - policy/ownership tests for all grant transitions,
  - audit-log traceability for each override action.

## Milestone 3: Security/Lock Overrides (P1)
- Admin unlock controls for account/IP lock events.
- Guardrails:
  - role-based authorization,
  - reason required,
  - immutable audit trail.
- Acceptance:
  - negative tests for unauthorized override attempts,
  - end-to-end admin incident workflow walkthrough.

## Milestone 4: Operational Visibility (P1)
- Admin dashboard cards for:
  - active plans and grant counts,
  - lock events and override actions,
  - paid-runtime disabled user counts (`PAST_DUE` impact).
- Export endpoints for audit/compliance snapshots.
- Acceptance:
  - performance checks on representative datasets,
  - localization and accessibility baseline for admin views.

## Milestone 5: Hardening and Rollout (P1)
- Staging rollout with migration + fallback checklist.
- Runbook for admin misconfiguration recovery.
- Production launch guard:
  - release checklist item for admin panel change freeze during launch windows.

## Sequencing Notes
- Execute Milestones 1-2 before expanding billing rails.
- Reuse V1 evidence/ops patterns (checklists, sign-offs, audit-first controls).
