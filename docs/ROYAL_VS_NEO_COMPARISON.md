# Royal Auction House vs NeoAuction

Tested on 26 October 2026 against the deployed production sites at a 1366 x 768 viewport.

## Test scope and result

- NeoAuction authentication succeeded. Auction, Teams, Players, Unsold, and Results pages were opened and inspected.
- Royal Auction House authentication failed with HTTP 401 `INVALID_CREDENTIALS`. The supplied Royal account is not present in, or does not match, the currently deployed production database.
- No teams, players, auction decisions, or other production records were created, changed, or deleted during this comparison.
- NeoAuction contained zero teams and zero players, so its live sold/unsold lifecycle could not be executed without creating production test data.
- Royal's authenticated workflow was evaluated from the deployed application behavior available before authentication and the matching production source implementation.

## Measured performance

| Check | Royal Auction House | NeoAuction |
| --- | ---: | ---: |
| Login page load | about 1.9 seconds in the prior live run | 0.75 seconds |
| Login request/transition | about 1.1 seconds, ending in 401 | 8.1 seconds, successful |
| Authenticated section loads | blocked by invalid account | 2.6-3.0 seconds per section, including a 2.5-second observation delay |
| Browser errors | Expected 401 only | None |
| Failed requests | None material | None |

Royal may occasionally take much longer after inactivity because its API runs on Render's free tier and can spin down. This is a hosting delay rather than a frontend rendering defect.

## Workflow comparison

| Area | Royal Auction House | NeoAuction | Assessment |
| --- | --- | --- | --- |
| Organizer model | Multiple named auctions per organizer | One direct auction workspace | Royal is better for repeated events; Neo is faster to enter. |
| Team management | Add/edit/delete before start, logo URL, budget, roster slots, spend and remaining capacity | Add/reset teams; empty-state flow verified | Royal matches the requested branding and financial controls. |
| Player intake | CSV/XLSX upload, field mapping, validation preview, commit, 5 MB/5,000-player limits; only mapped fields saved | Add Player, Form Builder, Copy Link, WhatsApp | Royal matches the external Google Form/Excel requirement more directly. |
| Player management | Search and edit imported players before the auction locks | All/Available/Sold/Unsold filters | Both cover roster review; Neo presents status filters more prominently. |
| Auction selection | Explicit random spin wheel, start/pause/resume controls, one pending decision at a time | Start Bidding entry point; no players existed to test selection | Royal implements the requested wheel flow and stronger state guards. |
| Sold decision | Team selection and final amount in the configured denomination | Could not execute with empty data | Royal supports INR/points through auction denomination configuration. |
| Unsold decision | Marks player unsold without changing a team budget | Dedicated Unsold section | Both support an unsold workflow. |
| Re-auction | Explicit round containing only final unsold players with round history | Dedicated Unsold page; round behavior not observable | Royal has the more auditable round model. |
| Corrections | Pause, void latest decision, requeue player, reconcile ledger | Not observed | Royal provides safer operational recovery. |
| Results | Live summary, team allocations, player attempts and round history | Total/Sold/Unsold/Available/Spent summary | Both cover results; Royal retains more audit detail. |
| Export | Draft/final Excel workbook | No export action appeared on the tested Results page | Royal matches the Excel handoff requirement. |
| Real-time behavior | Socket events with refresh fallback | Live badge visible | Both signal live operation; Royal's implementation has explicit synchronization/version safeguards. |

## UI observations

### Royal Auction House

- Clean, readable login page with a focused single-column layout.
- Auction-specific navigation includes Overview, Teams, Import Players, Players, Live, Unsold, Results, and Settings.
- Tables and dense dialogs use bounded heights and overflow handling.
- Navigation and forms use responsive width rules, but authenticated pages still need a live mobile pass after valid production access is restored.
- The current login error is clear and correctly avoids exposing whether the email or password is wrong.

### NeoAuction

- Strong black-and-gold visual identity and persistent top navigation.
- Clear empty states and prominent first-action buttons.
- Successful-login feedback remained visible while the auction screen loaded.
- Some captured text showed mojibake such as `Â©`, `â‚¹`, and broken emoji bytes. This indicates an encoding/response decoding issue in the tested output path.
- At 1366 x 768 the layout fit the viewport, but the wide top navigation is likely to need a compact mobile treatment.

## Priority actions

1. Restore a valid Royal production organizer account, then repeat the authenticated end-to-end test with a disposable auction.
2. Upgrade the Render API from the free tier for consistent response time and keep Render and MongoDB Atlas in nearby regions.
3. Add a seeded/demo auction or an isolated staging environment so team creation, Excel import, spin, sold, unsold, re-auction, correction, completion, and export can be tested without touching production data.
4. Run responsive browser tests at 320, 375, 768, 1024, and 1366 pixels for every authenticated Royal page, including dialogs and large tables.
5. Add deployment smoke tests that verify login, API health, database readiness, CORS/cookies, and one read-only authenticated route after every release.

## Overall conclusion

Royal Auction House is a closer match to the stated business requirements than the tested NeoAuction flow, especially for Excel-first player intake, configurable denominations, random selection, explicit unsold rounds, corrections, and Excel export. NeoAuction currently has the more immediately polished single-event shell and a faster initial login page, but its successful login transition was slow and its empty account did not expose enough data to validate the full auction lifecycle.

The comparison cannot be considered a complete production acceptance test until the Royal production login is repaired and both products have disposable teams and players available for the same end-to-end scenario.

## Production acceptance update — 26 October 2026

Royal production authentication is now working. A representative auction was exercised with three teams and six spreadsheet-imported players. Random selection, a ₹15,000 sold decision, an unsold decision, team budget reconciliation, roster-slot reconciliation, and the results summary all completed successfully.

The resulting UI comparison identified and addressed these remaining differences:

- Royal now uses one unified desktop header for crest, brand, primary navigation, and profile control.
- The live room is constrained to one desktop viewport, with the team rail and event stage sharing the available height.
- Recent audit decisions no longer push the desktop event canvas below the fold; they remain available on smaller layouts and through Results.
- A persistent LIVE/RECONNECTING footer mirrors the reference's event status treatment.
- The API now opens its MongoDB pool during process startup, avoiding the connection setup cost on the first organizer request after the service wakes.

The reference still uses its own institutional crest and proprietary wing/wheel artwork. Royal intentionally uses original branding and CSS-rendered wheel artwork rather than copying those assets.
