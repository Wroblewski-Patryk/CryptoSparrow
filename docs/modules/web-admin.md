# Web Deep-Dive: Admin Module

## Metadata
- Module name: `admin`
- Layer: `web`
- Source path: `apps/web/src/features/admin`
- Owner: frontend/admin-console
- Last updated: 2026-04-12
- Related planning task: `DCP-08`

## 1. Purpose and Scope
- Implements admin console pages for user and subscription plan operations.
- Provides two primary surfaces:
  - admin users management
  - admin subscription plan management

Out of scope:
- API-side role enforcement and audit logic (API admin module).
- General dashboard user settings.

## 2. Boundaries and Dependencies
- Route entrypoints:
  - `/admin` (redirects to `/admin/subscriptions`)
  - `/admin/subscriptions`
  - `/admin/users`
- Depends on:
  - admin APIs (`/admin/users`, `/admin/subscriptions/plans`)
  - shared auth context (used for self-demotion guard in users page)
  - admin layout shell in `apps/web/src/app/admin/layout.tsx`

## 3. Data and Contract Surface
- Users page contracts:
  - list users with filters/pagination
  - patch user role
  - patch user assigned subscription plan
- Subscriptions page contracts:
  - list plans
  - update plan pricing and entitlement limits
- Forms enforce client-side numeric and structural constraints before API calls.

## 4. Runtime Flows
- Admin users flow:
  1. Load users and plan catalog.
  2. Filter by email/name and role.
  3. Toggle role or assign plan per row.
  4. Prevent current admin self-demotion in UI.
- Admin subscription flow:
  1. Load plans sorted by order/name.
  2. Open edit modal for selected plan.
  3. Validate limits and currency format.
  4. Submit update and patch local state.

## 5. UI Integration
- Layout:
  - dedicated admin shell with subscriptions/users navigation.
- Route wrappers:
  - app route files re-export feature pages for Next app router wiring.

## 6. Security and Risk Guardrails
- Admin pages are under middleware-protected `/admin/:path*`.
- Final authorization is backend-enforced; UI assumes authenticated admin context.
- Users page blocks accidental self-demotion action in client.

## 7. Observability and Operations
- Explicit loading/error/action-error states in both admin pages.
- Refresh controls allow manual re-sync after admin mutations.

## 8. Test Coverage and Evidence
- Primary tests:
  - `AdminUsersPage.test.tsx`
  - `AdminSubscriptionsPage.test.tsx`
- Suggested validation command:
```powershell
pnpm --filter web test -- src/features/admin/users/pages/AdminUsersPage.test.tsx src/features/admin/subscriptions/pages/AdminSubscriptionsPage.test.tsx
```

## 9. Open Issues and Follow-Ups
- Add explicit client-side role gate/redirect for non-admin users to improve UX clarity.
- Add optimistic update rollback telemetry for admin mutation failures.

