# Numeric Input Policy (Locale-Safe)

Status: canonical input contract (2026-04-02)

## Objective
- Ensure deterministic numeric parsing and validation across strategy/bot forms.
- Prevent locale-related ambiguity (`1,25` vs `1.25`) and silent `NaN` behavior.

## Parsing Rules
1. UI accepts both `,` and `.` as decimal separator for decimal fields.
2. Input is normalized to `.` before parse.
3. Invalid formats (multiple separators, non-numeric tokens) are rejected with field error.
4. No silent coercion to `0` on invalid input.

## Precision Matrix

### Decimal fields (max 2 places)
- Percent-like values:
  - wallet risk,
  - TP/SL percent,
  - TTP/TSL triggers and trail percentages,
  - DCA percentage and multiplier-like decimal configs.

### Integer fields (0 places)
- Counts/limits/windows:
  - max open positions,
  - cooldown counts,
  - integer timing/candle limits where contract requires whole numbers.

## UX Rules
- Input controls:
  - decimal fields: `inputMode="decimal"` and matching `step` (e.g. `0.01`),
  - integer fields: integer step and integer-only validation.
- Validation timing:
  - soft normalization while typing,
  - strict validation on blur and submit.
- Error messages:
  - localized (`pl`/`en`),
  - explicit reason: invalid format, too many decimals, out of range.

## Backend Alignment
- API validation remains authoritative (zod/schema constraints).
- Frontend validation should mirror backend constraints to fail fast and clearly.

## Test Expectations
- Parser unit tests must cover:
  - comma decimal,
  - dot decimal,
  - malformed input,
  - precision overflow.
- Form tests must verify:
  - correct normalization on submit,
  - proper error display for invalid values,
  - no hidden coercion to unintended values.

