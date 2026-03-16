# Changelog

All notable changes to this project are documented in this file.

## 2026-03-16

### Added
- Redis-backed rate limiting with TTL-bounded key growth.
- Real `/dashboard/logs` API with `source`, `actor`, and `severity` filters.
- Live-consent `consentTextVersion` persistence and audit coverage.
- Upload endpoint hardening (auth + MIME/size validation + abuse limits).
- MVP known-limits release document and release checklist.

### Changed
- API key encryption migrated to AES-GCM with key versioning and legacy decrypt compatibility.
- Auth session semantics aligned for JWT and cookie TTL (`remember-me` vs short session).
- Dashboard logs views switched from derived sources to backend logs API.
- Logs/dashboard copy moved to i18n translation keys.
- Full server/client test suites stabilized and green.
- Profile module routes/controllers refactored to remove remaining `any` usage.

### Removed
- Dead forgot-password client call paths that were not implemented server-side.
