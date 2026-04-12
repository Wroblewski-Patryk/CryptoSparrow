# API Deep-Dive: Admin Module

## Metadata
- Module name: `admin`
- Layer: `api`
- Source path: `apps/api/src/modules/admin`
- Owner: backend/core
- Last updated: 2026-04-12
- Related planning task: `DCP-04`

## 1. Purpose and Scope
- Provides administrator-only management for users and subscription plans.
- Exposes paged user listing plus controlled role/subscription mutations.
- Exposes subscription catalog updates used for operational pricing/entitlement management.

Out of scope:
- End-user self-service profile actions.
- Public subscription checkout/session flows.

## 2. Boundaries and Dependencies
- Router mount: `/admin` via `apps/api/src/router/admin.routes.ts`.
- Access boundary: guarded by `requireAuth` + `requireRole('ADMIN')`.
- Depends on:
  - `prisma` persistence.
  - `subscriptions.service` for catalog initialization and assignment helpers.
- Downstream consumers:
  - Admin dashboard APIs and admin UI workflows.

## 3. Data and Contract Surface
- Key DTO/contracts:
  - `AdminUsersListQueryDto`, `UpdateAdminUserDto` (`users.types.ts`).
  - `UpdateAdminSubscriptionPlanDto` (`subscriptionPlans.types.ts`).
- Write invariants:
  - No self-demotion from last/admin role scenarios.
  - No demotion when it would remove the last admin.
  - Subscription plan updates rely on existing catalog row (`ensureSubscriptionCatalog` bootstrap).

## 4. Runtime Flows
- User management flow:
  1. List users with pagination/search/role filters.
  2. Optional role update with guardrails (self + last-admin protection).
  3. Optional active subscription override through `setActiveSubscriptionForUser`.
- Subscription plan flow:
  1. Ensure catalog exists.
  2. List plans ordered by sort/display.
  3. Update mutable plan fields (`displayName`, `isActive`, `price`, `currency`, `entitlements`).

## 5. API and UI Integration
- Mounted base path: `/admin`.
- Routes:
  - `GET /admin/users`
  - `PATCH /admin/users/:userId`
  - `GET /admin/subscriptions/plans`
  - `PUT /admin/subscriptions/plans/:code`

## 6. Security and Risk Guardrails
- Admin-only authorization enforced at router level.
- Demotion guardrails prevent privilege lockout.
- Plan/user mutations are constrained to explicit whitelisted fields.

## 7. Observability and Operations
- Admin user updates and subscription changes are persisted via transactional writes.
- Operational parity depends on subscription catalog bootstrap consistency.

## 8. Test Coverage and Evidence
- Primary tests:
  - `apps/api/src/modules/admin/users/users.e2e.test.ts`
  - `apps/api/src/modules/admin/subscriptionPlans/subscriptionPlans.e2e.test.ts`
- Suggested validation command:
```powershell
pnpm --filter api test -- src/modules/admin/users/users.e2e.test.ts src/modules/admin/subscriptionPlans/subscriptionPlans.e2e.test.ts
```

## 9. Open Issues and Follow-Ups
- Replace remaining message-string error signaling with typed domain errors (optimization wave).
- Extend audit log detail for admin mutations if stronger compliance trace is required.
