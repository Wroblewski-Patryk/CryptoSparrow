# Web Deep-Dive: Profile Module

## Metadata
- Module name: `profile`
- Layer: `web`
- Source path: `apps/web/src/features/profile`
- Owner: frontend/account
- Last updated: 2026-04-12
- Related planning task: `DCP-08`

## 1. Purpose and Scope
- Implements user account workspace under `/dashboard/profile`.
- Provides tabbed account management:
  - basic profile + avatar + timezone preference
  - API keys/integration entry point
  - subscription plan visibility
  - security actions (password change, account delete)

Out of scope:
- Exchange connection UI internals (web-exchanges module).
- Admin account management (`/admin/*`).

## 2. Boundaries and Dependencies
- Entry route:
  - `/dashboard/profile` -> `ProfilePage.tsx`
- Depends on:
  - profile APIs (`/dashboard/profile/basic`, `/dashboard/profile/security/*`, `/dashboard/profile/subscription`)
  - upload API (`POST /upload/avatar`)
  - profile API key APIs (`/dashboard/profile/apiKeys*`)
  - i18n provider and toast notifications

## 3. Data and Contract Surface
- Basic profile contracts:
  - read/update user basic data and `uiPreferences.timeZonePreference`
- Security contracts:
  - `PATCH /dashboard/profile/security/password`
  - `DELETE /dashboard/profile/security/account`
- Subscription contract:
  - `GET /dashboard/profile/subscription`
- API key contract surface (via hooks/services):
  - list/add/edit/delete/test API keys

## 4. Runtime Flows
- Basic profile flow:
  1. `useUser` fetches profile with retry policy.
  2. Form updates name/avatar/time zone preference.
  3. Save calls profile update endpoint and syncs local state.
- Avatar flow:
  1. User selects image file.
  2. Client posts multipart payload to `/upload/avatar`.
  3. Returned URL is saved in profile update payload.
- Security flow:
  1. Password change validates confirmation and non-equality with current password.
  2. Account delete requires password and explicit confirmation.

## 5. UI Integration
- Route:
  - `/dashboard/profile`
- Major components:
  - `BasicForm`
  - `Subscription`
  - `Security`
  - `ExchangeConnectionsView` (embedded from exchanges feature)
- Navigation contract:
  - hash-synced tabs for deep linking to profile sections.

## 6. Security and Risk Guardrails
- Sensitive actions require explicit user input (current password / delete confirm).
- Account deletion flow is fail-closed and redirects to login on success.
- API-key testing and mutation routes are called only through authenticated dashboard API client.

## 7. Observability and Operations
- Profile and wallet-critical requests use shared async retry helpers for transient failures.
- User-facing failures are surfaced consistently through toast + inline errors.

## 8. Test Coverage and Evidence
- Primary tests:
  - `ApiKeyForm.test.tsx`
  - `ApiKeysList.test.tsx`
  - `Security.test.tsx`
  - `Subscription.test.tsx`
- Suggested validation command:
```powershell
pnpm --filter web test -- src/features/profile/components/ApiKeyForm.test.tsx src/features/profile/components/ApiKeysList.test.tsx src/features/profile/components/Security.test.tsx src/features/profile/components/Subscription.test.tsx
```

## 9. Open Issues and Follow-Ups
- Replace `window.confirm` in security delete flow with app-level modal guardrail.
- Expand profile tests to cover timezone preference persistence end-to-end.

