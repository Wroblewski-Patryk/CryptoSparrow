# Security and Risk

## Security Principles
- Minimum access to API keys.
- Encryption for sensitive secrets at rest.
- Clear audit logs for all critical actions.
- Strict validation of all inputs.

## Trading Risk Notice
CryptoSparrow is not financial advice. Trading involves risk and users remain responsible for their decisions. Automated execution should require explicit user consent.

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