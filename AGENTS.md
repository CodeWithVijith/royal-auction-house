# Codex repository instructions — Sports Auction

You are implementing a production-quality multi-tenant auction SaaS. Read `docs/PRODUCT.md`, `docs/EXECUTION_PLAN.md`, and `docs/ACCEPTANCE.md` before changing code. The user-provided requirements document is the source of truth; where unclear, apply the documented MVP defaults.

## Architecture

User revision (2026-10-25): use MongoDB Atlas instead of PostgreSQL/Prisma; keep Node.js/Express and Next.js. This revision supersedes earlier database requirements. MongoDB replica-set transactions and unique indexes must preserve all financial and tenant-isolation guarantees.

- TypeScript monorepo using pnpm workspaces: `apps/web` (Next.js App Router, Tailwind, shadcn/ui), `apps/api` (Node.js Express, Socket.IO), `packages/db` (MongoDB official Node.js driver), `packages/shared` (Zod/types).
- MongoDB Atlas for hosted data; Docker Compose with a MongoDB replica set for local development; optional local object storage for uploads. `.env.example` only, no credentials in git.
- The API is authoritative: clients must not finalize budgets, player assignment, spin result, or auction state locally.
- Store monetary amounts as exact integer units (rupees or points in MVP; no fractional bids) and include denomination on auction, not team.
- Organizer owns isolated auctions. Every auction-scoped query verifies access and filters by auctionId; guessable IDs must not enable access.
- Use schema-validated inputs, defensive file limits, safe CSV/XLSX parsing, audit trail for decisions and corrections, and short-lived authenticated sessions.
- Do not include the reference website login credentials in code, tests, logs, or documentation.

## Working protocol

1. Execute phases sequentially from `docs/EXECUTION_PLAN.md`. Finish each with working code/tests, run commands, and a commit-ready checkpoint.
2. Before each phase, restate the exact deliverables; implement rather than only proposing. Avoid placeholders, fake backends, inert buttons or simulated API responses in completed phases.
3. Run formatting, lint, typecheck, unit and integration tests; fix failures before moving on. Record any blockers transparently.
4. Maintain `docs/PROGRESS.md` with completed tasks, decisions, commands, and next steps.
5. Build responsive, accessible, polished UI with loading, empty, error, and success states.
6. Never run destructive database reset or drop collections without explicit user approval.
7. Use atomic database transactions + unique constraints/idempotency for all SOLD/UNSOLD commits. Reload must recover selected player and state.
8. After every phase, provide brief files-changed, tests-passed, and next phase instructions.

## Non-negotiable tests

- Tenant isolation on list/read/write/export.
- Spreadsheet mapping with 30+ extra columns; no raw PII carried into players by default.
- Duplicate import idempotency and safe re-import when auction started.
- Team overspend/overcapacity prevention; two concurrent sale requests never double-sell/double-deduct.
- Wheel selects only available eligible players; no replacement in current round.
- Refresh restores selected player; spin cannot proceed when a decision is pending.
- Second round considers only final UNSOLD players and preserves first-round history.
- XLSX export reconciles with purchase ledger and correct denominations.
