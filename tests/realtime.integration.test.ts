import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { io, type Socket } from 'socket.io-client';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { collections } from '../packages/db/src';
import { createRealtime } from '../apps/api/src/realtime';
import { fixture, origin } from './helpers';
let f: Awaited<ReturnType<typeof fixture>>;
let realtime: ReturnType<typeof createRealtime>;
let url: string;
const sockets: Socket[] = [];
function event<T>(socket: Socket, name: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Socket timeout: ' + name)),
      8000,
    );
    socket.once(name, (value: T) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}
function client(ticket: string) {
  const socket = io(url, {
    transports: ['websocket'],
    auth: { ticket },
    extraHeaders: { Origin: origin },
    reconnection: false,
    autoConnect: false,
  });
  sockets.push(socket);
  return socket;
}
beforeAll(async () => {
  f = await fixture();
  const server = createServer(f.app);
  realtime = createRealtime(server, origin);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('No server port');
  url = 'http://127.0.0.1:' + address.port;
});
afterAll(async () => {
  sockets.forEach((socket) => socket.close());
  await realtime?.close();
  await f?.cleanup();
});
it('rejects foreign tickets, unauthenticated connections and one-use ticket replay', async () => {
  expect(
    (await f.post('/auctions/' + f.id + '/events', f.b).send({})).status,
  ).toBe(404);
  const bad = client('0'.repeat(64));
  const rejected = event<Error>(bad, 'connect_error');
  bad.connect();
  expect((await rejected).message).toBe('AUTH_REQUIRED');
  const ticket = await f.post('/auctions/' + f.id + '/events', f.a).send({});
  expect(ticket.status).toBe(200);
  const socket = client(ticket.body.ticket);
  const connected = event(socket, 'connect');
  socket.connect();
  await connected;
  const replay = client(ticket.body.ticket);
  const failed = event<Error>(replay, 'connect_error');
  replay.connect();
  expect((await failed).message).toBe('AUTH_REQUIRED');
});
it('broadcasts versioned invalidation to authenticated tabs and disconnects on logout', async () => {
  const ticket = await f.post('/auctions/' + f.id + '/events', f.a).send({});
  const socket = client(ticket.body.ticket);
  const connected = event(socket, 'connect');
  socket.connect();
  await connected;
  const changed = event<{ auctionId: string; version: number }>(
    socket,
    'auction.changed',
  );
  const c = await collections();
  await c.auctions.updateOne({ _id: f.id }, { $inc: { version: 1 } });
  await c.audit.insertOne({
    _id: randomUUID(),
    auctionId: f.id,
    actorId: f.userIds[0]!,
    action: 'TEST_NOTIFICATION',
    at: new Date(),
    changes: {},
  });
  expect(await changed).toMatchObject({ auctionId: f.id, version: 1 });
  const disconnected = event(socket, 'disconnect');
  expect((await f.post('/auth/logout', f.a).send({})).status).toBe(204);
  await disconnected;
  expect(socket.connected).toBe(false);
});
