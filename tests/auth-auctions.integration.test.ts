import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { collections, disconnectDb, setupIndexes } from '../packages/db/src';
import { createApp } from '../apps/api/src/app';
import { digest } from '../apps/api/src/auth';
const origin = 'http://localhost:3000';
const app = createApp(origin);
app.set('trust proxy', 1);
const ip = '192.0.2.' + (Math.floor(Math.random() * 200) + 1);
const password = 'Correct auction password 2026!';
const suffix = randomUUID();
const users: string[] = [];
const auctionIds: string[] = [];
const input = {
  name: 'Season auction',
  sport: 'Cricket',
  denomination: 'INR',
  defaultBudget: 100000,
  defaultSlots: 15,
  minimumPrice: null,
  logoUrl: null,
};
let a = '',
  b = '',
  x = '',
  y = '';
const post = (path: string) =>
  request(app).post(path).set('Origin', origin).set('X-Forwarded-For', ip);
async function register(label: string) {
  const result = await post('/auth/register').send({
    name: label,
    email: label + '-' + suffix + '@example.test',
    password,
  });
  expect(result.status).toBe(201);
  users.push(result.body.user.id);
  return {
    result,
    cookie: String(result.headers['set-cookie']?.[0]).split(';')[0]!,
  };
}
beforeAll(async () => {
  await setupIndexes();
  a = (await register('organizer-a')).cookie;
  b = (await register('organizer-b')).cookie;
  const ax = await post('/auctions').set('Cookie', a).send(input);
  const by = await post('/auctions')
    .set('Cookie', b)
    .send({ ...input, name: 'B private auction' });
  expect(ax.status).toBe(201);
  expect(by.status).toBe(201);
  x = ax.body.auction.id;
  y = by.body.auction.id;
  auctionIds.push(x, y);
});
afterAll(async () => {
  const c = await collections();
  await c.sessions.deleteMany({ userId: { $in: users } });
  await c.users.deleteMany({ _id: { $in: users } });
  await c.auctions.deleteMany({ _id: { $in: auctionIds } });
  await c.audit.deleteMany({ auctionId: { $in: auctionIds } });
  await disconnectDb();
});
describe('organizer authentication', () => {
  it('hashes passwords and stores only a digest of an httpOnly session token', async () => {
    const c = await collections();
    const user = await c.users.findOne({ _id: users[0]! });
    expect(user?.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(user?.passwordHash).not.toContain(password);
    const token = a.split('=')[1]!;
    expect(await c.sessions.findOne({ _id: token })).toBeNull();
    expect(await c.sessions.findOne({ _id: digest(token) })).not.toBeNull();
    const response = await request(app).get('/auth/me').set('Cookie', a);
    expect(response.status).toBe(200);
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it('normalizes duplicate email and denies invalid credentials', async () => {
    const email = ('organizer-a-' + suffix + '@example.test').toUpperCase();
    expect(
      (
        await post('/auth/register').send({
          name: 'Duplicate',
          email,
          password,
        })
      ).status,
    ).toBe(409);
    expect(
      (await post('/auth/login').send({ email, password: 'incorrect' })).status,
    ).toBe(401);
    expect(
      (
        await post('/auth/login').send({
          email: 'missing-' + suffix + '@example.test',
          password: 'incorrect',
        })
      ).body,
    ).toEqual({ error: 'INVALID_CREDENTIALS' });
  });
  it('rotates sessions at login, logs out, and immediately rejects an expired record', async () => {
    const c = await collections();
    const { cookie, result } = await register('session-test');
    expect(String(result.headers['set-cookie']?.[0])).toContain('HttpOnly');
    expect(String(result.headers['set-cookie']?.[0])).toContain('SameSite=Lax');
    const logged = await post('/auth/login')
      .set('Cookie', cookie)
      .send({ email: 'session-test-' + suffix + '@example.test', password });
    expect(logged.status).toBe(200);
    expect(
      (await request(app).get('/auth/me').set('Cookie', cookie)).status,
    ).toBe(401);
    const current = String(logged.headers['set-cookie']?.[0]).split(';')[0]!;
    await c.sessions.updateOne(
      { _id: digest(current.split('=')[1]!) },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    expect(
      (await request(app).get('/auth/me').set('Cookie', current)).status,
    ).toBe(401);
    expect((await post('/auth/logout').set('Cookie', current)).status).toBe(
      204,
    );
    expect(
      await c.sessions.findOne({ _id: digest(current.split('=')[1]!) }),
    ).toBeNull();
  });
  it('rejects CSRF and validates form inputs', async () => {
    expect(
      (
        await request(app)
          .post('/auctions')
          .set('Cookie', a)
          .set('Origin', 'https://attacker.invalid')
          .send(input)
      ).status,
    ).toBe(403);
    expect((await request(app).post('/auth/login').send({})).status).toBe(403);
    expect(
      (
        await post('/auth/register').send({
          name: 'Short',
          email: 'short@example.test',
          password: 'short',
        })
      ).status,
    ).toBe(422);
  });
});
describe('tenant-owned auctions', () => {
  it('requires authentication and filters lists by owner', async () => {
    expect((await request(app).get('/auctions')).status).toBe(401);
    const result = await request(app).get('/auctions').set('Cookie', a);
    expect(result.body.auctions.map((row: { id: string }) => row.id)).toContain(
      x,
    );
    expect(
      result.body.auctions.map((row: { id: string }) => row.id),
    ).not.toContain(y);
    expect(
      (
        await request(app)
          .get('/auctions/' + x)
          .set('Cookie', a)
      ).status,
    ).toBe(200);
  });
  it('blocks cross-tenant read, update, delete and undeveloped export paths', async () => {
    expect(
      (
        await request(app)
          .get('/auctions/' + y)
          .set('Cookie', a)
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .patch('/auctions/' + y)
          .set('Origin', origin)
          .set('Cookie', a)
          .send({ name: 'Hijack', version: 0 })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .delete('/auctions/' + y)
          .set('Origin', origin)
          .set('Cookie', a)
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .get('/auctions/' + y + '/export')
          .set('Cookie', a)
      ).status,
    ).toBe(404);
    expect(
      (await (await collections()).auctions.findOne({ _id: y }))?.name,
    ).toBe('B private auction');
  });
  it('supports independent denominations and rejects unsafe integer amounts and ownership injection', async () => {
    const created = await post('/auctions')
      .set('Cookie', a)
      .send({ ...input, name: 'Points season', denomination: 'POINTS' });
    expect(created.status).toBe(201);
    auctionIds.push(created.body.auction.id);
    expect(created.body.auction.denomination).toBe('POINTS');
    expect(
      (
        await post('/auctions')
          .set('Cookie', a)
          .send({ ...input, defaultBudget: 1.5 })
      ).status,
    ).toBe(422);
    expect(
      (
        await post('/auctions')
          .set('Cookie', a)
          .send({ ...input, defaultBudget: Number.MAX_SAFE_INTEGER + 1 })
      ).status,
    ).toBe(422);
    expect(
      (
        await post('/auctions')
          .set('Cookie', a)
          .send({ ...input, ownerId: users[1] })
      ).status,
    ).toBe(422);
  });
  it('audits draft edits and rejects stale versions', async () => {
    const changed = await request(app)
      .patch('/auctions/' + x)
      .set('Origin', origin)
      .set('Cookie', a)
      .send({ denomination: 'POINTS', version: 0 });
    expect(changed.status).toBe(200);
    expect(changed.body.auction.version).toBe(1);
    expect(
      (
        await request(app)
          .patch('/auctions/' + x)
          .set('Origin', origin)
          .set('Cookie', a)
          .send({ name: 'Stale', version: 0 })
      ).status,
    ).toBe(409);
    expect(
      await (
        await collections()
      ).audit.countDocuments({ auctionId: x, action: 'AUCTION_UPDATED' }),
    ).toBe(1);
  });
  it('locks denomination/settings/deletion after bidding begins', async () => {
    const c = await collections();
    await c.auctions.updateOne(
      { _id: x },
      { $set: { status: 'LIVE', startedAt: new Date() } },
    );
    expect(
      (
        await request(app)
          .patch('/auctions/' + x)
          .set('Origin', origin)
          .set('Cookie', a)
          .send({ denomination: 'INR', version: 1 })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .delete('/auctions/' + x)
          .set('Origin', origin)
          .set('Cookie', a)
      ).status,
    ).toBe(409);
    expect((await c.auctions.findOne({ _id: x }))?.denomination).toBe('POINTS');
  });
  it('deletes an owned draft with an audit record', async () => {
    expect(
      (
        await request(app)
          .delete('/auctions/' + y)
          .set('Origin', origin)
          .set('Cookie', b)
      ).status,
    ).toBe(204);
    const c = await collections();
    expect(await c.auctions.findOne({ _id: y })).toBeNull();
    expect(
      await c.audit.countDocuments({ auctionId: y, action: 'AUCTION_DELETED' }),
    ).toBe(1);
  });
});
it('enforces persistent email throttling', async () => {
  const email = 'rate-' + suffix + '@example.test';
  let last = 0;
  for (let i = 0; i < 31; i++) {
    last = (await post('/auth/login').send({ email, password: 'incorrect' }))
      .status;
  }
  expect(last).toBe(429);
});
