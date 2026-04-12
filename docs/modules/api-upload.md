# API Deep-Dive: Upload Module

## Metadata
- Module name: `upload`
- Layer: `api`
- Source path: `apps/api/src/modules/upload`
- Owner: backend/profile-media
- Last updated: 2026-04-12
- Related planning task: `DCP-07`

## 1. Purpose and Scope
- Provides authenticated avatar upload endpoint with strict security guardrails.
- Accepts image upload, normalizes it to fixed JPEG output, and serves URL from static avatars path.

Out of scope:
- Generic file storage platform or multi-asset upload system.
- Avatar metadata persistence in user profile record.

## 2. Boundaries and Dependencies
- Mounted under `/upload` (outside `/dashboard` namespace).
- Depends on:
  - `multer` for multipart parsing.
  - `sharp` for image normalization.
  - local filesystem (`tmp/`, `public/avatars`).
  - runtime `uploadPublicOrigin` for absolute avatar URL.

## 3. Data and Contract Surface
- Endpoint contract:
  - `POST /upload/avatar` with multipart field `avatar`.
- Response:
  - `{ url: "<public-origin>/avatars/<filename>.jpg" }`
- Validation guardrails:
  - max size: 2 MB
  - MIME allowlist: `image/jpeg`, `image/png`, `image/webp`

## 4. Runtime Flows
- Avatar upload flow:
  1. Enforce auth and upload rate limit.
  2. Validate file type and size with multer.
  3. Resize to `150x150`, encode JPEG quality 80.
  4. Remove temporary file.
  5. Return stable public avatar URL.

## 5. API and UI Integration
- Representative route:
  - `POST /upload/avatar`
- Storage exposure:
  - static files are served from `/avatars/*`.

## 6. Security and Risk Guardrails
- Requires authenticated user (`requireAuth`).
- Strict MIME and file-size validation to reduce abuse surface.
- Rate limiter enabled on upload route.
- URL is generated from trusted runtime origin, ignoring spoofed forwarded headers.

## 7. Observability and Operations
- Deterministic output format simplifies CDN/cache behavior.
- Temporary files are explicitly deleted in both success and failure paths.

## 8. Test Coverage and Evidence
- Primary tests:
  - `upload.e2e.test.ts`
- Suggested validation command:
```powershell
pnpm --filter api test -- src/modules/upload/upload.e2e.test.ts
```

## 9. Open Issues and Follow-Ups
- Consider object storage backend when running multiple API instances.
- Add optional avatar content scanning if compliance requirements expand.

