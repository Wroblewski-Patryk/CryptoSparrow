# i18n Inventory - Dashboard + Bots + Header Menu (2026-04-02)

Status: baseline audit snapshot for `LFIN-08`

## Goal
- Identify hardcoded operator-facing strings that should be moved to translation keys (EN/PL parity).

## Audited Areas
- `apps/web/src/features/dashboard-home/**`
- `apps/web/src/features/bots/**`
- `apps/web/src/ui/layout/dashboard/Header.tsx`

## Findings

### 1) Dashboard Home (`HomeLiveWidgets.tsx`)
- Hardcoded section labels (examples):
  - `Otwarte pozycje`
  - `Historia transakcji`
  - `Live checks`
  - `Bot runtime i ryzyko`
- Hardcoded table headers and filter labels:
  - `Symbol`, `Side`, `Action`, `Od`, `Do`, `Wierszy`, `Poprzednia`, `Nastepna`
- Hardcoded state copy:
  - `Ladowanie...`
  - `Brak historii transakcji.`
  - `Brak danych sygnalowych.`

### 2) Bots Runtime (`BotsManagement.tsx` and related components)
- Mixed hardcoded copy in runtime monitoring sections:
  - open positions/history/live-check labels,
  - operational hints and empty states,
  - table labels and action text.
- Existing i18n usage is partial; many runtime-specific labels still live inline in JSX.

### 3) Header Menu (`Header.tsx`)
- Menu already partially keyed, but there are still locale-specific fragments and inline literals in some nav/account items.
- Goal state: all visible menu labels sourced from translation keys only.

## Prioritized Migration Order
1. Dashboard home runtime widget labels/states.
2. Bots runtime monitoring labels/states.
3. Header/menu remaining inline labels.

## Exit Criteria for Audit
- Every visible user-facing string in above scope is either:
  - `t("...")` key reference, or
  - non-translatable data value (symbol, number, timestamp, status enum rendered through mapped key).

