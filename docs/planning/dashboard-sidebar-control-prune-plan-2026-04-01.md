# Dashboard Sidebar Control Prune Plan - 2026-04-01

Status: implemented (2026-04-01).

## Objective
Uprościć panel boczny `Bot runtime` na dashboardzie poprzez usunięcie zbędnych przycisków:
- `Odswiez`
- `Boty runtime`

Powód:
- dashboard i tak działa na auto-refresh,
- nawigacja do modułu Bots jest dostępna w głównym menu,
- redukujemy szum i zwiększamy czytelność sekcji runtime/ryzyko.

## Scope
- In scope:
  - usunięcie obu CTA z karty sidebaru na dashboardzie,
  - zachowanie istniejącego auto-refresh bez zmian,
  - zachowanie całej logiki backend/API bez zmian.
- Out of scope:
  - zmiana odświeżania interwału,
  - zmiana layoutu innych sekcji dashboardu,
  - zmiana nawigacji globalnej.

## UX Contract (Target)
1. W karcie `Bot runtime` nie ma lokalnych przycisków akcji.
2. Operator otrzymuje pasywny, zawsze aktualny podgląd statusu bez ręcznych CTA.
3. Przepływ "wejście do pełnego modułu Bots" odbywa się wyłącznie przez górne menu.

## Tiny-Commit Sequence (Proposed)
- [x] `BOPS-37 feat(web-dashboard): remove redundant sidebar actions (Odswiez/Boty runtime) from dashboard Bot runtime card`
- [x] `BOPS-38 test(web-dashboard): update dashboard component tests for no-local-CTA runtime sidebar contract`

## Implementation Notes
- Removed local sidebar CTA buttons from dashboard runtime card in `apps/web/src/features/dashboard-home/components/HomeLiveWidgets.tsx`.
- Kept auto-refresh behavior unchanged (5s polling).
- Regression coverage kept green in dashboard component tests.

## Done Criteria
- Przyciski `Odswiez` i `Boty runtime` znikają z dashboardowego sidebaru.
- Auto-refresh nadal działa.
- Testy komponentowe dashboardu odzwierciedlają nowy kontrakt UX.
