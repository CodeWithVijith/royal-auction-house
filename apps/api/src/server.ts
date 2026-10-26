import { createServer } from 'node:http';
import { createRealtime } from './realtime';
import { connectDb, disconnectDb } from '@sports/db';
import { createApp } from './app';
import { envSchema } from './config';
const env = envSchema.parse(process.env);
const server = createServer(createApp(env.WEB_ORIGIN));
const realtime = createRealtime(server, env.WEB_ORIGIN);
server.listen(env.API_PORT, '0.0.0.0', () =>
  console.info('Sports Auction API listening on port', env.API_PORT),
);
// Open the shared MongoDB pool while Render is completing its health checks so
// the first organizer request does not pay the database connection cost.
void connectDb().catch((error: unknown) =>
  console.error('MongoDB warm-up failed; the next request will retry.', error),
);
let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  void realtime
    .close()
    .then(() => disconnectDb())
    .then(
      () => process.exit(0),
      () => process.exit(1),
    );
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
