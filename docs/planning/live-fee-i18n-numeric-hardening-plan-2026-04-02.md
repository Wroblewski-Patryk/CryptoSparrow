# LIVE Fee + i18n + Numeric Input Hardening Plan (LFIN) - 2026-04-02

Status: planning only (no implementation in this step).

## Objective
Deliver three consistency tracks that directly improve runtime trust:
1. exact LIVE fee from exchange fills (not fee-rate approximation),
2. full i18n coverage for `Dashboard` + `Bots` + main menu,
3. locale-safe, debiloodporne numeric inputs (comma/dot handling + deterministic precision).

## Scope
- In scope:
  - exchange fill-fee ingestion contract and persistence,
  - API/runtime/UI alignment for fees, realized pnl, and history,
  - translation-key rollout in dashboard/bots/menu,
  - numeric input parser/validation behavior for strategy and related forms.
- Out of scope:
  - new exchange adapters implementation (beyond Binance contract readiness),
  - strategy decision logic changes,
  - large UX redesign outside text/validation/consistency.

---

## Current-State Audit (Repo-Based)

### A) LIVE Fee
- runtime currently computes fee from fee-rate env fallback (`executionOrchestrator.service.ts`):
  - `resolveRuntimeTakerFeeRate(...)`,
  - `computeTradeFee(...)`.
- `CcxtFuturesConnector` returns order basics + `raw`, but no normalized fills/commissions contract.
- DB has only aggregate `Order.fee` and `Trade.fee` (nullable), no first-class fill records.
- Result: LIVE can diverge from real exchange commissions and rebate/tier behavior.

### B) i18n Dashboard/Bots/Menu
- `translations.ts` already covers significant dashboard keys.
- `dashboard-home` and `bots` components still contain many hardcoded labels/copy.
- `Header.tsx` still mixes translation keys with locale-switched inline label dictionaries.
- Result: mixed PL/EN surfaces and inconsistent translation contract.

### C) Numeric Inputs (comma/dot, precision, validation)
- strategy forms use many direct `Number(e.target.value)` conversions.
- browser `type="number"` + locale differences may break comma decimals.
- no centralized parser/formatter policy for decimal values.
- no uniform precision contract at input layer.
- Result: potential NaN drift, inconsistent UX, and avoidable validation bugs.

---

## Target Contracts

## 1) LIVE Fee Truth Contract
- Source of truth for LIVE commission: exchange fills/trades for executed order.
- `PAPER`/`BACKTEST`: continue deterministic simulator fee model.
- LIVE fallback hierarchy (adapter contract):
  1. inline fills from `createOrder` response (if present),
  2. `fetchOrder(id, symbol)` with embedded trade/fee details,
  3. `fetchMyTrades(symbol, since, limit)` filtered by `orderId`.
- Persist both:
  - normalized totals used by runtime (`fee`, `feeCurrency`, `effectiveFeeRate` when derivable),
  - raw exchange fill metadata for audit/reconciliation.
- If fills are delayed: mark order/trade as `feePending` and reconcile asynchronously.

## 2) i18n Contract (Dashboard/Bots/Menu)
- No hardcoded operator-facing copy in:
  - `apps/web/src/features/dashboard-home/**`,
  - `apps/web/src/features/bots/**`,
  - `apps/web/src/ui/layout/dashboard/Header.tsx`.
- All labels/messages/table headers/chips/statuses via translation keys.
- Dynamic values remain interpolated in translation strings.
- EN and PL parity required for all newly added keys.

## 3) Numeric Input Contract
- Canonical parsing:
  - accept both `,` and `.` as decimal separators in UI input,
  - normalize to `.` before numeric parse,
  - reject malformed values with clear field-level error.
- Precision policy:
  - decimal risk/percent/multiplier fields: max 2 decimal places,
  - integer counters (times, limits, leverage where integer): 0 decimals.
- UX behavior:
  - validation on change/blur + hard validation on submit,
  - localized helper/error messages (`pl`/`en`),
  - no silent NaN fallback.

---

## Data/Schema Plan (LIVE Fee)

Recommended minimal-forward model:
- Add first-class execution fill entity (or equivalent JSON column if migration-light path chosen):
  - `OrderFill`:
    - `orderId`, `tradeId?`, `exchangeTradeId`,
    - `price`, `quantity`, `notional`,
    - `feeCost`, `feeCurrency`, `feeRate?`,
    - `executedAt`,
    - `raw` (JSON).
- Extend `Order`/`Trade` with reconciliation fields:
  - `feeSource` (`ESTIMATED` | `EXCHANGE_FILL`),
  - `feePending` boolean,
  - `feeCurrency` (nullable),
  - `exchangeTradeId` (nullable, where applicable).

Backward compatibility:
- existing rows remain valid (`feeSource=ESTIMATED` default where needed),
- no break for historical PAPER/BACKTEST data.

---

## Runtime/Adapter Plan (LIVE Fee)

1. Extend connector types (`ccxtFuturesConnector.types.ts`) with normalized fill payload.
2. Add connector methods for reconciliation:
   - `fetchOrderWithFills(...)`,
   - `fetchTradesForOrder(...)`.
