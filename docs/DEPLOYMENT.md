# Deployment target

User-confirmed architecture: Next.js on Vercel, Node.js/Express + Socket.IO on Render, MongoDB Atlas for data. Atlas replaces the previously proposed Render PostgreSQL database.

## MongoDB Atlas

The supplied cluster host is cluster0.ibfyqg4.mongodb.net. The connection template is in .env.example, with username/password placeholders and compressors=zlib. MONGODB_DB_NAME explicitly selects sports_auction even when the URI does not include a database path.

Create a database user with the application database permissions and configure Network Access for the backend outbound IPs. Store the completed MONGODB_URI only in ignored local environment files or the Render environment-variable editor. URL-encode special characters in the username and password.

The supplied URI contains placeholders; it cannot authenticate as supplied. Do not mark Atlas connected until an actual readiness check succeeds. MongoDB replica-set transactions remain mandatory for the auction engine.

## Render backend

The root render.yaml defines only the API service in Singapore. It prompts for MONGODB_URI and WEB_ORIGIN, selects sports_auction through MONGODB_DB_NAME, respects Render PORT, binds to 0.0.0.0, and uses /health/ready. pnpm db:deploy runs the idempotent MongoDB bootstrap before deployment.

Keep the build root at the repository root so pnpm resolves workspace packages. Review the paid compute plan and region shown in the Blueprint before provisioning. Automatic deployment is off while implementation is in progress. No resources have been provisioned.

When deploying, connect the repository in Render, review the Blueprint, and provide the completed Atlas URI and exact frontend WEB_ORIGIN. Confirm bootstrap and readiness succeed. Set server-only API_URL in Vercel to the HTTPS Render backend origin; do not give database credentials to the frontend.

## Validation and remaining production gates

Local Docker and CI use a real MongoDB 8 single-node replica set with a persistent local volume. CI has an isolated test database. Integration tests verify real commands, persisted metadata and transaction rollback.

The code and local acceptance checks do not establish a live deployment. Atlas authentication, cloud storage, deployed HTTPS cookies, backups and monitoring must pass the staging/go-live checklist below.

