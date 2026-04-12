# Module Deep-Dive Template (Canonical)

Use this template when creating or updating deep-dive docs for backend (`apps/api/src/modules/*`) and frontend (`apps/web/src/features/*`) module domains.

## Metadata
- Module name:
- Layer: `api` | `web` | `shared`
- Source path:
- Owner:
- Last updated:
- Related planning task:

## 1. Purpose and Scope
- What this module is responsible for.
- What is explicitly out of scope.
- Primary consumers (users, services, UI areas, jobs).

## 2. Boundaries and Dependencies
- Upstream dependencies (what this module calls/reads).
- Downstream dependents (what calls/reads this module).
- Trust boundaries and ownership boundaries.

## 3. Data and Contract Surface
- Input contracts (DTO/schema/query/body/events).
- Output contracts (response/read model/events).
- Persistence models and key indexes (if applicable).
- Validation and normalization rules.

## 4. Runtime Flows
- Main happy-path flow (step-by-step).
- Failure-path flow and fallback behavior.
- Retry, idempotency, and consistency guarantees.

## 5. API and UI Integration
- API endpoints/routes owned by this module.
- UI routes/components that consume this module.
- Feature flags or environment gates (if any).

## 6. Security and Risk Guardrails
- AuthN/AuthZ requirements.
- Sensitive data handling rules.
- Abuse/rate-limit controls.
- Fail-closed expectations and emergency controls.

## 7. Observability and Operations
- Logs, metrics, traces, and alerts relevant to this module.
- Operational runbooks and incident links.
- Known production caveats.

## 8. Test Coverage and Evidence
- Unit tests:
- Integration/e2e tests:
- Manual checks:
- Latest evidence artifact links:

## 9. Open Issues and Follow-Ups
- Known gaps.
- Planned improvements.
- Explicit non-goals for current wave.

## Authoring Checklist (Mandatory)
- [ ] Module scope matches current code inventory path.
- [ ] Boundaries are explicit and non-ambiguous.
- [ ] Contracts are listed with concrete source references.
- [ ] Security guardrails are documented or explicitly marked not applicable.
- [ ] Test coverage section includes real commands/files, not placeholders.
- [ ] At least one operational or validation evidence reference is attached (or explicit reason why not available yet).
- [ ] Links are repository-relative and not broken.
- [ ] File language is English.
