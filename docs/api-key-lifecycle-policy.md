# API Key Lifecycle Policy (V1)

## Objective
Define required handling for exchange API keys used by CryptoSparrow.

## Lifecycle States
1. `Created`: key pair added by user and encrypted at rest.
2. `Active`: key is available for execution paths.
3. `Rotated`: key pair replaced through rotate flow.
4. `Revoked`: key removed from CryptoSparrow and no longer usable.

## Mandatory Rules
- Keys and secrets must never be stored in plaintext.
- API responses must never expose full key/secret values.
- Ownership checks are required for create, rotate, and revoke actions.
- Rotation should be performed at least every 90 days.
- Compromised key suspicion requires immediate revoke and replacement.

## Product Flows
- Create: `POST /dashboard/profile/apiKeys`
- Rotate: `POST /dashboard/profile/apiKeys/:id/rotate`
- Revoke: `POST /dashboard/profile/apiKeys/:id/revoke`

## Operational Guidance
- During planned rotation, keep old exchange key active only until new key is validated.
- After successful validation, revoke old key at exchange provider and in CryptoSparrow.
- Record rotation/revoke activity in operational logs for incident traceability.
