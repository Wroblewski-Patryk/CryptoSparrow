# Exchanges Module Refresh Plan (2026-04-02)

## Goal
Przebudowac IA i UX modulu `Exchanges`, tak aby:
- usunac wpis `Connections` z menu `Exchanges`,
- zostawic tylko:
  - `Lista pozycji`,
  - `Dodaj pozycje`,
- widok listy byl czytelny dla operatora (najpierw pozycje z gieldy, nizej ordery z gieldy),
- formularz `Dodaj pozycje` byl baza pod reczne otwieranie pozycji (docelowo z wykresem i wskaznikami strategii).

## Scope Assumptions
- Nie zmieniamy logiki bot/backtest.
- Nie usuwamy istniejacych endpointow `orders/positions`; dokladamy warstwe UX/IA i ewentualne brakujace read endpointy.
- Stare trasy ` /dashboard/orders` i ` /dashboard/positions` zostaja jako kompatybilne aliasy/redirecty, ale znikaja z menu.

## Commit Plan (Tiny Tasks)

### EXCH-01 docs(ia): lock Exchanges IA contract
**Zmiany**
- Zapisac docelowy kontrakt IA:
  - `Exchanges -> Lista pozycji`
  - `Exchanges -> Dodaj pozycje`
  - bez `Connections` w menu.
- Potwierdzic kolejnosc sekcji na liscie:
  1. tabela pozycji,
  2. tabela orderow.

**Pliki**
- `docs/architecture/dashboard-route-map.md`
- `docs/modules/system-modules.md`
- `docs/planning/open-decisions.md` (jezeli potrzebna adnotacja decyzyjna)

---

### EXCH-02 feat(web-nav): replace Exchanges dropdown entries
**Zmiany**
- W `Header` usunac `Connections`.
- Dodac tylko:
  - `Lista pozycji` -> `/dashboard/exchanges/list`
  - `Dodaj pozycje` -> `/dashboard/exchanges/create`
- Zaktualizowac `dashboardRoutes`.

**Pliki**
- `apps/web/src/ui/layout/dashboard/dashboardRoutes.ts`
- `apps/web/src/ui/layout/dashboard/Header.tsx`
- `apps/web/src/i18n/translations.ts` (nowe klucze nawigacyjne, jesli potrzebne)

---

### EXCH-03 feat(web-routing): introduce exchanges list/create routes
**Zmiany**
- Dodac strony:
  - `/dashboard/exchanges/list`
  - `/dashboard/exchanges/create`
- ` /dashboard/exchanges` ustawic jako redirect do ` /dashboard/exchanges/list`.
- Zachowac kompatybilnosc:
  - ` /dashboard/orders` -> redirect do sekcji orders w nowym widoku exchanges list,
  - ` /dashboard/positions` -> redirect do sekcji positions w nowym widoku exchanges list.

**Pliki**
- `apps/web/src/app/dashboard/exchanges/page.tsx`
- `apps/web/src/app/dashboard/exchanges/list/page.tsx` (nowy)
- `apps/web/src/app/dashboard/exchanges/create/page.tsx` (nowy)
- `apps/web/src/app/dashboard/orders/page.tsx`
- `apps/web/src/app/dashboard/positions/page.tsx`

---

### EXCH-04 feat(api): add exchange orders snapshot endpoint
**Zmiany**
- Dodac endpoint read-only dla aktualnych orderow z gieldy (analogicznie do `positions/exchange-snapshot`):
  - np. `GET /dashboard/orders/exchange-snapshot`.
- Uzywac zapisanych i zweryfikowanych API keys usera.
- Znormalizowac payload pod tabele frontendowa.

**Pliki (API)**
- `apps/api/src/modules/orders/orders.controller.ts`
- `apps/api/src/modules/orders/orders.service.ts`
- `apps/api/src/modules/orders/orders.routes.ts`
- `apps/api/src/modules/orders/orders.types.ts` (jesli potrzebne filtry)
- test e2e: `apps/api/src/modules/orders/*exchangeSnapshot*.test.ts` (nowy)

