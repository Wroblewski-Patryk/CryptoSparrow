# Tech Stack

## Monorepo
- pnpm workspaces
- apps/client and apps/server

## Backend
- Node.js 20+ with Express 5
- Prisma ORM with PostgreSQL
- Zod for validation
- jsonwebtoken for JWT auth
- bcrypt for password hashing
- multer and sharp for uploads
- cors and cookie-parser middleware
- Redis and BullMQ for caching and queues (MVP)

## Frontend
- Next.js 15 App Router
- React 19
- Tailwind CSS v4 and daisyUI
- react-hook-form with Zod resolver
- axios for API calls

## Internationalization
- Client-side i18n (recommended): Next.js locale files, single active locale per session.
- API returns locale-neutral data; UI handles labels and messages.

## Testing
- Vitest for unit and integration tests
- Supertest for API tests
- Testing Library for UI tests

## Planned Integrations
- CCXT for exchange APIs
- WebSocket for market streaming
- AI module as optional advisor
