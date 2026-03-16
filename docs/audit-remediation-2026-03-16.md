# Audit Remediation Plan (2026-03-16)

This document captures high-priority audit findings and defines mandatory remediation before further feature expansion.

## Scope
- Inputs: security, API, config, crypto, logs, rate limiting, tests, i18n, and type-safety findings.
- Priority model: P0 (critical) -> P3 (cleanup).

## P0 (Blocker)
- Upload endpoint must require auth and enforce MIME + size limits to prevent abuse and DoS.
- LIVE consent flow must persist and audit `consentTextVersion` end-to-end.

## P1 (High)
- APP URL and CORS parsing must be deterministic and environment-safe.
- Frontend API base URL must use env/runtime-safe configuration (no localhost hardcoding).
- API key encryption must use AEAD + key versioning (integrity + migration safety).
- Logs module must provide real backend API for dashboard logs (with actor/source/severity filters).
- Rate limiter must be Redis-backed and safe for multi-process/horizontal scale.
- Full test suite must pass (server + client) before closing critical readiness gates.

## P2 (Medium)
- remember-me semantics must match cookie/session TTL behavior.
- Auth contract must be consistent for forgot-password flows.
- i18n hardcoded strings must be removed from affected views.

## P3 (Low)
- Remove remaining `any` usage in profile routes/controllers.

## Documentation Alignment Rules
- Do not mark a task complete in `mvp-execution-plan.md` unless verified by tests or explicit implementation evidence.
- Keep `mvp-next-commits.md` focused on the remediation gate until P0/P1 are closed.
- If implementation differs from docs, docs must be corrected in the same planning update.
