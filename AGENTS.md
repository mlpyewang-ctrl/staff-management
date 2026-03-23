# Repository Guidelines

## Project Structure & Module Organization
This is a Next.js 14 app with Prisma-backed data access. Keep page routes in `src/app/`, shared UI in `src/components/`, business logic in `src/lib/`, and server actions in `src/server/actions/`. Database schema and seed data live in `prisma/`, while helper scripts live in `scripts/`. Tests are colocated under `src/**/__tests__/` and use the `*.test.ts` / `*.test.tsx` pattern.

## Build, Test, and Development Commands
- `npm run dev` - start the local Next.js app.
- `npm run build` - create a production build.
- `npm run start` - run the built app.
- `npm test` - run the Vitest suite once.
- `npm run test:watch` - run tests in watch mode.
- `npm run test:coverage` - generate coverage output.
- `npm run db:push` - sync the Prisma schema to the database.
- `npm run db:seed` - load seed data.
- `npm run db:studio` - open Prisma Studio.

For local setup, copy `.env.example` to `.env`, then start PostgreSQL with `docker compose up -d`.

## Coding Style & Naming Conventions
Follow the existing TypeScript/React style: 2-space indentation, single quotes, and semicolons omitted. Prefer descriptive component and function names, PascalCase for React components, and camelCase for variables, helpers, and server actions. Use the `@/` alias for imports from `src/`. Keep Tailwind class lists inline and grouped by layout -> spacing -> color -> state when practical.

## Testing Guidelines
Use Vitest with `jsdom` for UI-related tests. Keep test files next to the code they cover, especially under `__tests__`, and name them `something.test.ts` or `something.test.tsx`. Favor focused unit tests for helpers, validation, and server-action logic; add coverage for edge cases and auth-sensitive flows.

## Commit & Pull Request Guidelines
Recent commits are very short and informal (`bugfix`, `add export`, `opt`), so keep commit subjects concise and task-focused. Prefer imperative summaries when possible. For pull requests, include a short description, related issue link if available, and screenshots or screen recordings for UI changes. Note any schema, seed, or environment changes explicitly.

## Environment & Deployment Notes
Do not commit local secrets from `.env`. If you change Prisma models, update the database workflow and mention whether `db:push` or `db:seed` is required. Deployment and offline bundle scripts are already in `scripts/`; reuse them instead of creating new ad hoc flows.
