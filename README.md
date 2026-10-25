# Sports Auction

TypeScript pnpm monorepo: Next.js frontend, Node.js/Express + Socket.IO backend, MongoDB Atlas database. Phase 0 implements the foundation; domain features start in Phase 1.

## Requirements

Node.js 22.12+, pnpm 10.28.2. Docker Compose v2 is optional for a local MongoDB replica set. On Windows use pnpm.cmd or corepack.cmd pnpm when PowerShell blocks script shims.

## Setup with Atlas

1. Copy .env.example to ignored .env. Replace the Atlas database-user placeholders in MONGODB_URI with URL-encoded credentials. Set MONGODB_DB_NAME=sports_auction.
2. In Atlas, configure the database user and allow the development machine or backend outbound IPs in Network Access. Keep completed credentials out of git and chat.
3. Run pnpm install.
4. Run pnpm db:deploy. This idempotently verifies a replica-set connection and writes a bootstrap marker; it never resets data.
5. Run pnpm dev. Open http://localhost:3000. The API listens on http://localhost:4000.

The API and database setup command load root .env. Next.js calls API_URL (localhost:4000 by default); export API_URL or put it in apps/web/.env.local for a different API origin.

## Local database alternative

Run pnpm db:up to start a persistent MongoDB 8 replica set on loopback port 27017. Use the local MONGODB_URI alternative in .env.example, then pnpm db:deploy. Docker is only for local development; production data lives in Atlas. Do not remove data volumes or reset a database without approval.

## Validation

- pnpm format / pnpm format:check
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm test:integration (requires a real MongoDB replica set and completed bootstrap)
- pnpm exec playwright install chromium
- pnpm test:e2e (starts both apps; requires the database)
- pnpm build

For isolated test ports use E2E_WEB_PORT and E2E_API_PORT. Use a separate MONGODB_DB_NAME for tests. CI runs a real Docker MongoDB replica set and exercises database transactions.

## Structure and hosting

- apps/web: Next.js App Router, Tailwind, shadcn/ui configuration, loading/error states and real readiness status.
- apps/api: Express, authenticated Socket.IO auction rooms, security headers, validated environment, bounded input and graceful shutdown.
- packages/db: official MongoDB Node.js driver, shared connection pool and idempotent setup. Database credentials stay server-side.
- packages/shared: Zod contracts and TypeScript types.
- tests: HTTP tests, real database integration/transaction checks and Chromium smoke tests.

GET /health/live checks the process. GET /health/ready pings MongoDB and checks persisted bootstrap metadata, returning 503 on failure without exposing connection details.

The backend target is Render; the database is MongoDB Atlas; the frontend target is Vercel. render.yaml provisions only the API and prompts for MONGODB_URI. See [deployment instructions](docs/DEPLOYMENT.md) and [progress](docs/PROGRESS.md). No cloud deployment has been performed.

Production start commands: pnpm --filter @sports/api start and pnpm --filter @sports/web start.

Driver setup follows the [official MongoDB connection guide](https://www.mongodb.com/docs/drivers/node/current/connect/mongoclient/).

## Organizer accounts and auctions (Phase 1)

After pnpm db:deploy, open /register or /login. The protected /dashboard lists your own auctions. Create an auction at /auctions/new; overview and settings pages support draft edits and audited deletion. Passwords use Argon2id and sessions use HTTP-only cookies. See [authentication details and password recovery design](docs/AUTH.md).

The Next.js same-origin /api proxy forwards session cookies to Express. Set WEB_ORIGIN on the API to the exact frontend origin and API_URL on Next.js to the backend origin. Production cookies require HTTPS. Run database bootstrap again when updating from Phase 0 to create the new unique and TTL indexes.

## Complete auction workflow

Import an XLSX/CSV, map the required name and optional player fields, preview, then confirm. Create teams with private logos, budgets and slots. The live page supports secure server selection, SOLD/UNSOLD confirmation, automatic next selection, pause/resume, reload recovery and audited latest-decision undo. Review final unsold players, explicitly begin another round or complete the auction, then download the six-sheet Excel ledger. Multiple authenticated tabs synchronize through versioned socket notifications with REST recovery.

Logo bytes persist in MongoDB by default. For private S3/R2 storage set STORAGE_DRIVER=s3 and the S3 variables from .env.example on the API only; downloads still require auction ownership. Cloud storage must be verified during staging. See the deployment checklist for the remaining account-dependent go-live gates.
