# Documentation Coverage Audit (Code vs Docs)

Date: 2026-04-12
Owner: Documentation sync pass

## Goal
Confirm whether active code modules and routes are represented in canonical documentation and close critical gaps.

## Audit Method
1. Enumerated backend modules from `apps/api/src/modules/*`.
2. Enumerated frontend domains from `apps/web/src/features/*`.
3. Enumerated route pages from `apps/web/src/app/**/page.tsx`.
4. Compared results against canonical docs:
- `docs/modules/system-modules.md`
- `docs/architecture/dashboard-route-map.md`

## Findings Before Update
### Missing from canonical module map
- Backend: `admin`, `engine`, `icons`, `subscriptions`, `users`, `wallets`
- Frontend: `admin`, `dashboard-home`, `icons`, `wallets`

### Outdated route map
- `docs/architecture/dashboard-route-map.md` still listed first-level `/dashboard/orders` and `/dashboard/positions` routes.
- Actual app routes include `wallets` and additional `bots` sub-routes.
- Admin routes (`/admin`, `/admin/users`, `/admin/subscriptions`) were not represented in that canonical route map.

## Actions Applied In This Pass
1. Updated `docs/modules/system-modules.md` to include all active backend/frontend module domains.
2. Updated `docs/architecture/dashboard-route-map.md` to match current routes in `apps/web/src/app`.
3. Kept module and route docs aligned with current repository state as of 2026-04-12.

## Remaining Reality Check
- Many domains have deep operational and planning docs, but not all have dedicated per-module deep-dive files under `docs/modules/`.
- Current canonical source remains:
  - module inventory: `docs/modules/system-modules.md`
  - route inventory: `docs/architecture/dashboard-route-map.md`

## Ongoing Guardrail
When adding/removing one of the following, update canonical docs in the same PR/commit:
- A directory under `apps/api/src/modules`
- A directory under `apps/web/src/features`
- A dashboard/admin/public `page.tsx` route under `apps/web/src/app`

Recommended verification commands:

```powershell
Get-ChildItem -Path apps/api/src/modules -Directory | Select-Object -ExpandProperty Name
Get-ChildItem -Path apps/web/src/features -Directory | Select-Object -ExpandProperty Name
Get-ChildItem -Path apps/web/src/app -Recurse -Filter page.tsx
```
