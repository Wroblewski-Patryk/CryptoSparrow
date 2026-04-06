# Binance API-Key Onboarding and Troubleshooting Runbook

Scope: secure onboarding and diagnostics for `POST /dashboard/profile/apiKeys/test` and live exchange snapshot usage.

## 1. Preconditions
- User must be authenticated in dashboard.
- Server and client must be running.
- Redis should be available (endpoint has request limiter).
- API keys are stored encrypted at rest; raw secrets are never persisted by test endpoint.

## 2. Binance Key Setup (Recommended)
1. Create a dedicated API key for CryptoSparrow in Binance.
2. Enable required permissions:
   - Spot read permission (for spot scope validation).
   - Futures read/trade permission (for futures scope validation and open position snapshot).
3. Add server egress IP(s) to Binance API key whitelist.
4. Disable any unused write scopes when possible.
5. Save key with clear label in dashboard profile (for example: `binance-main-live`).

## 3. In-App Onboarding Flow
1. Open `/dashboard/profile`.
2. (Optional but recommended) configure `NEXT_PUBLIC_BINANCE_IP_WHITELIST` in `apps/web/.env.local` to display required Binance whitelist IP(s) directly in form.
3. Fill `Nazwa klucza`, `API Key`, `API Secret`.
4. Click `Testuj polaczenie`.
5. Continue only when status is `OK`.
6. Click `Zapisz`.

Note: save is intentionally blocked unless connection test succeeds for current credentials in current form session.

## 4. Test Endpoint Contract
`POST /dashboard/profile/apiKeys/test`

Possible `code` values:
- `OK`
- `INVALID_KEY`
- `INVALID_SECRET`
- `IP_RESTRICTED`
- `MISSING_SPOT_SCOPE`
- `MISSING_FUTURES_SCOPE`
- `NETWORK_TIMEOUT`
- `UNKNOWN`

Response includes:
- `ok` (boolean)
- `code` (stable contract)
- `message` (operator-facing explanation)
- `permissions.spot` / `permissions.futures`

## 5. Troubleshooting by Code
- `INVALID_KEY`: verify copied key value, no truncation/whitespace, regenerate key if needed.
- `INVALID_SECRET`: verify secret value and rotation history; paste fresh secret after key rotation.
- `IP_RESTRICTED`: add current backend egress IP to Binance whitelist; retry after propagation.
- `MISSING_SPOT_SCOPE`: enable Spot permission for the key.
- `MISSING_FUTURES_SCOPE`: enable Futures permission for the key.
- `NETWORK_TIMEOUT`: check outbound connectivity, DNS, Binance latency, and retry later.
- `UNKNOWN`: inspect dashboard logs for `profile.api_key.test_connection` and retry with fresh key pair.

## 6. Validation for Positions Snapshot
After key is saved and validated:
1. Open `/dashboard/positions`.
2. Change `Zrodlo` to `Exchange live snapshot`.
3. Confirm records load and `Ostatnia synchronizacja` timestamp is visible.
4. If error occurs:
   - verify latest API key test result,
   - verify Binance permissions and IP whitelist,
   - retry snapshot after 30-60 seconds.

## 7. Security and Audit Notes
- Test endpoint is authenticated and rate-limited.
- Audit event: `profile.api_key.test_connection`.
- Audit metadata contains only safe fields (`exchange`, `ok`, `code`, `permissions`).
- Raw `apiKey` and `apiSecret` are never written to logs.
