# Dashboard Route Map (Canonical)

Updated: 2026-03-22

## Canonical Routes (V1)
- `/dashboard`
- `/dashboard/exchanges`
- `/dashboard/orders`
- `/dashboard/positions`
- `/dashboard/markets/list`
- `/dashboard/markets/create`
- `/dashboard/markets/:id/edit`
- `/dashboard/strategies/list`
- `/dashboard/strategies/create`
- `/dashboard/strategies/:id/edit`
- `/dashboard/backtests/list`
- `/dashboard/backtests/create`
- `/dashboard/backtests/:id`
- `/dashboard/bots`
- `/dashboard/reports`
- `/dashboard/logs`
- `/dashboard/profile`

## Menu Contract
- Header and dashboard nav should only render canonical routes.
- Legacy aliases are hard-cut (removed) to avoid `backtest/backtests` and `builder/create` ambiguity.
- Active menu state is computed from canonical route groups only.
