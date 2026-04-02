# Typecheck Adoption Plan (2026-04-02)

Status: COMPLETED (2026-04-02)

## Cel
- Wprowadzić spójny, szybki gate typu `typecheck` dla całego monorepo (`api` + `web`).
- Zapewnić, że każdy większy task można zweryfikować nie tylko testami runtime, ale też statycznie.

## Zakres
- `apps/api`: dodać skrypt `typecheck` (`tsc --noEmit`).
- `apps/web`: dodać skrypt `typecheck` (`tsc --noEmit`).
- root `package.json`: dodać agregujący skrypt `typecheck` uruchamiający oba pakiety.
- opcjonalnie CI: dodać krok `typecheck` do standardowej ścieżki jakości.

## Kontrakt wykonania
1. Skrypty muszą działać lokalnie przez `pnpm --filter api typecheck`, `pnpm --filter web typecheck`.
2. `pnpm typecheck` w root ma kończyć się sukcesem przy zielonym stanie repo.
3. Brak zmian funkcjonalnych (tylko tooling/quality gate).

## Kryteria akceptacji
- Komendy:
  - `pnpm --filter api typecheck` -> PASS
  - `pnpm --filter web typecheck` -> PASS
  - `pnpm typecheck` -> PASS
- Dokumentacja planowania zawiera osobne taski tiny-commit dla wdrożenia i testów regresji.

## Evidence
- `pnpm --filter api run typecheck` -> PASS
- `pnpm --filter web run typecheck` -> PASS
- `pnpm run typecheck` -> PASS

## Ryzyka i mitigacje
- Ryzyko: ujawnienie istniejących zaległych błędów TS.
  - Mitigacja: wdrożenie etapowe, najpierw skrypty + szybka analiza, potem poprawki tylko tam gdzie blokują gate.
- Ryzyko: różnice konfiguracji TS między appkami.
  - Mitigacja: utrzymać `--noEmit` i istniejące `tsconfig` bez rozszerzania zakresu lint/type rules.
