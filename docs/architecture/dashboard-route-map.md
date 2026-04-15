# Dashboard Route-to-Feature-to-API Contract (Canonical)

Updated: 2026-04-15

Purpose: keep one canonical mapping of web routes to frontend feature ownership, API contracts, and security/operational guardrails.

## Canonical Web Route Inventory (V1)
### Dashboard
- `/dashboard`
- `/dashboard/exchanges`
- `/dashboard/markets/list`
- `/dashboard/markets/create`
- `/dashboard/markets/:id/edit`
- `/dashboard/strategies/list`
- `/dashboard/strategies/create`
- `/dashboard/strategies/:id`
- `/dashboard/strategies/:id/edit`
- `/dashboard/backtests/list`
- `/dashboard/backtests/create`
- `/dashboard/backtests/:id`
- `/dashboard/bots`
- `/dashboard/bots/assistant`
- `/dashboard/bots/create`
- `/dashboard/bots/new`
- `/dashboard/bots/runtime`
- `/dashboard/bots/:id`
- `/dashboard/bots/:id/assistant`
- `/dashboard/bots/:id/edit`
- `/dashboard/bots/:id/preview`
- `/dashboard/bots/:id/runtime`
- `/dashboard/reports`
- `/dashboard/logs`
- `/dashboard/profile`
- `/dashboard/wallets`
- `/dashboard/wallets/create`
- `/dashboard/wallets/list`
- `/dashboard/wallets/:id`
- `/dashboard/wallets/:id/edit`

### Admin
- `/admin`
- `/admin/users`
- `/admin/subscriptions`

### Public/Access
- `/`
- `/auth/login`
- `/auth/register`
- `/offline`

## Canonical Route Mapping
| Web Route Pattern | Web Feature Ownership | Primary API Contract | Backend Module Ownership | Guardrails |
|---|---|---|---|---|
| `/auth/login`, `/auth/register` | `features/auth` | `/auth/login`, `/auth/register`, `/auth/me`, `/auth/logout` | `api/auth` | Public pages; authenticated session redirects user to `/dashboard`. |
| `/dashboard` | `features/dashboard-home` | `/dashboard/bots*`, `/dashboard/market-stream/events`, `/dashboard/icons/lookup` | `api/bots`, `api/market-stream`, `api/icons` | Requires dashboard session; stale runtime data warning and read-safe fallback states. |
| `/dashboard/profile` | `features/profile` + `features/exchanges` | `/dashboard/profile/basic`, `/dashboard/profile/apiKeys*`, `/dashboard/profile/security/*`, `/dashboard/profile/subscription`, `/upload/avatar` | `api/profile`, `api/subscriptions`, `api/upload` | Sensitive actions require explicit confirmation/password input. |
| `/dashboard/exchanges` | Redirect to profile integrations (`#api`) | Uses profile API-key contract (`/dashboard/profile/apiKeys*`) | `api/profile` | Canonical integration surface remains profile tab; no standalone exchanges write contract yet. |
| `/dashboard/wallets*` | `features/wallets` | `/dashboard/wallets*` | `api/wallets` | Wallet is required prerequisite for bot creation (`walletId`-first contract). |
| `/dashboard/markets*` | `features/markets` | `/dashboard/markets/universes*`, `/dashboard/markets/catalog` | `api/markets` | Edit path fails closed when market universe is used by active bot. |
| `/dashboard/strategies*` | `features/strategies` | `/dashboard/strategies*`, `/dashboard/strategies/indicators` | `api/strategies` | Edit path surfaces active-bot lock contract from backend. |
| `/dashboard/backtests*` | `features/backtest` | `/dashboard/backtests/runs*` | `api/backtests` | Deterministic staging in details view; safe handling of missing report/timeline failures. |
| `/dashboard/bots*` | `features/bots` | `/dashboard/bots*` (CRUD/runtime/assistant/dry-run) | `api/bots` (+ `api/engine` runtime internals) | LIVE activation requires capability + consent + compatible wallet context. |
| `/dashboard/reports` | `features/reports` | `/dashboard/reports/cross-mode-performance`, `/dashboard/backtests/runs*` | `api/reports`, `api/backtests` | Read-only analytics surface with empty/error fallback states. |
| `/dashboard/logs` | `features/logs` | `/dashboard/logs` | `api/logs` | User-scoped audit reads only; severity/source filters validated server-side. |
| `/admin/subscriptions` | `features/admin/subscriptions` | `/admin/subscriptions/plans*` | `api/admin/subscriptionPlans` | Requires admin role server-side (`requireRole('ADMIN')`). |
| `/admin/users` | `features/admin/users` | `/admin/users*` | `api/admin/users` | Requires admin role server-side; UI prevents self-demotion action. |
| `/`, `/offline` | `app/(public)`, offline page | none (or auth session probe) | n/a | Public entry points; no privileged route contract. |

## Legacy and Redirect Contract
| Legacy / Alias Route | Canonical Target | Enforcement Layer |
|---|---|---|
| `/dashboard/orders` | `/dashboard/bots/runtime?legacy=orders` | `apps/web/src/middleware.ts` |
| `/dashboard/positions` | `/dashboard/bots/runtime?legacy=positions` | `apps/web/src/middleware.ts` |
| `/dashboard/exchanges` | `/dashboard/profile#api` | app route redirect |
| `/dashboard/bots/new` | `/dashboard/bots/create` | app route redirect |
| `/dashboard/bots/:id` | `/dashboard/bots/:id/preview` | app route redirect |
| `/dashboard/bots/:id/runtime` | `/dashboard/bots/:id/preview` | app route redirect |
| `/dashboard/strategies/:id` | `/dashboard/strategies/:id/edit` | app route redirect |
| `/dashboard/wallets` | `/dashboard/wallets/list` | app route redirect |
| `/dashboard/wallets/:id` | `/dashboard/wallets/:id/edit` | app route redirect |
| `/admin` | `/admin/subscriptions` | app route redirect |

## Route Guardrails
1. Dashboard/admin routes must remain behind web middleware matcher: `['/dashboard/:path*', '/admin/:path*']`.
2. API authorization is authoritative on backend:
   - `/dashboard/*` requires `requireAuth`.
   - `/admin/*` requires `requireAuth + requireRole('ADMIN')`.
3. First-level `/dashboard/orders` and `/dashboard/positions` must stay legacy redirects, not active IA destinations.
4. Navigation should use `dashboardRoutes` constants; do not hardcode divergent dashboard paths.
5. Any added/removed `app/**/page.tsx` route must update this file in the same task.
6. Any new route-to-feature contract must have matching module deep-dive coverage in `docs/modules/`.

## Maintenance Checklist
Run before closing route-impacting tasks:

```powershell
Get-ChildItem -Path apps/web/src/app -Recurse -Filter page.tsx
Get-Content apps/web/src/ui/layout/dashboard/dashboardRoutes.ts
Get-Content apps/api/src/router/dashboard.routes.ts
Get-Content apps/api/src/router/admin.routes.ts
```
