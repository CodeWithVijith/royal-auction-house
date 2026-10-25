# Product requirements — Sports Auction Platform

## Architecture decision

User revision (2026-10-25): Next.js frontend, Node.js/Express backend hosted on Render, MongoDB Atlas database using the official Node.js driver. Use replica-set transactions, unique indexes and conditional writes for auction decisions. All tenant-isolation and exact-integer money requirements remain unchanged.

## Goal

Build a multi-organizer sports auction system inspired by the reference's UX, not copying its assets or code. External Google Forms collect players. Organizer logs in, creates an auction, uploads Google Forms Excel/CSV, maps only required fields, creates branded teams, launches a random spin wheel, enters SOLD amount and team or marks UNSOLD, automatically spins next player after each confirmed decision, optionally reruns UNSOLD players, and exports final Excel.

## User journeys

1. Register/login -> My Auctions (independent per organizer) -> create auction (name, sport, logo, INR or POINTS, default budget/slots, minimum price optional).
2. Import -> select xlsx/csv, worksheet and header row -> map columns to normalized player fields -> preview/validate -> commit import -> manage players. External sheet may have arbitrary columns. Name required; registration ID recommended; DOB, previous team, category optional; address/contact excluded by default. Show row-specific errors and duplicate warnings. Save mapping per auction. Never reset auction outcomes on reimport.
3. Team setup -> add/edit/delete logo, name, initial budget and max slots; show spent/remaining, capacity, purchases. Disable unsafe delete/edit after purchases without correction workflow.
4. Start round -> random authoritative selection of one AVAILABLE player -> animate wheel -> display selected player -> organizer enters final amount (integer positive INR/points) and eligible team -> confirm SOLD, or confirm UNSOLD -> persist atomically -> outcome animation -> automatic next spin; never spin while pending. Allow pause/resume and optional manual next. Reload recovers pending choice.
5. Main round ends -> unsold round selectable by organizer; only unresolved final-unsold players become queued, with attempt history retained; or finalize auction.
6. Results -> team rosters, sold/unsold summary, spent/remaining; Excel workbook: Summary, All Players, Sold Players, Unsold Players, Teams, Transactions. Export snapshot before completion marked DRAFT.

## Roles / access

MVP: ORGANIZER can operate only their own auctions. Future viewer role not required. A user may own multiple auctions and never see other users' auction data. Protect every API and WebSocket room.

## Defaults (configurable later)

- Each auction has one fixed denomination, INR or POINTS, never mixing units, locked once bidding begins.
- Bid amount entered by organizer (no team-initiated bid UI in MVP).
- Numeric starting budgets and roster capacity configured per team.
- Use uploaded player photo only when present; otherwise avatar placeholder.
- Main round and optional unsold re-auction; organizer explicitly begins unsold round.
- Auto-next on successful finalization, respecting pause, with short user-configurable delay; safe manual spin if autoplay disabled.
- No Google API integration; no public registration builder in MVP.

## UX routes

/login, /register, /dashboard, /auctions/new, /auctions/[id]/overview, /auctions/[id]/import, /auctions/[id]/players, /auctions/[id]/teams, /auctions/[id]/live, /auctions/[id]/unsold, /auctions/[id]/results, /auctions/[id]/settings.

## Critical edge cases

Empty file/sheet, Excel date serial handling, invalid DOB, duplicate registration IDs, inconsistent column names, missing player name, duplicate team name, CSV malicious formula on export, oversized image/workbook, insufficient budget, no slots, duplicate sale, stale browser, network outage, pause during auto-next, no available players, player sold in second round, interrupted export, cross-tenant URL access, and correction after completion.
