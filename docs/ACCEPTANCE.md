# Acceptance scenarios (convert to automated tests)

- [x] User A creates auction X and user B creates Y; A cannot view/update/delete/export Y by changing URL or ID.
- [x] Same organizer can have 2 independent auctions with different denomination and players/teams.
- [x] 30-column Google Forms Excel imported with only mapped Name, DOB, Previous Team, Registration ID; rest not persisted to normalized player.
- [x] Missing Name shows row-level validation error and prevents invalid import.
- [x] Duplicate registration ID on repeated import does not duplicate a player or alter results.
- [x] Team logo/name/budget/slots create, edit, delete; unsafe delete blocked.
- [x] Spin selects one of unprocessed players, persists selection and never selects it again in the same round.
- [x] SOLD at 2000 INR/points assigns team, deducts exactly once, records actor/time and triggers next spin.
- [x] UNSOLD leaves budgets unchanged, adds player to unsold queue and triggers next spin.
- [x] Budget exhaustion and filled team prevent SOLD regardless of UI manipulation.
- [x] Concurrent SOLD requests for same player cannot both succeed.
- [x] Reload while selection pending preserves the exact player.
- [x] Pausing prevents automatic selection after an outcome; resume continues.
- [x] Finishing main round offers explicit unsold round; a later successful sale preserves original unsold attempt.
- [x] Final Excel has 6 expected sheets; totals match team transactions and denomination throughout.
- [x] Completed auction cannot be silently changed; corrections generate audit entries.
- [x] Keyboard operation, responsive team sidebar, accessible confirmation dialogs.

## Verification scope

All scenarios above passed locally on 2026-10-26 against the real Express API, Next.js frontend and MongoDB 8.0.15 replica set: 10 unit, 35 integration and 5 Chromium tests. See tests/auth-auctions.integration.test.ts, import.integration.test.ts, teams.integration.test.ts, engine.integration.test.ts, results.integration.test.ts, realtime.integration.test.ts and tests/e2e/journey.spec.ts. Keyboard, mobile and projector screenshots were reviewed. This does not certify cloud go-live; pending deployment gates are tracked in DEPLOYMENT.md.
