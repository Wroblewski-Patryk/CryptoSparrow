# Module Documentation Status Index (Canonical)

Updated: 2026-04-17

Purpose: map every active module in code inventory to deep-dive documentation status and planned delivery task.
Latest docs parity artifact: `docs/operations/_artifacts-docs-parity-2026-04-16T22-37-19-622Z.json` (`PASS`).

Status legend:
- `Planned`: deep-dive file not authored yet.
- `In progress`: deep-dive authoring has started.
- `Published`: deep-dive is available and aligned with current code.

## API Modules (`apps/api/src/modules/*`)

| Layer | Module | Source Path | Target Deep-Dive File | Status | Planned Task |
|---|---|---|---|---|---|
| api | admin | `apps/api/src/modules/admin` | `docs/modules/api-admin.md` | Published | DCP-04 |
| api | auth | `apps/api/src/modules/auth` | `docs/modules/api-auth.md` | Published | DCP-04 |
| api | profile | `apps/api/src/modules/profile` | `docs/modules/api-profile.md` | Published | DCP-04 |
| api | users | `apps/api/src/modules/users` | `docs/modules/api-users.md` | Published | DCP-04 |
| api | engine | `apps/api/src/modules/engine` | `docs/modules/api-engine.md` | Published | DCP-05 |
| api | exchange | `apps/api/src/modules/exchange` | `docs/modules/api-exchange.md` | Published | DCP-05 |
| api | market-data | `apps/api/src/modules/market-data` | `docs/modules/api-market-data.md` | Published | DCP-05 |
| api | market-stream | `apps/api/src/modules/market-stream` | `docs/modules/api-market-stream.md` | Published | DCP-05 |
| api | strategies | `apps/api/src/modules/strategies` | `docs/modules/api-strategies.md` | Published | DCP-06 |
| api | markets | `apps/api/src/modules/markets` | `docs/modules/api-markets.md` | Published | DCP-06 |
| api | bots | `apps/api/src/modules/bots` | `docs/modules/api-bots.md` | Published | DCP-06 |
| api | orders | `apps/api/src/modules/orders` | `docs/modules/api-orders.md` | Published | DCP-06 |
| api | positions | `apps/api/src/modules/positions` | `docs/modules/api-positions.md` | Published | DCP-06 |
| api | backtests | `apps/api/src/modules/backtests` | `docs/modules/api-backtests.md` | Published | DCP-06 |
| api | reports | `apps/api/src/modules/reports` | `docs/modules/api-reports.md` | Published | DCP-07 |
| api | subscriptions | `apps/api/src/modules/subscriptions` | `docs/modules/api-subscriptions.md` | Published | DCP-07 |
| api | wallets | `apps/api/src/modules/wallets` | `docs/modules/api-wallets.md` | Published | DCP-07 |
| api | icons | `apps/api/src/modules/icons` | `docs/modules/api-icons.md` | Published | DCP-07 |
| api | upload | `apps/api/src/modules/upload` | `docs/modules/api-upload.md` | Published | DCP-07 |
| api | pagination | `apps/api/src/modules/pagination` | `docs/modules/api-pagination.md` | Published | DCP-07 |
| api | isolation | `apps/api/src/modules/isolation` | `docs/modules/api-isolation.md` | Published | DCP-07 |
| api | logs | `apps/api/src/modules/logs` | `docs/modules/api-logs.md` | Published | DCP-07 |

## Web Features (`apps/web/src/features/*`)

| Layer | Module | Source Path | Target Deep-Dive File | Status | Planned Task |
|---|---|---|---|---|---|
| web | admin | `apps/web/src/features/admin` | `docs/modules/web-admin.md` | Published | DCP-08 |
| web | auth | `apps/web/src/features/auth` | `docs/modules/web-auth.md` | Published | DCP-08 |
| web | profile | `apps/web/src/features/profile` | `docs/modules/web-profile.md` | Published | DCP-08 |
| web | dashboard-home | `apps/web/src/features/dashboard-home` | `docs/modules/web-dashboard-home.md` | Published | DCP-08 |
| web | bots | `apps/web/src/features/bots` | `docs/modules/web-bots.md` | Published | DCP-09 |
| web | backtest | `apps/web/src/features/backtest` | `docs/modules/web-backtest.md` | Published | DCP-09 |
| web | strategies | `apps/web/src/features/strategies` | `docs/modules/web-strategies.md` | Published | DCP-09 |
| web | markets | `apps/web/src/features/markets` | `docs/modules/web-markets.md` | Published | DCP-09 |
| web | exchanges | `apps/web/src/features/exchanges` | `docs/modules/web-exchanges.md` | Published | DCP-09 |
| web | orders | `apps/web/src/features/orders` | `docs/modules/web-orders.md` | Published | DCP-09 |
| web | positions | `apps/web/src/features/positions` | `docs/modules/web-positions.md` | Published | DCP-09 |
| web | wallets | `apps/web/src/features/wallets` | `docs/modules/web-wallets.md` | Published | DCP-09 |
| web | reports | `apps/web/src/features/reports` | `docs/modules/web-reports.md` | Published | DCP-09 |
| web | logs | `apps/web/src/features/logs` | `docs/modules/web-logs.md` | Published | DCP-09 |
| web | icons | `apps/web/src/features/icons` | `docs/modules/web-icons.md` | Published | DCP-09 |

## Governance Notes
- Use `docs/modules/module-deep-dive-template.md` for every new deep-dive file listed above.
- When module inventory changes, this index must be updated in the same task as the code change.
