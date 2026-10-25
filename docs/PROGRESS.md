# Progress

## Current delivery status

Phases 0–5 are implemented and validated sequentially. Phase 6 application functionality is implemented and locally validated, including authenticated real-time rooms, REST recovery, private S3/R2 adapter, schema readiness gating, request IDs and operational deployment documentation. Cloud deployment remains blocked by missing completed Atlas credentials and connected hosting/storage accounts; no hosted deployment or cloud backup verification is claimed. Phase 6 remains open specifically for these production gates.

## Current architecture - user revision, 2026-10-25

Next.js frontend, Node.js/Express + Socket.IO backend on Render, MongoDB Atlas database with the official MongoDB Node.js driver. This replaces the original PostgreSQL/Prisma requirement. The user confirmed Atlas and supplied a connection template for cluster0.ibfyqg4.mongodb.net. Username/password placeholders remain; no live Atlas credentials have been provided or committed.

## Phase 1 - Auth, tenants and auction creation

Historical Phase 1 checkpoint, validated locally on 2026-10-26 (Asia/Calcutta). Later checkpoints below record Phases 2–6.

### Delivered

- packages/shared/src/index.ts: strict registration/login and create/update auction schemas; normalized emails, safe integer money, optional HTTPS logo URL, denomination and settings types.
- packages/db/src/models.ts, index.ts, setup.ts: users with email/password accounts, hashed-token sessions, auctions, audit events and persistent rate-limit buckets; unique email, TTL/session and ownership indexes. pnpm db:deploy installs these without resetting data.
- apps/api/src/auth.ts and errors.ts: Argon2id passwords, opaque random sessions with hashed server-side storage, eight-hour expiry checked per request, login rotation, logout, /auth/me, persistent auth limits and structured safe errors.
- apps/api/src/auctions.ts and app.ts: authenticated owner-filtered list/read/create/patch/delete; strict ownership-field rejection; matching-version edits; denomination/settings locked after start; transactions commit each draft mutation and audit event together; exact Origin checks and uncached private responses.
- apps/web/src/app/api/[...path]/route.ts: bounded, allowlisted same-origin proxy relaying only the session cookie, actual browser Origin and backend Set-Cookie. Database credentials stay out of the browser.
- apps/web/src/lib/api.ts and client-api.ts: uncached server-side session forwarding, login/not-found handling and actionable mutation errors.
- apps/web/src/app/login, register, (workspace)/dashboard and (workspace)/auctions: protected organizer layout, registration/login, independent auction cards, creation, overview, settings and confirmed draft deletion. Loading, empty, validation, success, error and sign-out states are implemented.
- apps/web/src/components: functional auth/auction forms, logout and delete controls; shared field/button styling. Landing page links to implemented account routes.
- tests/auth-auctions.integration.test.ts: real MongoDB auth and ownership scenarios; tests/e2e/organizer.spec.ts: complete browser journey, reload and foreign-auction denial.
- docs/AUTH.md: session/CSRF/tenant design, rate-limit behavior and password-reset design; README.md: Phase 1 routes and setup. Password-reset email delivery is intentionally not claimed as implemented.

### Commands and verification

- pnpm install and pnpm install --frozen-lockfile: PASS, including the Argon2 native dependency.
- pnpm db:deploy: PASS on the real local MongoDB 8.0.15 replica set, including unique and TTL indexes.
- pnpm format, pnpm format:check, pnpm lint, pnpm typecheck: PASS.
- pnpm test: PASS, 2 files / 7 unit and HTTP-boundary tests.
- pnpm test:integration: PASS, 2 files / 13 tests. Covers Argon2 hashes, token digests, cookie flags, duplicate email normalization, invalid login, rotation, logout, expiry, CSRF, invalid registration, missing auth, owner-filtered lists, foreign read/update/delete, independent denominations, invalid integer amounts/owner injection, stale writes, audit entries, post-start locks, draft deletion, persistent email throttling and real MongoDB transactions.
- pnpm build: PASS for API and Next.js. Rebuilt frontend successfully after visual text corrections.
- pnpm test:e2e: PASS, 4 Chromium tests including bootstrap/mobile checks, registration -> creation -> draft edit -> reload -> logout -> login, cookie flags, mobile overflow, and a second browser denied another organizer auction by URL. Browser tests start both actual development servers; no API responses are mocked.
- Desktop and 390px mobile screenshots were captured under ignored .cache/phase1-*.png and visually inspected. Corrected Windows text-encoding artifacts in loading labels and separators.
- git diff --check: PASS.

