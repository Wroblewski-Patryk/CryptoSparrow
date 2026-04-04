# Dashboard Trade-History Financial Semantics Contract

Status: Canonical (BOPS-60)  
Last updated: 2026-04-04  
Scope: Dashboard Control Center + Bots runtime trade-history tables.

## Goal

Lock one deterministic UI/API interpretation for trade-history rows so operators always read:

- what happened (`OPEN | DCA | CLOSE | UNKNOWN`),
- what capital basis is shown (`Margin`),
- when `Realized PnL` must be visible vs hidden.

## Canonical Row Semantics

### `Action`

- `OPEN`: first fill that opens a position.
- `DCA`: fill that increases same-direction exposure for already open position.
- `CLOSE`: fill that closes/reduces position to zero in MVP dashboard semantics.
- `UNKNOWN`: legacy/backfill fallback only (should be rare).

### `Margin` (Capital Column)

- Dashboard and Bots history use `Margin` as canonical capital column.
- `Margin` is rendered from row payload, never guessed in UI.
- `Notional` can exist in deeper drill-down views, but not as primary dashboard history capital value.

## Financial Display Contract

### `Fee`

- `Fee` is always rendered as currency value when available (`$0.00` is valid zero).
- If fee is truly unavailable/pending in payload, UI may show `"-"` (never fake non-zero value).

### `Realized PnL`

- `OPEN`: show `"-"` (blank realized result for opening trade).
- `DCA`: show `"-"` (DCA does not finalize realized result in table semantics).
- `CLOSE`: show realized value from payload (including `$0.00` when neutral close).
- `UNKNOWN`: safe fallback `"-"`.

This rule is mandatory for both Dashboard and Bots history views.

## API/UI Parity Rules

1. The same trade id must resolve to the same action in Dashboard and Bots.
2. `Margin` column meaning must stay identical in both views.
3. `Realized PnL` visibility must follow action-gated rules above in both views.
4. UI must not locally infer realized values for `OPEN/DCA`; it follows payload + action contract.

## Non-Goals

- No change to execution logic, fill accounting, or PnL formulas.
- No schema redesign in this contract.
- No chart-level semantics in this contract.

## Regression Expectations

Keep/extend tests so both Dashboard and Bots assert:

- `OPEN/DCA` rows render `Realized PnL` as `"-"`,
- `CLOSE` renders payload value,
- `Margin` remains the primary capital column,
- action mapping and row semantics are identical across both modules.
