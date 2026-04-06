# Security and Risk

## Security Principles
- Minimum access to API keys.
- Encryption for sensitive secrets at rest.
- Clear audit logs for all critical actions.
- Strict validation of all inputs.

## Trading Risk Notice
CryptoSparrow is not financial advice. Trading involves risk and users remain responsible for their decisions. Automated execution should require explicit user consent.

For MVP user-facing wording (banner, modal, consent checkbox), use:
- `docs/security/mvp-risk-consent-text.md`

For API-key handling policy (create/rotate/revoke cadence), use:
- `docs/security/api-key-lifecycle-policy.md`

For canonical runtime/ops secret owners and rotation cadence, use:
- `docs/security/v1-secrets-inventory.md`

For ownership-boundary coverage snapshot, use:
- `docs/security/security-ownership-audit.md`

## Authentication Plan
- MVP: email + password.
- After MVP: OAuth (Google and others).
- 2FA planned later.

## Availability
- Minimize downtime during deployments.
- Separate API and worker processes when load grows.

## Implementation Requirements
- API keys must be encrypted and never returned in plaintext.
- All sensitive actions require authentication and ownership checks.
- Rate limiting for all trading and market endpoints.
- Live trading must be an explicit opt-in per bot.
- Live consent acceptance must be audit-logged with text version (`consentTextVersion`).

## Threat Model (V1 Baseline)
### Assets
- User account sessions and authentication cookies.
- Exchange API keys and secrets.
- Trading decision pipeline (`strategy -> backtest -> paper/live pre-trade -> execution`).
- Audit logs used for incident analysis and operator accountability.

### Trust Boundaries
- Browser/client to API boundary (cookie auth, CORS, validation).
- API to database boundary (Prisma models with ownership scope).
- API to exchange boundary (live order adapter and retries).
- API to cache/infra boundary (Redis-backed rate limiting and caching).

### Primary Abuse Paths
- Session token replay or stale-secret acceptance during rotation windows.
- Privilege/ownership abuse through ID-based resource access attempts.
- Secret leakage via API responses or logs.
- Unsafe live execution without explicit consent or emergency controls.
- Resource exhaustion via auth/market/trading endpoint floods.

### Mitigations Implemented
- JWT verification hardened with issuer/audience checks and controlled previous-secret rotation support.
- Rotation window for previous JWT secret can be bounded via `JWT_SECRET_PREVIOUS_UNTIL` (ISO datetime).
- Ownership checks standardized to scoped lookups (`id + userId`) on sensitive reads/writes.
- API keys encrypted at rest (AEAD) and masked in all API responses.
- Live mode guardrails: explicit opt-in, consent version, kill-switch/emergency-stop checks.
- Redis-backed rate limiting for high-risk endpoint groups.
- Critical pre-trade decisions written to audit log stream.

## Residual Risk Register (2026-03-16)
| ID | Risk | Impact | Current Mitigation | Residual Level | Next Action |
|---|---|---|---|---|---|
| R-SEC-01 | Cookie theft on compromised client device | Account takeover / live action abuse | HttpOnly cookie, auth checks, ownership checks | Medium | Add device/session revocation UI + endpoint |
| R-SEC-02 | Extended trust in previous JWT secret during rotation | Token replay window | Primary+previous verification path, strict issuer/audience | Medium | Add explicit rotation TTL policy and monitoring alert |
| R-SEC-03 | Exchange key misuse after long-lived key exposure | Unauthorized exchange actions | AEAD encryption, masked responses, rotate/revoke endpoints | Medium | Enforce periodic key rotation and "last used" alerts |
| R-SEC-04 | Operational misconfiguration of live bots | Unintended live trades | liveOptIn + consentTextVersion + kill-switch + emergency stop | Low/Medium | Add risk-first confirmation UX for all live mutations |
| R-SEC-05 | Incomplete infra observability during incidents | Slower detection and response | Audit logs + baseline runbook | Medium | Add structured metrics/alerts/SLO dashboards |
