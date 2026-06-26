# Resolute Force

Monorepo: `apps/web` (React+Vite+Tailwind), `apps/api` (Express+Prisma/SQLite), `packages/shared` (Zod DTOs).

## Dev
1. `npm install`
2. Copy `.env.example` → `apps/api/.env` and `apps/web/.env`, fill values.
3. `npm run dev:api` and `npm run dev:web`.

## Test
`npm test`
