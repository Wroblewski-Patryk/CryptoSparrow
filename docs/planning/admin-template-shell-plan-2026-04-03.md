# Admin Template Shell Plan (2026-04-03)

Goal: introduce a dedicated third app shell for `/admin` (separate from `public` and `dashboard`) without impacting current user/runtime flows.

## Scope
- Route group: `apps/web/src/app/admin/*`
- Dedicated shell layout: `apps/web/src/app/admin/layout.tsx`
- Dedicated UI primitives (header/sidebar/footer) under `apps/web/src/ui/layout/admin/*`

## Proposed Tiny Tasks
1. `ADM-01 docs(contract): define admin IA and shell contract (header, nav, auth guard, breadcrumb policy)`
2. `ADM-02 feat(web-admin-shell): implement base admin layout wrapper with consistent spacing/theme`
3. `ADM-03 feat(web-admin-nav): add minimal admin navigation block (Users, Subscriptions, Languages, Settings)`
4. `ADM-04 feat(web-admin-guard): enforce admin-only route guard and unauthorized fallback`
5. `ADM-05 test(web-admin-shell): add route/layout regressions for admin shell and guard behavior`
6. `ADM-06 docs(ops): update navigation and deployment docs with admin shell structure`

## Non-goals (this wave)
- Full admin business workflows (billing management, moderation tools)
- API contract expansion for admin domain data
- Runtime trading logic changes

