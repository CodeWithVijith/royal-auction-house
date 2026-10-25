import { createServer } from 'node:http';
import { createRealtime } from './realtime';
import { disconnectDb } from '@sports/db';
import { createApp } from './app';
import { envSchema } from './config';
const env = envSchema.parse(process.env);
const server = createServer(createApp(env.WEB_ORIGIN));
const realtime = createRealtime(server, env.WEB_ORIGIN);
server.listen(env.API_PORT, '0.0.0.0', () =>
  console.info('Sports Auction API listening on port', env.API_PORT),
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
