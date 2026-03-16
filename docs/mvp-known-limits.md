# MVP Known Limits and Post-MVP Boundaries

This document defines intentional MVP limits so release decisions remain explicit and predictable.

## Scope Boundaries (MVP)
- Exchange support: Binance futures only.
- Trading mode: paper + live available, but no spot trading.
- Strategy model: flat rule model only (no deep nested logic trees).
- Auth recovery: no forgot-password flow in MVP.
- Logs UX: dashboard logs supports core filtering (`source`, `actor`, `severity`) but no advanced query builder.
- Rate limiting: Redis-backed counters enabled, but no distributed abuse analytics or adaptive throttling.
- API key crypto: AEAD + key versioning shipped; no automated key rotation workflow yet.
- Localization: EN/PL baseline complete for core modules; residual copy polish may continue post-MVP.

## Operational Limits (MVP)
- Single-region deployment assumption.
- No formal SLO/SLA commitments yet.
- Manual incident handling with runbook guidance (no full incident automation).
- Backup/restore relies on infrastructure-level routines, not app-managed snapshots.

## Security and Risk Limits (MVP)
- User consent and audit logging are enforced for live-risk actions.
- Platform does not provide financial advice.
- No automated portfolio-level risk optimizer in MVP.
- No advanced anomaly detection on account behavior yet.

## Explicit Post-MVP Items (V1 Track)
- Spot trading support.
- Advanced risk controls (daily loss, drawdown, cooldowns).
- Full production observability stack (metrics + alerts + incident drills).
- Expanded logs explorer and decision-trace UX.
- Strategy import/export versioning and compatibility policy.
- Hardened auth recovery and account security workflows.

## Release Note
Use this file with:
- `docs/mvp-ops-runbook.md`
- `docs/mvp-risk-consent-text.md`
- `docs/v1-live-release-plan.md`
