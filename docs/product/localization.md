# Localization Reference

Localization baseline is defined in:
- `product.md`
- `../ux/ui-ux-foundation.md`
- `../ux/localization-qa.md`

Current policy:
- English (`en`) is default.
- Polish (`pl`) is MVP secondary locale.
- UI strings must use translation keys.

Current backtest coverage (as of 2026-03-30):
- `dashboard/backtests/create` localized (labels, placeholders, validation, toasts).
- `dashboard/backtests/list` localized (table metadata and view states).
- `dashboard/backtests/:id` localized (run header, tabs, KPI strip, markets pair stats, trades table labels, fallback/error copy).
