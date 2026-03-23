# V1 Launch Evidence Pack

Purpose: single reference index for launch-readiness documentation and evidence artifacts.

## 1) Public-Facing Documentation
- User guide: `docs/operations/user-guide.md`
- Risk consent text: `docs/security/mvp-risk-consent-text.md`
- Product scope/status: `docs/product/product.md`
- Known limits: `docs/product/known-limits.md`
- Changelog: `docs/operations/v1-changelog.md`
- Migration notes: `docs/operations/v1-migration-notes.md`

## 2) Operator and Incident Documentation
- Operator handbook: `docs/operations/operator-handbook.md`
- V1 ops runbook: `docs/operations/v1-ops-runbook.md`
- Assistant incident runbook: `docs/operations/v1-assistant-incident-runbook.md`
- Alert rules: `docs/operations/v1-alert-rules.md`
- Incident drills: `docs/operations/v1-incident-drills.md`
- Post-release monitoring protocol: `docs/operations/v1-post-release-monitoring.md`

## 3) Security and Audit Evidence
- Ownership baseline audit: `docs/security/security-ownership-audit.md`
- Final security verification (auth/ownership/key-flow): `docs/security/security-audit-verification-2026-03-21.md`
- Audit remediation log: `docs/planning/audit-remediation-2026-03-16.md`

## 4) Runtime and Performance Evidence
- MVP release checklist evidence: `docs/operations/mvp-release-checklist.md`
- RC checklist evidence: `docs/operations/v1-release-candidate-checklist.md`
- SLO catalog: `docs/operations/v1-slo-catalog.md`
- Load baseline report: `docs/operations/v1-load-baseline-2026-03-21.md`
- Raw load baseline artifact: `docs/operations/_artifacts-load-baseline-2026-03-21.txt`

## 5) External Gates (Production-Dependent)
- External-gates runbook: `docs/operations/v1-rc-external-gates-runbook.md`
- RC sign-off record template: `docs/operations/v1-rc-signoff-record.md`
- Launch review + V1.1 backlog cut: `docs/operations/v1-launch-review-2026-03-21.md`

Open production-dependent items are tracked in:
- `docs/operations/v1-release-candidate-checklist.md` -> `Outstanding External Gates`

## 6) Current Readiness Snapshot (2026-03-21)
- Code/test/build/security/load documentation evidence is compiled and linked in this pack.
- Remaining blockers are environment/organization gates:
  - backup + restore validation on target release environment,
  - queue-lag observation window in production-like telemetry,
  - incident-contact confirmation and formal sign-offs.