The initial browser assertion expected international grouping for 100000; corrected it to the intended en-IN display 1,00,000. Strict typechecking also caught an optional-field update mismatch; undefined fields are filtered before MongoDB writes. These failures were corrected before the passing checkpoint.

### Decisions, limits and next phase

- Password credentials are stored on organizer user accounts; a separate provider-account collection is deferred until external identity providers are added.
- Password recovery has a concrete token/expiry/atomic-consumption/session-revocation design in docs/AUTH.md. No fake email endpoint or inert reset UI was added.
- The auction list currently returns the latest 100 owned auctions and states that limit in the dashboard. Cursor pagination remains an enhancement.
- The non-existent export route returns 404 for foreign access, but XLSX export functionality and its full isolation test remain Phase 5. No acceptance box for the full export journey is marked complete.
- Startup/deployment requires pnpm db:deploy when upgrading from Phase 0, so unique/TTL indexes are created before accounts are used. This command is configured as the Render pre-deploy step.
- Atlas connectivity still needs the completed private URI and network access; testing used a real isolated local replica set. No Render/Vercel resources were provisioned, no database reset/drop occurred, and no reference-site credentials were used.
- Next: Phase 2, safe XLSX/CSV upload, sheet/header selection, field mapping, preview validation, idempotent import and player management with real storage.

## Phase 0 - Complete and validated locally

### Files and behavior

- Root pnpm workspace, strict TypeScript, ESLint, Prettier, Vitest, Playwright and development/build scripts.
- apps/web: Next.js App Router, Tailwind and shadcn/ui foundation; real MongoDB/API status, loading and recovery states, responsive layout and working refresh.
- apps/api: Express, validated local/Render ports, explicit network binding, security headers, bounded JSON, CORS, liveness/readiness and graceful MongoDB shutdown. Socket.IO denies connections until authenticated rooms exist.
- packages/db: official MongoDB driver, reusable connection pool, sanitized failures and idempotent replica-set-aware bootstrap. Removed Prisma dependencies, generation, schema and SQL migration files.
- packages/shared: Zod contracts and denomination types.
- .env.example: supplied Atlas host and compressors=zlib, credential placeholders, sports_auction database name, local replica-set alternative. Completed URIs belong in ignored .env or Render settings.
- compose.yaml: persistent MongoDB 8 single-node replica set published on loopback. No destructive reset performed.
- .github/workflows/ci.yml: real MongoDB replica set, bootstrap, all checks and browser tests. Cloud CI not executed from this session.
- render.yaml: backend-only Blueprint, Atlas URI prompt, pre-deploy bootstrap, health check and automatic deployment off. No Render Postgres database is defined.
- README.md, docs/DEPLOYMENT.md, docs/PRODUCT.md, docs/EXECUTION_PLAN.md, AGENTS.md and CODEX_START_HERE.md reflect the user-directed architecture change.
- Integration tests query actual MongoDB and verify persisted bootstrap metadata plus a multi-document transaction and rollback. E2E checks healthy status, refresh and mobile layout.

### Commands and results

- pnpm install: PASS; Prisma dependencies removed, MongoDB driver installed and lockfile updated.
- pnpm typecheck: PASS for packages, apps and tooling/tests.
- pnpm lint: PASS.
- pnpm test: PASS, 2 files / 7 tests.
- Render Blueprint: PASS against the published JSON Schema using a temporary validator in ignored .cache; Compose YAML parses with replica-set configuration.
- pnpm install --frozen-lockfile: PASS.
- pnpm db:deploy: PASS against a real MongoDB 8.0.15 replica set; repeated successfully after server restart with existing data preserved.
- pnpm format / pnpm format:check: PASS.
- pnpm test:integration: PASS, 2 tests (persisted metadata/readiness and multi-document transaction rollback). Passed again after restart.
- pnpm build: PASS, API production bundle and Next.js optimized build.
- pnpm test:e2e: PASS, 2 Chromium tests (healthy connection/refresh and mobile layout). The test harness starts both real development servers.
- git diff --check: PASS.
- Docker Compose YAML and the Render Blueprint were structurally validated; Docker and cloud provisioning were not run on this machine.

