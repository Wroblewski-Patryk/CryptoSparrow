# Quality Gate Evidence - 2026-03-22

Scope: `test(quality-gate)` core regression gate from Phase 11.

## Commands

```bash
pnpm --filter web test -- src/i18n/I18nProvider.test.tsx src/i18n/useLocaleFormatting.test.tsx
pnpm --filter api test -- src/modules/auth/auth.jwt.test.ts src/middleware/requireAuth.test.ts src/modules/auth/auth.e2e.test.ts src/modules/strategies/strategies.e2e.test.ts src/modules/isolation/data-isolation.e2e.test.ts src/modules/engine/preTrade.e2e.test.ts
```

## Result

- Client suites: `2/2` passed (`4` tests total).
- Server suites: `6/6` passed (`19` tests total).
- Gate status: `PASS`.

## Regression Fixes Applied

- Updated i18n provider test assertions to match current language switcher contract (`Language/Jezyk` label, `EN/PL` active summary behavior).
- Updated auth rotation middleware test to create a real user record before requesting protected dashboard route.

