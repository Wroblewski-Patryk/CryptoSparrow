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

## Legacy Aliases (Redirect-Only)
- `/dashboard/backtest` -> `/dashboard/backtests/list`
- `/dashboard/backtest/add` -> `/dashboard/backtests/create`
- `/dashboard/strategies/add` -> `/dashboard/strategies/create`
- `/dashboard/builder` -> `/dashboard/strategies/create` (legacy builder entrypoint)

## Menu Contract
- Header and dashboard nav should only render canonical routes.
- Alias routes remain supported as compatibility redirects, but must not be used as new links.
- Active menu state must treat alias paths as belonging to their canonical group (`backtests`, `strategies`).

