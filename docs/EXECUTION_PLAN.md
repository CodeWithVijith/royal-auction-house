# Codex execution plan

Architecture revision (2026-10-25, user-directed): Next.js frontend, Node.js/Express backend on Render, MongoDB Atlas using the official Node.js driver. PostgreSQL/Prisma requirements are replaced; all business acceptance criteria remain mandatory.

Run the phases below in order. At each phase, implement working functionality, add tests, run them and update PROGRESS.md. The user subsequently authorized completing all phases in one run and committing the changes; continue sequentially after each validated checkpoint. Account-dependent deployment remains an explicit gate.

## Phase 0 — Bootstrap

- Create pnpm monorepo apps/web Next.js TypeScript + apps/api Express TypeScript + packages/db MongoDB driver + packages/shared Zod schemas.
- Set ESLint, Prettier, strict tsconfig, Vitest, Playwright, Docker Compose MongoDB replica set and .env.example; add README commands and GitHub Actions checks.
- Make `pnpm install`, `pnpm dev`, `pnpm lint`, `pnpm typecheck`, `pnpm test` succeed.

## Phase 1 — Auth, tenants, auction creation

- MongoDB collections, runtime schemas and indexes for users, accounts/sessions, and auctions with ownerId and settings/status. Use hashed passwords (Argon2id), secure httpOnly cookies or rotating refresh tokens, reset-password design, rate limits, auth middleware.
- Organizer dashboard: create and list auctions; auction denomination INR or POINTS immutable once auction starts; enforce user ownership in API and UI.
- Integration tests demonstrating A cannot access B's auctions.

## Phase 2 — Excel upload, mapping, players

- Safe server-side xlsx/csv parsing with file limits, sheet/header selection, flexible column mapping; keep mapping config and import batch metadata. Preview with validity counts and row-specific errors.
- Required normalized field name; optional registrationId, dob, previousTeam, category, playerPhotoURL; arbitrary spreadsheet extras discarded unless explicitly selected. DOB normalized, address/contact ignored by default.
- Commit valid rows with deterministic duplicate handling (registrationId within auction, or configurable fallback using import batch/row hash). Never modify SOLD/UNSOLD results on reimport. Build Players list/details/search/edit pre-auction.
- Tests: multi-column, missing required field, Excel serial DOB, duplicate file, malicious/invalid upload.

## Phase 3 — Teams and finances

- Add/edit/delete branded teams with image storage, budget, roster slots. Reuse matching denomination. Show spent, remaining, slots used.
- Prevent unsafe deletion or budget changes following sale. Compute spend server-side from non-void sales rather than trusting client values.
- Tests for ownership, duplicate names, negative budget, invalid slot counts.

## Phase 4 — Authoritative auction engine

- DB models rounds, lots, player decisions, sales, bids (only if useful), event log, idempotency. Add unique active selection per auction and uniqueness of final sold player.
- Endpoints start/pause/resume, spin/select (secure server randomness among eligible players), current state, sold, unsold, undo/correct (audited).
- Use replica-set transactions and conditional version updates on the active lot and affected team/ledger, validate amount, capacity, budget, then persist sale + event; use optimistic version/idempotency and retry-safe behavior. Prevent duplicate concurrent sales.
- Build live page with wheel animation to server-chosen result, team sidebar, player profile, confirm SOLD modal (amount and team), confirm UNSOLD, pause/resume, auto-next after commit, recovery after refresh. Empty/end-of-round state and error UI.
- Test concurrent SOLD requests and backend failures, selection without replacement, recovery, no overbudget.

## Phase 5 — Re-auction and exports

- End-of-round summary; explicitly create another round containing current unsold only; preserve previous attempts/history. Complete/freeze auction.
- Results and team roster pages; XLSX sheets Summary, All Players, Sold Players, Unsold Players, Teams, Transactions; escape formula injection, download headers; draft/final labels. Check numerical reconciliation.

## Phase 6 — Real-time, QA, production

- Socket.IO authenticated auction rooms; clients rehydrate via REST and deduplicate versioned events. Support one organizer with multiple spectator tabs; no unauthenticated reads.
- Playwright full organizer journey, cross-tenant access and reload; backend concurrent integration tests. Accessibility + mobile/projector UX polish, empty/loading/error states.
- Deploy frontend Vercel and WebSocket capable backend Render, MongoDB Atlas, S3/R2 storage. Set CORS, cookies, database setup/index versioning, backups, monitoring, secrets, CI, staging and manual go-live checklist.

## Completion gates

Only consider MVP done after all acceptance tests in `ACCEPTANCE.md` pass against a real MongoDB replica set. No localStorage-only auction records; no fake API; no client-side-only deduction.
