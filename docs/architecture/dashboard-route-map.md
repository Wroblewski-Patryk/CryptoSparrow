# Dashboard Route Map (Canonical)

Updated: 2026-04-12

## Canonical Dashboard Routes (V1)
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

## Canonical Admin Routes (V1)
- `/admin`
- `/admin/users`
- `/admin/subscriptions`

## Public/Access Routes (V1)
- `/`
- `/auth/login`
- `/auth/register`
- `/offline`

## Menu Contract
- Dashboard navigation should point to canonical dashboard routes only.
- `orders` and `positions` are no longer first-level dashboard routes and are exposed through operational exchange views.
- Active menu state is computed from canonical route groups only.
