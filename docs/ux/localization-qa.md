# Localization QA Checklist (EN/PL)

Use this checklist before release candidates and after any dashboard copy refactor.

## 1. Translation Key Integrity
1. Run translation parity test (`EN` vs `PL` keys).
2. Verify no hardcoded user-facing strings in modified modules.
3. Confirm fallback behavior returns EN key values only when expected.

## 2. Locale Formatting Verification
1. Date and date-time formatting:
   - EN uses `en-US` style.
   - PL uses `pl-PL` style.
2. Number, currency, and percent formatting:
   - decimal separators match locale.
   - currency symbols/codes display correctly.
3. Null/invalid values render placeholders (`-`, `--:--`) without crashes.

## 3. Manual UI Sweep (EN then PL)
1. Dashboard shell (header, footer, navigation).
2. Markets, strategies, bots, orders, positions.
3. Backtests, reports, logs, exchanges.
4. Error/empty/loading/degraded states.

## 3a. Backtests Focus Checks (EN then PL)
1. Backtests list:
   - table headers/status labels/filter labels are translated,
   - empty/loading/error states are translated.
2. Backtest create form:
   - field labels/placeholders/validation/toasts are translated,
   - strategy/market-group no-option fallback labels are translated.
3. Backtest details:
   - run header labels, tabs, KPI labels, and stage labels are translated,
   - `Summary` chart empty-state messages are translated,
   - `Markets` pair stats card labels are translated,
   - `Trades` table headers and exit-reason badges are translated.

## 4. Regression Gates
- Client test suite green.
- No missing-key visual regressions.
- No locale switch flicker or language persistence regression.