The machine has Node 24.20.0, no globally available pnpm or Docker. A gitignored Corepack/pnpm shim provides pnpm on PATH. A development-only harness in .cache starts an actual downloaded MongoDB 8.0.15 executable with WiredTiger storage and a replica set; this is not a mock database. Microsoft runtime files were verified and extracted into .cache for native tooling; no system runtime install was performed. Native tooling requires execution outside the restricted filesystem sandbox. The first MongoDB cold start exceeded the default 10-second limit; a 60-second limit worked. The diagnostic PowerShell debug-redirection wrapper reported exit 1 despite every child check summary passing; a clean no-debug restart/bootstrap/integration run exited 0. The harness shuts down MongoDB without deleting its data directory.

### Prior attempts

Before the user changed architecture, PostgreSQL bootstrap code passed formatting, lint, types, 6 unit/API tests, both builds and the mobile browser check. PostgreSQL integration was blocked by configuration. A later portable PostgreSQL attempt exposed a pnpm built-in deploy name collision; explicit run fixed the command. That validation was interrupted by the database change. PostgreSQL artifacts are no longer part of the application; cached validation data has not been deleted.

### Remaining gates and next phase

- Phase 0 validation was completed before Phase 1; its historical results are retained here.
- Atlas connection itself cannot be verified until the user places a completed MONGODB_URI in ignored .env and enables the required Atlas database-user/network access. Do not claim cloud connectivity from local test results.
- Render/Vercel deployment, cloud CI, backups, deployed HTTPS cookies, monitoring and S3/R2 verification require cloud-account access. Deployment configuration and the operator checklist are in docs/DEPLOYMENT.md.
- Phase 0/1 historical checkpoints are retained; current local implementation continues through Phase 6 below.

- [x] Phase 0 Bootstrap - MongoDB architecture implemented and validated locally
- [x] Phase 1 Auth and auctions - implemented and validated locally
- [x] Phase 2 Excel import and players
- [x] Phase 3 Teams and budgets
- [x] Phase 4 Auction engine and wheel
- [x] Phase 5 Unsold rounds and Excel exports
- [ ] Phase 6 Realtime, QA and deployment
  - [x] Real-time implementation and local QA
  - [ ] Cloud deployment and operational acceptance

## Phase 2 checkpoint - 2026-10-26

Implemented safe CSV/XLSX parsing (5 MB compressed, 25 MB decompressed, 500 ZIP entries, 5,000 players, 200 columns), explicit mapping/preview/commit, 30-minute upload retention, DOB normalization, mapped-field-only records, saved mappings, player search/editing and audited idempotent imports. Existing outcomes survive reimport; new players after start are rejected transactionally. Files: spreadsheet.ts, players.ts, owned.ts, domain.ts, import/player pages and components, bounded binary proxy and import tests.

Validation: pnpm install --frozen-lockfile, db:deploy, format:check, lint, typecheck, test (9), test:integration (18), build and test:e2e (4) all passed against a real MongoDB replica set. Proceeded to Phase 3 under the user instruction to complete all phases.

## Phase 3 checkpoint - 2026-10-26

Implemented team CRUD, case-insensitive unique names, integer budgets and slot validation, ledger-derived balances/capacity, audited draft mutations, unsafe post-start mutation locks and private logo uploads. Logos accept PNG/JPEG/WebP up to 2 MB / 4 MP, strip metadata and normalize to WebP; bytes persist in MongoDB and downloads verify ownership. Files: teams.ts, team-manager.tsx, teams page and tests.

All checks passed: 9 unit, 21 real MongoDB integration, 4 browser tests, formatting/lint/types and both production builds. Phase 4 follows automatically per user instruction.

## Phase 4 checkpoint - 2026-10-26

Implemented authoritative secure selection, persistent engine/lot/ledger state, snapshot reads, auction/version serialization, idempotent SOLD/UNSOLD, integer/minimum/budget/capacity checks, pause/resume/autoplay preferences, audited latest-decision undo, transaction rollback, database uniqueness and reload recovery. Live UI animates only server-chosen selections, requires accessible confirmations, retries the same decision payload, pauses auto-next and derives finances from server responses. Auto-next submits a new authoritative spin after the saved decision and configured delay; it does not finalize state locally.

