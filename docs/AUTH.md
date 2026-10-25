# Authentication and tenant access

Phase 1 uses organizer email/password accounts. The users collection stores normalized unique email addresses and Argon2id PHC password hashes (19 MiB memory, 2 passes, parallelism 1); plaintext passwords are never stored.

## Sessions and browser boundary

Successful registration and login issue a cryptographically random 256-bit session token. Only its SHA-256 digest is stored in MongoDB. Sessions have an absolute eight-hour expiry. MongoDB TTL cleans expired documents, while every authenticated request independently checks expiry. Login invalidates the incoming session and issues a new token. Logout deletes the digest and expires the cookie.

The sports_session cookie is HttpOnly, SameSite=Lax, host-only and scoped to /. Secure is set in production. Browser requests use the same-origin Next.js /api proxy; the proxy relays cookies and Set-Cookie to the backend and exposes only known auth/auction routes. Credentials never enter localStorage. Authenticated server-rendered pages forward only the session cookie and use uncached API responses.

All state-changing auth and auction requests require the configured exact WEB_ORIGIN. Keep it aligned with the frontend origin. The proxy forwards the actual incoming Origin rather than substituting an approved origin. Both the proxy and API bound JSON bodies to 32 KiB. The proxy uses a server-controlled API_URL and denies arbitrary paths.

Auth attempts are counted atomically in MongoDB fixed 15-minute windows, capped at 30 per normalized email and 100 per backend-observed IP. Keys contain digests; TTL removes old buckets. Limits survive API restarts and are shared across instances. Forwarded client IP headers are not trusted in the production API; behind the Next.js proxy, the IP cap is an aggregate backstop, with the email cap providing per-account protection. Review proxy trust and aggregate limits during deployment rather than accepting arbitrary client-supplied IP headers.

## Auction ownership and settings

Every auction list/read/edit/delete query filters ownerId from the verified session; client ownership fields are rejected. Foreign and nonexistent IDs both return 404. Responses omit database ownership/security fields. Draft create/edit/delete and audit entries commit in the same transaction. Updates require a matching version. A non-draft status or non-null startedAt locks settings and deletion, preserving denomination once bidding begins.

Monetary inputs accept exact nonnegative safe integers only. The denomination is on the auction. The engine enforces positive sold amounts, minimum price, remaining budget and capacity in serialized transactions; non-void sales are the accounting source of truth. Team images use private sanitized storage and ownership-checked downloads. Optional external HTTPS photo URLs are displayed with no-referrer policy.

## Password recovery design

Recovery email delivery is not implemented in Phase 1 and no nonfunctional recovery button is displayed. Before enabling recovery:

1. Add a reset_tokens collection with a unique token-digest index and TTL on expiresAt. Generate a 256-bit random token and store only its SHA-256 digest, userId, creation time and a 30-minute expiry.
2. The request endpoint must always return the same generic accepted response, whether the email exists or not, with persistent per-email/IP throttling. Send the single-use link through an explicitly configured transactional-email provider; never log or return the token.
3. Validate the token and new password, hash the password with Argon2id, then use one MongoDB transaction to consume a valid unexpired token, update the password, revoke all sessions and other reset tokens, and record a security event. Concurrent submissions must allow one winner.
4. Notify the user of the change without exposing the password. Require a fresh login. Test replay, expiry, concurrent consumption, enumeration and provider failures before release.

## Remaining deployment work

Atlas credentials and network access remain user configuration. Run pnpm db:deploy before starting a new deployment so unique/TTL/ownership indexes exist. Production email, password recovery execution, backups and operational monitoring remain later deployment gates.

References: [Argon2 package API](https://github.com/napi-rs/node-rs/tree/main/packages/argon2), [Next.js cookies](https://nextjs.org/docs/app/api-reference/functions/cookies).
