# Dashboard Trades Filter Polish Plan (2026-04-02)

Status: COMPLETED (2026-04-02)

## Kontekst
Po wdrożeniu server-side paginacji/sort/filter dla tabeli historii transakcji na dashboardzie zgłoszone zostały problemy UX:
- zbędna etykieta w nagłówku: `X rekordow • strona A/B`,
- filtr `Action` pokazuje opcję `UNKNOWN`,
- filtrowanie po dacie bywa nieintuicyjne,
- brak wyraźnego trybu `Apply` dla filtrów (obecnie live-on-change),
- blok informacji `Strona X z Y • Wszystkie rekordy: Z` wymaga lepszego layoutu.

## Diagnoza (stan obecny)
1. `UNKNOWN` jest wspierane kontraktowo na backendzie jako fallback dla historycznych/nieklasyfikowalnych rekordów.
2. UI wystawia `UNKNOWN` w selekcie na równi z `OPEN/DCA/CLOSE`, co dla operatora wygląda jak błąd zamiast wyjątku technicznego.
3. Daty są podawane przez `datetime-local` i wysyłane live przy zmianie; to utrudnia kontrolę, bo:
   - użytkownik oczekuje zatwierdzenia filtrów,
   - częściowo wpisana data nie daje przewidywalnego efektu,
   - granica `to` może być rozumiana jako punkt czasu, nie “koniec minuty”.
4. Header tabeli i stopka paginacji mają duplikujący się, “techniczny” copy, który można uprościć.

## Cel UX
- Czytelna, przewidywalna i “operatorska” obsługa filtrów.
- Brak technicznych artefaktów w standardowym flow.
- Spójna i lżejsza prezentacja paginacji/liczności.

## Zakres zmian

### 1) Nagłówek tabeli historii
- Usunąć tekst `X rekordow • strona A/B` z prawego rogu nagłówka sekcji.
- Zastąpić go prostym statusem `Ladowanie...` tylko w trakcie fetch.

### 2) Action filter (`UNKNOWN`)
- Nie pokazywać `UNKNOWN` jako standardowej opcji w selekcie.
- Backend pozostaje kompatybilny (nadal obsługuje `UNKNOWN` w query).
- Gdy rekordy `UNKNOWN` istnieją, pokazać je w tabeli jako badge `UNKNOWN` (diagnostyka), ale bez promowania tego w filtrze głównym.
- Opcjonalnie (fallback operacyjny): dodać ukryty przełącznik debug/admin dla filtrowania `UNKNOWN` (poza MVP scope domyślnym).

### 3) Filtry daty + tryb Apply
- Zmienić model filtrów na:
  - `draftFilters` (edytowane przez usera),
  - `appliedFilters` (wysyłane do API).
- Dodać przycisk `Zastosuj` obok `Reset`.
- API request uruchamiać po `Zastosuj`, nie na każdą zmianę inputów/selectów.
- `Reset` czyści `draft` i `applied`, wraca na stronę 1.
- Dla pola `to` stosować inkluzywne domknięcie zakresu (np. koniec minuty/sekundy), aby użytkownik widział rekordy z wybranej końcówki zakresu.

### 4) Stopka paginacji (copy/layout)
- Zastąpić tekst `Strona X z Y • Wszystkie rekordy: Z` przez lżejszy układ:
  - badge/kapsuła: `Rekordy: Z`,
  - badge/kapsuła: `Strona X/Y`.
- Utrzymać selektor `Wierszy` i przyciski `Poprzednia/Nastepna`.

### 5) Sortowanie kolumn (tri-state)
- Ujednolicić zachowanie kliknięcia w nagłówek kolumny:
  - 1. klik: sort aktywny na kolumnie (`asc`),
  - 2. klik: zmiana kierunku (`desc`),
  - 3. klik: wyłączenie sortowania (powrót do domyślnego porządku backendu).
- Zmiana kolumny zawsze zaczyna od `asc`.
- Po wyłączeniu sortu usunąć parametry `sortBy/sortDir` z requestu.

## Task Breakdown (tiny commits)
- `DBRT-06 feat(web-dashboard): simplify trades header and pagination summary presentation`
- `DBRT-07 feat(web-dashboard): introduce apply/reset filter workflow (draft vs applied state)`
- `DBRT-08 feat(web-dashboard): hide UNKNOWN from action filter while keeping UNKNOWN row rendering`
- `DBRT-09 test(web-dashboard): add regression tests for apply-flow, date-range behavior, and UNKNOWN filter UX contract`
- `DBRT-10 feat(web-dashboard): implement tri-state column sorting cycle (asc -> desc -> none) for trades table`

## Kryteria akceptacji
1. Header tabeli nie pokazuje już `X rekordow • strona A/B`.
2. Selekt `Action` zawiera tylko `Otwarcie`, `DCA`, `Zamkniecie`.
3. Po edycji filtrów lista nie odświeża się, dopóki user nie kliknie `Zastosuj`.
4. `Reset` przywraca pełną listę i paginację od strony 1.
5. Informacja o paginacji/liczności jest czytelna, bez “technicznego” zlepku.
6. Testy komponentu pokrywają nowy flow i przechodzą.
7. Klik nagłówka kolumny realizuje pełny cykl `asc -> desc -> none`, a stan `none` nie wysyła `sortBy/sortDir`.

## Ryzyka
- Zmiana live-filter -> apply-filter może wymagać korekty testów i pamięci stanu auto-refresh.
- Należy upewnić się, że auto-refresh nie nadpisuje `draftFilters`, a odświeża tylko dane dla `appliedFilters`.
