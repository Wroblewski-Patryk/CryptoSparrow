# Web Deep-Dive: Strategies Module

## Metadata
- Module name: `strategies`
- Layer: `web`
- Source path: `apps/web/src/features/strategies`
- Owner: frontend/strategy-builder
- Last updated: 2026-04-12
- Related planning task: `DCP-09`

## 1. Purpose and Scope
- Owns strategy authoring and maintenance views:
  - list strategies
  - create strategy
  - edit strategy
- Provides form sections for open/close/additional/indicator rules and preset utilities.

Out of scope:
- Runtime execution of strategy signals.
- Backtest orchestration and report rendering.

## 2. Boundaries and Dependencies
- Route entrypoints:
  - `/dashboard/strategies/list`
  - `/dashboard/strategies/create`
  - `/dashboard/strategies/:id/edit` (`/dashboard/strategies/:id` redirects)
- Depends on:
  - strategies API (`features/strategies/api/strategies.api.ts`)
  - form mapping helpers and indicator taxonomy utilities
  - shared i18n and toast error handling

## 3. Data and Contract Surface
- API contracts:
  - list/get/create/update/delete strategy
  - list indicator metadata
- Form contracts:
  - `StrategyFormState` <-> API DTO mapping via `StrategyForm.map`
  - numeric input normalization and validation helpers

## 4. Runtime Flows
- Create flow:
  1. Build strategy in form sections.
  2. Submit mapped payload.
  3. Redirect to edit route for created strategy.
- Edit flow:
  1. Load existing strategy by id.
  2. Map DTO to form model.
  3. Save updates with explicit error mapping (including active-bot lock).

## 5. UI Integration
- Main components:
  - `StrategiesList`
  - `StrategyForm`
  - `StrategyPresetPicker`
- Section components:
  - `Basic`, `Open`, `Close`, `Indicators`, `Additional`

## 6. Security and Risk Guardrails
- Update path surfaces server guard when strategy is attached to active bot.
- Input normalization reduces malformed rule payloads reaching API.

## 7. Observability and Operations
- Preset and taxonomy utilities keep indicator configuration deterministic across forms.
- Error toasts carry parsed backend message context for operator recovery.

## 8. Test Coverage and Evidence
- Primary tests:
  - `StrategyPresetPicker.test.tsx`
  - `StrategyFormSections/Indicators.test.tsx`
  - `strategyPresets.test.ts`
  - `StrategyForm.map.test.ts`
  - `strategyNumericInput.test.ts`
- Suggested validation command:
```powershell
pnpm --filter web test -- src/features/strategies/components/StrategyPresetPicker.test.tsx src/features/strategies/components/StrategyFormSections/Indicators.test.tsx src/features/strategies/presets/strategyPresets.test.ts src/features/strategies/utils/StrategyForm.map.test.ts src/features/strategies/utils/strategyNumericInput.test.ts
```

## 9. Open Issues and Follow-Ups
- Migrate remaining static labels to full i18n coverage for complete locale parity.
- Add richer form-level dirty-state and conflict handling for concurrent edits.