3. Implement `LiveFillReconciliationService`:
   - resolves final fill list and total fee,
   - retries within bounded window,
   - stores partial state if delayed.
4. Integrate into order lifecycle:
   - after open/close order placement in LIVE path, trigger reconciliation,
   - update order/trade/telemetry with exchange-true fees.
5. Keep deterministic fallback for temporary exchange lag:
   - mark fee pending, do not block execution loop.

---

## Web/API Plan (LIVE Fee Visibility)

- API payloads for runtime history/dashboard/bots include:
  - `fee`, `feeCurrency`, `feeSource`, `feePending`.
- Table rendering rules:
  - never blank `Fee`,
  - show value + source badge when useful (`EST` vs `EXCH`),
  - for pending reconciliation show explicit pending marker instead of `-`.

---

## i18n Rollout Plan (Dashboard + Bots + Menu)

1. Audit and key map:
   - extract all hardcoded copy from dashboard-home, bots, header.
2. Extend `translations.ts` schema:
   - add `dashboard.bots.*`,
   - add missing menu/group labels under nav/common namespaces.
3. Replace runtime strings in components with `t(...)`.
4. Normalize shared formatting:
   - date/currency/percent formatting paths already used by i18n-aware helpers.
5. Add regression tests:
   - smoke for PL/EN render in dashboard-home and bots major panels,
   - header/menu labels parity in both locales.

---

## Numeric Input Hardening Plan

1. Add shared parsing utility (`features/*/utils/numberInput.ts` or common ui utils):
   - `normalizeDecimalInput(string)`,
   - `parseLocaleNumber(string, {decimals,max,min,integerOnly})`.
2. Replace direct `Number(...)` in strategy form sections with parsed value contract.
3. Field policy table (implementation checklist):
   - `walletRisk`, `tp/sl`, `ttp/tsl percent/arm`, `dca percent/multiplier` -> decimals (max 2),
   - counters/times/limits -> integer.
4. Input controls:
   - `inputMode="decimal"` for decimal fields,
   - explicit `step` matching precision policy.
5. Validation messages:
   - invalid separator/format,
   - too many decimals,
   - out-of-range values.
6. Tests:
   - unit parser tests (comma, dot, malformed, precision clipping/reject),
   - component tests for key strategy form fields.

---

## Tiny-Commit Sequence (Proposed)

### Track A - LIVE Fee Exactness
- [ ] `LFIN-01 docs(contract): lock LIVE fee source-of-truth and reconciliation fallback hierarchy`
- [ ] `LFIN-02 feat(db): add fill-level persistence and fee-source fields for order/trade`
- [ ] `LFIN-03 feat(exchange): extend ccxt connector with normalized fill/trade retrieval methods`
- [ ] `LFIN-04 feat(runtime): add live fill reconciliation service and persist exchange fee totals`
- [ ] `LFIN-05 feat(api): expose feeSource/feePending/feeCurrency in runtime history payloads`
- [ ] `LFIN-06 feat(web): render fee source/pending state in dashboard+bots history tables`
- [ ] `LFIN-07 test(api+runtime): add reconciliation success/delayed/error contract tests`

### Track B - i18n Dashboard/Bots/Menu
- [ ] `LFIN-08 audit(i18n): produce hardcoded-copy inventory for dashboard-home+bots+header`
- [ ] `LFIN-09 feat(i18n): extend translations schema/keys for bots dashboard and menu labels`
- [ ] `LFIN-10 refactor(web): migrate dashboard-home strings to translation keys`
- [ ] `LFIN-11 refactor(web): migrate bots module strings to translation keys`
- [ ] `LFIN-12 refactor(web-nav): remove locale inline dictionaries in Header and use i18n keys only`
- [ ] `LFIN-13 test(web-i18n): add EN/PL regression coverage for dashboard+bots+menu`

### Track C - Numeric Input Safety
- [ ] `LFIN-14 docs(contract): lock numeric parsing and precision policy (comma/dot + decimals/int fields)`
- [ ] `LFIN-15 feat(web-utils): add shared locale-safe numeric parser/validator utility`
- [ ] `LFIN-16 refactor(web-strategy): replace direct Number(...) parsing in strategy form sections`
- [ ] `LFIN-17 feat(web-validation): add field-level validation copy for decimal/int range and precision`
- [ ] `LFIN-18 test(web): add parser and strategy-form numeric input regression tests`

---

## Risks and Mitigations

- Risk: exchange APIs may return incomplete fee data immediately after execution.
  - Mitigation: async reconciliation window + pending state + retry/backoff.
- Risk: introducing fill model may impact existing runtime queries.
  - Mitigation: additive migration + backward-compatible default fields.
- Risk: i18n refactor can break copy in less-used states.
  - Mitigation: PL/EN smoke tests for loading/error/empty/data states.
- Risk: strict numeric validation may frustrate users during typing.
  - Mitigation: soft normalize on input, strict validate on blur/submit, clear helper text.

---

## Done Criteria
- LIVE fees for LIVE mode come from exchange fills/trades and are persisted as such.
- Dashboard/Bots/Header display no mixed hardcoded language copy.
- Numeric fields accept comma and dot safely, enforce precision policy, and show clear localized validation.
- Regression suites cover all three tracks.