References: [MongoDB driver connections](https://www.mongodb.com/docs/drivers/node/current/connect/mongoclient/), [Render Blueprint specification](https://render.com/docs/blueprint-spec).

## Phase 1 sessions

Browser calls use the Next.js same-origin API proxy, so HTTP-only session cookies belong to the frontend host. Keep API_URL server-only on Vercel, configure the exact WEB_ORIGIN on Render, and use HTTPS for production Secure cookies. Run the existing pre-deploy database bootstrap to create Phase 1 unique/TTL indexes. See [authentication details](AUTH.md).

## Vercel frontend

Import this pnpm monorepo, select apps/web as the project root and Next.js as the framework, and enable access to files outside the root. Install with pnpm install --frozen-lockfile and build with pnpm build from apps/web. Set server-only API_URL to the HTTPS Render origin. Do not set database or storage secrets on Vercel. Set Render WEB_ORIGIN to the exact HTTPS frontend origin, without a trailing slash. Use a separate staging frontend/backend/database; preview domains require an explicitly configured matching staging origin.

## Real-time and private object storage

Render must permit WebSocket upgrades. PUBLIC_API_URL is the externally reachable HTTPS API origin; RENDER_EXTERNAL_URL is the automatic fallback. Browsers obtain a 30-second, single-use, session-bound ticket from the same-origin proxy, then connect directly to the backend. Ticket consumption checks auction ownership and the unexpired session. Session expiry/logout disconnect sockets; notification payloads contain only auction ID/version, and clients recover state through authenticated REST. MongoDB change streams fan out across API instances; three-second REST polling also recovers missed notifications.

MongoDB stores sanitized WebP bytes by default. For S3/R2 set STORAGE_DRIVER=s3, S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY; set S3_ENDPOINT for R2 or compatible storage. Use a private bucket and least-privilege GetObject/PutObject/DeleteObject access to auctions/*; all browser reads go through the ownership-checked API. Keep credentials in Render secrets. Uploads normalize images before storage. A failed database transaction attempts to remove its newly uploaded object; configure lifecycle/periodic orphan review to cover interrupted requests. Do not delete objects still referenced by asset records. Local tests exercise real MongoDB asset persistence; S3/R2 still needs a real staging round trip.

## Database releases, backups and monitoring

pnpm db:deploy is idempotent and creates unique/TTL indexes before writing the sports-auction-v1 schema marker. Readiness and application entry points fail closed if setup is missing. Run setup against staging before production; future incompatible migrations must use a new marker and an explicit data migration. Never reset production data. Take an Atlas snapshot before schema changes, configure scheduled backups and retention suitable for the selected Atlas tier, and prove a restore into a separate database. Free tiers may lack managed backups; provision a supported tier or a tested encrypted backup process before go-live.

Monitor /health/live and /health/ready, deployment failures, error rates, transaction latency, Atlas connections/storage, and object-storage errors. API logs contain generated request IDs, method, matched route, status and duration, excluding request bodies, credentials and cookies. Configure external uptime alerts and Render/Atlas alert recipients in the accounts. Choose capacity after staging load tests, especially spreadsheet parsing/export memory. Auth limits deliberately use the API's observed address rather than trusting forged forwarded IPs; a proxied deployment shares an aggregate limit, documented in AUTH.md.

## Staging and manual go-live checklist

- [ ] Connect accounts/repository and provision reviewed Render/Vercel resources.
- [ ] Complete the Atlas URI placeholders privately; allow backend network access and verify replica-set readiness.
- [ ] Run frozen install, bootstrap and CI checks on the deployment revision.
- [ ] Register/login/logout over HTTPS; inspect Secure/HttpOnly cookies and reject a foreign Origin.
- [ ] Open two authenticated tabs; confirm live updates, reconnect/reload recovery and cross-tenant denial.
- [ ] Import a representative workbook, upload/read a private S3/R2 logo, run decisions/unsold round and reconcile final export.
- [ ] Configure Atlas backups and successfully restore a snapshot separately.
- [ ] Enable uptime/error/Atlas alerts and verify notifications reach the operator.
- [ ] Measure representative spreadsheet/export and concurrent-tab load on the selected paid service size.
- [ ] Record deployed URLs/revision, operator acceptance and rollback procedure. Keep automatic deployment off until accepted.

Rollback: redeploy the last validated application revision with its compatible schema marker. Do not reverse financial decisions or restore an older database over active sales as an application rollback; pause auctions and reconcile using the audit/ledger before any data recovery.

No deployment URL or cloud verification is claimed until these account-dependent checks pass.

## Manual Free Web Service and bootstrap failures

The Blueprint selects paid compute. A manually created Free Node Web Service can use the repository root, NODE_VERSION=22, build command `corepack pnpm install --frozen-lockfile --prod=false && corepack pnpm --filter @sports/api build`, and start command `corepack pnpm db:deploy && corepack pnpm --filter @sports/api start`. Free services lack a separate pre-deploy step, so the idempotent setup runs before Express. Free service idle suspension makes this a testing deployment, subject to Render account verification and current service limits. Do not run corepack enable against Render's read-only system installation.

Bootstrap now logs a safe JSON category and stage without raw MongoDB messages, stacks, credentials, URIs or duplicate record values. CONFIGURATION/INVALID_URI indicates the connection variable; AUTHENTICATION indicates database credentials; DATABASE_PERMISSIONS indicates grants on MONGODB_DB_NAME; DNS indicates hostname/resolution; NETWORK_OR_CLUSTER indicates selection/network failure (not definitive proof of a missing IP rule); INDEX_CONFLICT/DUPLICATE_DATA requires reviewing existing data/indexes without resetting them. Unknown errors retain only a numeric server code. Share only this safe diagnostic line when troubleshooting. A bootstrap exit prevents Express starting, so a subsequent no-open-ports message is secondary.
