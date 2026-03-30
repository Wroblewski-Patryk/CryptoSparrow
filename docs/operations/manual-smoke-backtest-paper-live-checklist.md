# Manual Smoke Checklist - Backtest + Paper + Live Snapshot

Status: ready-to-run operator checklist (2026-03-29).

## Scope
This checklist validates core runtime path in one session:
- login and app health,
- strategy + market group setup,
- backtest parity visibility for 3 symbols,
- paper bot decision flow,
- live exchange positions snapshot visibility.

## Prerequisites
- Docker running (`postgres` + `redis`).
- `.env` configured for API and WEB.
- Binance API key saved in app profile (for snapshot test).

## 1) Start System (2 terminals)
From repo root:

Terminal A:
```powershell
pnpm run backend/dev
```

Terminal B:
```powershell
pnpm run frontend/dev
```

Expected:
- API healthy on `http://localhost:4000` (or configured port).
- WEB healthy on `http://localhost:3002`.

## 2) Login + Basic Health
1. Open `http://localhost:3002`.
2. Login with seeded or existing test user.
3. Confirm dashboard loads without runtime errors in UI.

Expected:
- No build/runtime red screens.
- Header navigation works.

## 3) Create/Verify Market Group (3 Symbols)
1. Go to `Dashboard -> Markets -> Create`.
2. Select base `USDT`.
3. Choose exactly 3 symbols (for easy parity read), for example:
   - `BTCUSDT`
   - `ETHUSDT`
   - `BNBUSDT`
4. Save group.

Expected:
- Group visible in `Markets -> List`.
- Symbol count reflects filters/group selection.

## 4) Create/Verify Strategy
1. Go to `Dashboard -> Strategies -> Create`.
2. Configure simple deterministic strategy (example):
   - Interval: `5m`
   - Entry: RSI/EMA condition (as used in current tests)
   - Close: basic or advanced mode (according to your experiment)
   - DCA levels configured explicitly
3. Save strategy.
4. Re-open strategy in edit and confirm all fields are preserved.

Expected:
- No missing fields on edit.
- DCA settings persist exactly.

## 5) Run Backtest (3 Symbols)
1. Go to `Dashboard -> Backtests -> Create`.
2. Select created strategy.
3. Select created market group (3 symbols).
4. Set `maxCandles` (e.g. `2500` or higher according to test).
5. Start run and wait until status is `COMPLETED` (or `FAILED` with diagnostics).

Expected:
- Report generated.
- `Markets` tab shows per-symbol cards.
- Parity badge visible per symbol (`PROCESSED`/`FAILED`).

## 6) Validate Backtest Report Consistency
For at least one `PROCESSED` symbol:
1. Open `Markets` tab.
2. Confirm:
   - event markers visible (`ENTRY/EXIT/DCA/TP/TTP/SL/TSL/LIQ`),
   - no overlapping trade background intervals,
   - pair stats (`Execution` + `Trades`) consistent with plotted events in visible range.
3. Confirm stats card has coherent values:
   - trades count,
   - win/loss,
   - closed on final candle,
   - liquidations.

Reference checklist:
- `docs/operations/backtest-markets-chart-parity-checklist.md`

## 7) Paper Bot Smoke
1. Go to `Dashboard -> Bots`.
2. Create or update bot in `PAPER` mode.
3. Attach strategy + market group.
4. Ensure bot is active.
5. Observe logs/positions for signal handling.

Expected:
- Bot opens/closes via runtime rules.
- No flip behavior on same symbol while position open.

## 8) Live Snapshot Visibility (No Order Placement)
1. Go to `Dashboard -> Exchanges -> Positions` (or unified profile/exchange view).
2. Trigger exchange snapshot fetch.

Expected:
- Current open exchange positions visible in app.
- Source/management badges shown correctly.
- No secret leakage in logs/UI.

## 9) Pass/Fail Gate
Mark session `PASS` when all conditions below hold:
- API build/test green baseline preserved.
- WEB build green baseline preserved.
- Backtest for 3-symbol group completes and shows coherent parity diagnostics.
- Paper bot loop reacts to market data without rule-contract violations.
- Live snapshot fetch works with valid key and shows positions.

Mark `FAIL` if any item above breaks; attach:
- run id,
- symbol examples,
- screenshot,
- exact error text.