---

### EXCH-05 feat(web-exchanges): build human-readable exchange operations board
**Zmiany**
- Stworzyc wspolny board dla `Exchanges/list`:
  - sekcja A: pozycje z gieldy (aktualne),
  - sekcja B: ordery z gieldy (aktualne).
- Czytelne naglowki, stany loading/empty/error.
- Minimum filtrow: symbol + refresh.

**Pliki (WEB)**
- `apps/web/src/features/exchanges/components/ExchangeOperationsBoard.tsx` (nowy)
- `apps/web/src/features/exchanges/services/exchanges.service.ts` (nowy)
- `apps/web/src/features/exchanges/types/exchanges.type.ts` (nowy)
- `apps/web/src/app/dashboard/exchanges/list/page.tsx`

---

### EXCH-06 feat(web-create): add-position form scaffold (v1)
**Zmiany**
- Dodac formularz `Dodaj pozycje` w stylu `Markets/Strategies`:
  - symbol,
  - side,
  - typ zlecenia (na start `MARKET` + opcjonalnie `LIMIT`),
  - qty / margin input,
  - tryb (`PAPER`/`LIVE`) + wymagane potwierdzenie ryzyka dla LIVE.
- Podpiecie do istniejacego open-order API.
- Czytelna walidacja i komunikaty.

**Pliki**
- `apps/web/src/features/exchanges/components/AddPositionForm.tsx` (nowy)
- `apps/web/src/features/exchanges/services/exchanges.service.ts`
- `apps/web/src/app/dashboard/exchanges/create/page.tsx`

---

### EXCH-07 feat(web-create-chart): chart + strategy-indicator overlay for manual entry (phase 2)
**Zmiany**
- W `Dodaj pozycje` dodac sekcje wykresu wybranego rynku.
- Dodac mozliwosc wyboru strategii jako zrodla overlay wskaznikow.
- Pokazac tylko odczyt (bez zmiany logiki strategii).

**Pliki (docelowe, do doprecyzowania przy implementacji)**
- `apps/web/src/features/exchanges/components/AddPositionChart.tsx` (nowy)
- reuse komponentow backtest/markets chart tam, gdzie mozliwe.

---

### EXCH-08 test(web+api): regression coverage
**Zmiany**
- Testy nawigacji:
  - brak `Connections`,
  - obecne `Lista pozycji` i `Dodaj pozycje`.
- Testy listy:
  - pozycje/ordery renderuja poprawnie stany loading/empty/error/success.
- Testy formularza:
  - walidacja danych,
  - poprawne payloady dla PAPER/LIVE.
- API e2e:
  - exchange orders snapshot success/failure paths.

## Acceptance Criteria
- W menu `Exchanges` nie ma `Connections`.
- `Exchanges` ma tylko dwa wpisy: `Lista pozycji` i `Dodaj pozycje`.
- `Lista pozycji` pokazuje:
  - aktualne pozycje z gieldy (gorna tabela),
  - aktualne ordery z gieldy (dolna tabela).
- `Dodaj pozycje` dziala jako formularz analogiczny do innych modulow.
- Stare trasy `orders/positions` nie psuja deep-linkow (alias/redirect dziala).

## Risks and Mitigations
- **Ryzyko:** brak jednolitego endpointu order snapshot z gieldy.
  - **Mitigacja:** dodac `orders/exchange-snapshot` analogiczny do positions.
- **Ryzyko:** nadmiar duplikacji komponentow `orders/positions`.
  - **Mitigacja:** wydzielic wspolny `features/exchanges/*` i stopniowo migrowac.
- **Ryzyko:** niejasnosc LIVE manual open vs bot context.
  - **Mitigacja (domyslna):** na start LIVE open z wymaganym `riskAck`; jesli backend wymaga `botId`, formularz jawnie go wymusza.