All checks passed: 9 unit, 28 MongoDB integration (including concurrent sales), 4 browser regressions, formatting/lint/types and both builds. Files: engine.ts, live-auction.tsx, dialog.tsx, live page/types, domain indexes, engine integration tests. Proceeded to Phase 5.

## Phase 5 checkpoint - 2026-10-26

Implemented explicit final-unsold-only rounds with preserved attempts, freeze/completion with audited reopen via correction, snapshot results/rosters and a six-sheet XLSX export (Summary, All Players, Sold Players, Unsold Players, Teams, Transactions). Exports reconcile the ledger and team totals, use exact denomination labels, escape formula-like text and label snapshots DRAFT/FINAL.

All checks passed: 10 unit, 32 real MongoDB integration, 4 browser regressions, formatting/lint/types and both builds. New files: results.ts/tests, results-view.tsx and unsold/results pages. Proceeded to Phase 6; cloud account connections remain unconfirmed.

## Phase 6 application checkpoint - 2026-10-26

Delivered authenticated Socket.IO rooms using one-use session-bound tickets, exact socket Origin checks, logout/expiry disconnection, MongoDB change-stream notifications, version deduplication and authenticated REST recovery. Added private S3/R2 storage with actual MongoDB binary storage as the working default, schema/index version readiness checks, safe request-ID logging, graceful shutdown, decompressed ZIP byte accounting, bulk bounded imports, explicit mapping control names, keyboard focus restoration, reduced-motion support, optional player photos and mobile table spacing.

New/updated files include apps/api/src/realtime.ts, storage.ts, app.ts, server.ts, spreadsheet.ts, players.ts, teams.ts and engine.ts; packages/db/src/domain.ts/models.ts; apps/web/src/lib/use-auction-events.ts, live-auction.tsx, import-players.tsx, results-view.tsx and ui/dialog.tsx; tests/realtime.integration.test.ts, teams.integration.test.ts, engine.integration.test.ts and e2e/journey.spec.ts; .env.example, README.md and docs/DEPLOYMENT.md.

The real browser journey registers an organizer, creates an auction, maps/imports CSV, creates a team, opens a second authenticated tab, starts/spins, reloads the exact pending player, uses Escape with focus restoration, sells for 2,000 INR, verifies automatic next selection, pauses/marks UNSOLD, explicitly begins round 2, sells for 1,000 INR, completes, downloads and parses the final six-sheet workbook totaling 3,000 INR. Mobile and projector screenshots are retained in ignored .cache for visual review. API integration covers private sanitized image round trips, socket rejection/replay, version notifications and logout disconnection.

Commands executed: pnpm install --frozen-lockfile; pnpm db:deploy; pnpm format; pnpm format:check; pnpm lint; pnpm typecheck; pnpm test; pnpm test:integration; pnpm build; pnpm test:e2e. The ignored Windows validation harness starts an actual MongoDB 8.0.15 replica set and retains its WiredTiger data. No mock APIs or simulated financial persistence are used.

Final clean validation exited 0: frozen install and schema setup PASS; formatting/lint/typecheck PASS; 10 unit tests PASS; 35 real MongoDB integration tests PASS; API and Next.js production builds PASS; 5 Chromium tests PASS (51.7 seconds). All local product acceptance scenarios are checked in docs/ACCEPTANCE.md; cloud gates remain unchecked in docs/DEPLOYMENT.md.

Resolved validation failures: an asset transaction syntax error; logout test incorrectly expecting 200 rather than 204; interaction before upload hydration; ambiguous mapping labels; and missing confirmation focus restoration. Each was fixed and the affected checks rerun. A Playwright screenshot temporarily injected caret styles before hydration; final screenshots preserve the caret and wait for the live connection.

Remaining blocker: the supplied Atlas URI still contains username/password placeholders, and Render/Vercel/S3/R2 accounts are not connected. Cloud deployment, real S3/R2 verification, HTTPS cookie checks, backup restore, monitoring alerts and staging load acceptance cannot be claimed. All concrete setup steps and go-live gates are recorded in docs/DEPLOYMENT.md. Password recovery remains the explicitly requested design, not an email-delivery feature.
