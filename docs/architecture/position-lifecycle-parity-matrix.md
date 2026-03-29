# Position Lifecycle Parity Matrix (CryptoBot -> CryptoSparrow)

Status: canonical contract for lifecycle parity and execution order.

## Scope

This matrix defines lifecycle behavior that must be identical across:
- `BACKTEST`
- `PAPER`
- `LIVE`

Reference deep-dive:
- [Legacy CryptoBot Positions Module - Deep Analysis](/C:/Personal/Projekty/Aplikacje/CryptoSparrow/docs/architecture/legacy-cryptobot-positions-analysis.md)

---

## Global Invariants

- One open position per symbol at a time.
- No direction flip on an already-open symbol.
- Lifecycle checks run in strict deterministic order.
- Event stream (`ENTRY`, `DCA`, `EXIT_*`) is produced by lifecycle engine, not by UI inference.

---

## Canonical Evaluation Order (Per Position, Per Cycle)

1. `DCA` (including DCA affordability check)
2. Close logic by mode:
   - basic mode: `TP -> SL`
   - advanced mode: `TTP -> TSL`
3. `LIQUIDATION` / hard account floor protection

Order is hard contract.

---

## DCA-First Guard (Mandatory)

If there are pending DCA levels and next DCA is still financially possible:
- `TTP`, `TSL`, and `SL` must not close the position yet.

If pending DCA exists but next DCA is not affordable:
- close protections may execute (`TTP`/`TSL`/`SL`) to avoid uncontrolled loss.

This is required for parity with expected strategy semantics in CryptoSparrow.

---

## Trigger Matrix

| Step | Activation Gate | Trigger Condition | Side Effect | Reset Rules |
|---|---|---|---|---|
| `DCA` | `dca.enabled=true`, `dcaCount < maxAdds` | Current leveraged move crosses next configured DCA level | Increase quantity and recalc average entry; increment DCA count | Clear on open/close |
| `TP` (basic) | `close.mode=basic`, `tp.enabled` | Profit reaches TP threshold | Close with `TP` reason | Clear DCA/TTP/TSL on close |
| `SL` (basic) | `close.mode=basic`, `sl.enabled`, DCA-first guard allows close | Price reaches SL threshold | Close with `SL` reason | Clear DCA/TTP/TSL on close |
| `TTP` (advanced) | `close.mode=advanced`, `ttp levels active`, DCA-first guard allows close | Profit retraces by active trailing step from high watermark | Close with `TTP` reason | Clear DCA/TTP/TSL on close |
| `TSL` (advanced) | `close.mode=advanced`, `tsl levels active`, DCA-first guard allows close | Trailing-loss condition reached | Close with `TSL` reason | Clear DCA/TTP/TSL on close |
| `LIQUIDATION` | Futures risk boundary crossed | Mark/price breach of liquidation boundary | Force close with `LIQUIDATION` reason | Clear DCA/TTP/TSL on close |

---

## State Contract

Per-symbol runtime state:
- DCA progression (`currentAdds`, levels used)
- trailing anchor (for TTP/TSL)
- trailing loss limit

State reset on:
- position open,
- position close (any reason).

---

## Shared Engine Contract

Backtest, paper, and live must call one shared lifecycle decision engine with identical inputs:
- side,
- current price context,
- strategy close config,
- DCA config,
- leverage/margin mode,
- affordability flag for next DCA.

Adapters may differ in price source and execution layer, but decision semantics must be identical.

---

## Required Verification

- Unit tests for DCA-first guard and affordability exception.
- Parity tests ensuring same close reason for identical candle/price sequence in:
  - replay/backtest engine,
  - runtime paper/live engine.
- UI parity checks: chart markers and counters must reflect lifecycle events only.
