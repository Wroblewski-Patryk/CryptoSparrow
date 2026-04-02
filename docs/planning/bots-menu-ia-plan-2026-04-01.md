# Bots Menu IA Plan - 2026-04-01

Status: implemented (2026-04-01).

## Objective
Ujednolicić nawigację modułu `Bots` w górnym menu tak, aby działała analogicznie do:
- `Markets`,
- `Strategies`,
- `Backtests`.

Docelowo dropdown `Bots` ma zawierać:
1. `Lista botow`
2. `Dodaj bota`

## Scope
- In scope:
  - aktualizacja struktury menu głównego dla sekcji `Bots`,
  - routing i etykiety pozycji menu (`Lista botow`, `Dodaj bota`),
  - wyrównanie UX z istniejącymi wzorcami dropdownów.
- Out of scope:
  - zmiany logiki runtime botów,
  - zmiany payloadów API,
  - przebudowa ekranów listy/formularza poza koniecznymi korektami linków.

## UX Contract (Target)
1. Klik w `Bots` pokazuje dropdown z dwiema pozycjami:
   - `Lista botow` -> widok listy/monitoringu botów,
   - `Dodaj bota` -> formularz tworzenia bota.
2. Zachowanie i styl dropdownu są spójne z `Markets/Strategies/Backtests`.
3. Active-state i breadcrumbs pozostają poprawne po wejściu przez obie pozycje.

## Routing Contract (Target)
- Canonical list route: `/dashboard/bots`
- Canonical create route: `/dashboard/bots/new`

Jeśli obecnie create-flow jest osadzony na liście:
- w kroku przejściowym `Dodaj bota` może kierować do `/dashboard/bots` z aktywacją widoku create (query/hash/local state),
- preferowany final: dedykowany route `/dashboard/bots/new` z kompatybilnym powrotem do listy.

## Tiny-Commit Sequence (Proposed)
- [x] `BOPS-39 feat(web-nav): add Bots dropdown entries (Lista botow, Dodaj bota) aligned with Markets/Strategies/Backtests IA`
- [x] `BOPS-40 feat(web-bots-routing): wire canonical create/list routes for Bots menu entries with correct active-state and breadcrumb behavior`
- [x] `BOPS-41 test(web-nav): add regression coverage for Bots dropdown structure and route targets`

## Implementation Notes
- Added canonical bots routes in `apps/web/src/ui/layout/dashboard/dashboardRoutes.ts`:
  - `/dashboard/bots`
  - `/dashboard/bots/new`
- Updated header dropdown in `apps/web/src/ui/layout/dashboard/Header.tsx` to expose:
  - `Lista botow`
  - `Dodaj bota`
- Added route entrypoint `apps/web/src/app/dashboard/bots/new/page.tsx` (redirect to canonical list/create surface).
- Added navigation regression assertions in `apps/web/src/ui/layout/dashboard/Header.responsive.test.tsx`.

## Done Criteria
- `Bots` w menu ma dwa czytelne wpisy (`Lista botow`, `Dodaj bota`).
- Nawigacja działa spójnie z innymi modułami.
- Testy frontendowe obejmują nowy kontrakt menu/routingu.
