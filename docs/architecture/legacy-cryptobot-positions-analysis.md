# Legacy CryptoBot Positions Module - Deep Analysis

Status: reference analysis for parity work between legacy `CryptoBot` and `CryptoSparrow`.

## Source Scope

Analyzed legacy files:
- `server/modules/positions/positions.service.js`
- `server/modules/positions/dca.service.js`
- `server/modules/positions/tp.service.js`
- `server/modules/positions/ttp.service.js`
- `server/modules/positions/sl.service.js`
- `server/modules/positions/tsl.service.js`
- `server/modules/positions/risk.service.js`

Repository:
- [CryptoBot positions module](https://github.com/Wroblewski-Patryk/CryptoBot/tree/main/server/modules/positions)

---

## 1. Legacy Runtime Model (What It Actually Does)

### 1.1 `positions.service.js`

Core responsibility:
- Fetch open positions from exchange.
- Cache positions for 10 seconds.
- Run lifecycle checks in strict order for each position.

Key runtime order inside `checkPositions()`:
1. `handleDCA(position, closePosition)`
2. `handleTP(position, closePosition)`
3. `handleTTP(position, closePosition)`
4. `handleSL(position, closePosition)`
5. `handleTSL(position, closePosition)`

Important side effects:
- On `openPosition()`:
  - rejects if max open positions reached,
  - rejects if same symbol already open,
  - clears per-symbol runtime state:
    - `clearDCA(symbol)`
    - `clearTSL(symbol)`
    - `clearTTP(symbol)`
- On `closePosition()`:
  - submits opposite market order,
  - clears the same runtime state buckets.

### 1.2 `dca.service.js`

State:
- `dcaHistory[symbol]` = number of successful DCA executions for symbol.

Trigger logic:
- Active only if `dca.enabled`.
- Stops when `dcaHistory[symbol] >= dca.times`.
- Uses threshold by current DCA index:
  - `percent = dca.percents[dcaHistory[symbol]] || -40`
- Trigger condition:
  - `profitPercent < percent` (strictly less than).

Execution:
- Order size: `amount * dca.multiplier`.
- Increments `dcaHistory[symbol]` only after successful order.

### 1.3 `tp.service.js`

Trigger:
- If `tp.enabled` and `profitPercent >= tp.percent`.

Action:
- Immediate close by market order.

Position in sequence:
- Runs before `TTP/SL/TSL`.

### 1.4 `ttp.service.js`

State:
- `ttpTracking[symbol] = { highProfit, step }`.

Dynamic regime:
- Chooses active start/step from arrays (`starts[]`, `steps[]`) based on current `profitPercent`.

Lifecycle:
- Activate tracking when `profitPercent >= start`.
- Raise high watermark when profit grows.
- Close when retrace condition is met:
  - `profitPercent <= highProfit - step`.

### 1.5 `sl.service.js`

Intended trigger:
- Enabled only after all DCA levels are completed:
  - `dcaCount == dca.times`.
- Then hard SL level from entry:
  - Long: `entry * (1 - sl%)`
  - Short: `entry * (1 + sl%)`

Note:
- File contains a bug in symbol usage order (`symbol` referenced before destructuring), but intended business rule is clear: SL is DCA-gated.

### 1.6 `tsl.service.js`

State:
- `tslTracking[symbol] = { maxLoss }`.

Activation:
- Requires `dcaCount == dca.times`.
- Starts at configured negative band (`tsl.start`), then trails upward by `tsl.step`.

Behavior:
- When rebound improves, `maxLoss` is raised.
- If profit falls below `maxLoss`, position closes.

Interaction with TTP:
- When TTP tracking is active, TSL tracker is cleared to avoid double-trailing conflict.

### 1.7 `risk.service.js`

Entry sizing:
- Uses wallet balance and `risk.perTrade`.
- Applies leverage.
- Caps effective exposure by available balance.
- Applies exchange constraints:
  - `stepSize`,
  - `minNotional`.

### 1.8 Function-by-function map (legacy)

#### `positions.service.js`

| Function | Role | Inputs | Output | Side effects |
|---|---|---|---|---|
| `initPositions()` | Full refresh of open positions from exchange | none | cached position array | Calls exchange API, fetches ticker per symbol, updates global cache and timestamp |
| `getPositions()` | Read-through cache getter | none | cached or fresh positions | Returns cache if younger than 10s |
| `updatePositions()` | Periodic cycle entrypoint | none | none | refresh -> console render -> `checkPositions()` |
| `showPositions()` | Console diagnostics list | none | none | sorts by ROI and prints DCA/TTP/TSL states |
| `openPosition(signal)` | Open new market position | `{ symbol, side }` + runtime config | order or `null` | max-open guard, per-symbol guard, risk sizing, state clear |
| `checkPositions()` | Lifecycle evaluator loop | none (uses cache) | none | calls DCA/TP/TTP/SL/TSL in strict order |
| `closePosition(symbol, side, amount)` | Market close helper | symbol, side, qty | close order or `null` | sends opposite side order and clears DCA/TTP/TSL |
| `apiGetPositions()` | API-safe projection of cached positions | none | simplified position list | exposes profit, side, DCA/TTP/TSL |

#### `dca.service.js`

| Function | Role | Inputs | Output | Side effects |
|---|---|---|---|---|
| `handleDCA(position, closePosition)` | DCA trigger and add order | current position | none | reads wallet, may place add order, increments per-symbol DCA counter |
| `clearDCA(symbol)` | Reset DCA state for symbol | symbol | none | sets DCA counter to `0` |
| `getDCA(symbol)` | Read DCA counter | symbol | integer | no exchange side effect |

#### `tp.service.js`

| Function | Role | Inputs | Output | Side effects |
|---|---|---|---|---|
| `handleTP(position, closePosition)` | Hard TP close | current position | none | closes position when TP threshold reached |

#### `ttp.service.js`

| Function | Role | Inputs | Output | Side effects |
|---|---|---|---|---|
| `handleTTP(position, closePosition)` | Dynamic trailing take-profit | current position | none | updates `highProfit` tracker and may close on retrace |
| `clearTTP(symbol)` | Reset TTP tracker | symbol | none | deletes symbol from TTP map |
| `getTTP(symbol)` | Read active TTP level | symbol | string percent | computes `highProfit-step` |
| `getDynamicStart(profitPercent, starts)` | Select start threshold by regime | profit + starts[] | start value | pure helper |
| `getDynamicStep(profitPercent, starts, steps)` | Select trailing step by regime | profit + starts[] + steps[] | step value | pure helper |

#### `sl.service.js`

| Function | Role | Inputs | Output | Side effects |
|---|---|---|---|---|
| `handleSL(position, closePosition)` | Hard stop loss | current position | none | DCA-gated close when stop level is crossed |

#### `tsl.service.js`

| Function | Role | Inputs | Output | Side effects |
|---|---|---|---|---|
| `handleTSL(position, closePosition)` | Trailing stop on loss/profit rebound | current position | none | updates dynamic `maxLoss` and may close |
| `clearTSL(symbol)` | Reset TSL tracker | symbol | none | deletes symbol from TSL map |
| `getTSL(symbol)` | Read current TSL threshold | symbol | string percent | returns clipped loss floor |

#### `risk.service.js`

| Function | Role | Inputs | Output | Side effects |
|---|---|---|---|---|
| `calculateOrderSize(symbol)` | Compute entry amount under risk config and exchange limits | symbol | amount or `null` | queries wallet, market metadata, ticker, applies step/minNotional |

---

## 2. Legacy Sequence Contract (Critical)

Legacy intent is sequence-first:
- DCA is always evaluated first.
- Close logic is evaluated after DCA.
- State transitions in earlier steps affect later steps in the same cycle.

This is the root reason why parity cannot be achieved with independent per-feature evaluators in different modules.

---

## 3. CryptoSparrow Canonical Contract (Parity + Clarification)

For CryptoSparrow, we keep the legacy sequencing discipline but formalize one additional rule required by product behavior:

### 3.1 One shared lifecycle algorithm for all modes

`BACKTEST`, `PAPER`, `LIVE` must use the same lifecycle decision core:
- same inputs,
- same ordering,
- same close reasons,
- same state transitions.

Only data adapters differ:
- historical candles for backtest,
- stream/mark prices for paper/live.

### 3.2 Mandatory evaluation order per position, per cycle

1. Entry/hold/exit signal context (strategy)
2. DCA phase
3. Close phase
  - basic mode: `TP -> SL`
  - advanced mode: `TTP -> TSL`
4. Liquidation guard / hard account floor

### 3.3 DCA-first close guard (required)

If position has pending DCA levels and DCA is still financially possible:
- do not close by `TTP`, `TSL`, or `SL` yet.

Exception:
- if next DCA cannot be funded (no free margin/wallet), close protections are allowed.

This rule prevents early close before planned averaging sequence is exhausted.

### 3.4 Symbol constraints

- One active position per symbol.
- No flip while position is open.
- New opposite position can open only after previous one is closed.

### 3.5 State reset contract

On open and on close:
- clear DCA state,
- clear TTP state,
- clear TSL state.

---

## 4. Known Legacy Gaps to Avoid Copying Blindly

- `sl.service.js` has a symbol-scoping bug.
- DCA funds check in legacy uses coarse balance logic and does not model margin reservation rigorously.
- Legacy module has duplicated close-side exchange calls in different services.

CryptoSparrow must keep behavioral intent, not copy implementation defects.

---

## 5. Documentation Binding

The following docs are normative with this analysis:
- [Position Lifecycle Parity Matrix](/C:/Personal/Projekty/Aplikacje/CryptoSparrow/docs/architecture/position-lifecycle-parity-matrix.md)
- [Trading Logic](/C:/Personal/Projekty/Aplikacje/CryptoSparrow/docs/architecture/trading-logic.md)

Any lifecycle change must update all three documents in the same PR.
