# Admin Frontend Architecture

This document captures admin/dashboard frontend architecture constraints.

## Canonical Companions
- `../ux/ui-ux-foundation.md`
- `../modules/system-modules.md`
- `../architecture/system-architecture.md`

## Information Architecture
- Dashboard pages follow the canonical order from UX foundation and module map.
- Frontend surfaces are split into:
  - `public`: marketing/informational pages and auth entry points.
  - `client/dashboard`: authenticated product workspace for end users.
  - `admin`: owner-only control panel for business-critical configuration.

## Admin Scope (V1)
- Manage subscription plan pricing.
- Manage plan entitlements (bot limits and PAPER/LIVE mode access).
- Manage sensitive operational toggles required for business control.
- Manage security lock overrides for user/account/IP lock incidents.
- Manage manual subscription grants and duration overrides for selected accounts.
- Support admin grant scheduling with start mode selector: `start now` or `start at` (future date/time).
- Manual grant UX must show that grants are non-renewing by default and preview post-expiry return to previous plan state.
- Provide reason-category management as append-focused catalog (add new categories without mutating baseline ones).
- V1 goal is operational control, not full BI/CRM tooling.

## Admin Scope (V2+)
- Add advanced billing workflows, growth tooling, and analytics/reporting modules.

## State Management
- Server data access is API-driven and should use consistent loading/error/degraded states.

## Shared Components
- Use shared dashboard primitives for status, cards, tables, and confirmations.

## Routing Strategy
- Keep routes grouped by dashboard module and aligned with module ownership.

## Performance Notes
- Favor incremental rendering, stable query keys, and lightweight polling/stream updates.
