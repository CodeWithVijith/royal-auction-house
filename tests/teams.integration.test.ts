import request from 'supertest';
import sharp from 'sharp';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { collections, domain } from '../packages/db/src';
import { fixture, origin } from './helpers';
let f: Awaited<ReturnType<typeof fixture>>, teamId: string;
const data = { name: 'Royals', budget: 5000, maxSlots: 2, logoUrl: null };
beforeAll(async () => {
  f = await fixture();
});
afterAll(async () => {
  await f?.cleanup();
});
it('creates teams, reconciles empty balances and rejects duplicate names and invalid numbers', async () => {
  const created = await f.post('/auctions/' + f.id + '/teams', f.a).send(data);
  expect(created.status).toBe(201);
  teamId = created.body.id;
  expect(
    (
      await f
        .post('/auctions/' + f.id + '/teams', f.a)
        .send({ ...data, name: 'ROYALS' })
    ).status,
  ).toBe(409);
  expect(
    (
      await f
        .post('/auctions/' + f.id + '/teams', f.a)
        .send({ ...data, budget: -1 })
    ).status,
  ).toBe(422);
  expect(
    (
      await f
        .post('/auctions/' + f.id + '/teams', f.a)
        .send({ ...data, maxSlots: 0 })
    ).status,
  ).toBe(422);
  const list = await request(f.app)
    .get('/auctions/' + f.id + '/teams')
    .set('Cookie', f.a);
  expect(list.body.teams[0]).toMatchObject({
    spent: 0,
    remaining: 5000,
    usedSlots: 0,
    remainingSlots: 2,
  });
  expect(list.body.denomination).toBe('INR');
});
it('isolates team read/write and rejects dangerous images', async () => {
  expect(
    (
      await request(f.app)
        .get('/auctions/' + f.id + '/teams')
        .set('Cookie', f.b)
    ).status,
  ).toBe(404);
  expect(
    (
      await request(f.app)
        .patch('/auctions/' + f.id + '/teams/' + teamId)
        .set('Origin', origin)
        .set('Cookie', f.b)
        .send(data)
    ).status,
  ).toBe(404);
  expect(
    (
      await f
        .post('/auctions/' + f.id + '/assets', f.a)
        .set('Content-Type', 'application/octet-stream')
        .send(Buffer.from('<svg onload="alert(1)"/>'))
    ).status,
  ).toBe(422);
});
it('stores sanitized private logos and denies cross-tenant reads', async () => {
  const png = await sharp({
    create: { width: 32, height: 32, channels: 3, background: '#ff9900' },
  })
    .png()
    .toBuffer();
  const uploaded = await f
    .post('/auctions/' + f.id + '/assets', f.a)
    .set('Content-Type', 'application/octet-stream')
    .send(png);
  expect(uploaded.status).toBe(201);
  const path = String(uploaded.body.url).replace('/api', '');
  const image = await request(f.app).get(path).set('Cookie', f.a);
  expect(image.status).toBe(200);
  expect(image.headers['content-type']).toContain('image/webp');
  expect((await sharp(image.body).metadata()).format).toBe('webp');
  expect((await request(f.app).get(path).set('Cookie', f.b)).status).toBe(404);
  expect(
    (
      await request(f.app)
        .patch('/auctions/' + f.id + '/teams/' + teamId)
        .set('Cookie', f.a)
        .set('Origin', origin)
        .send({ ...data, logoUrl: uploaded.body.url })
    ).status,
  ).toBe(200);
});
it('allows audited draft edits/deletes and prevents changes after a purchase', async () => {
  expect(
    (
      await request(f.app)
        .patch('/auctions/' + f.id + '/teams/' + teamId)
        .set('Origin', origin)
        .set('Cookie', f.a)
        .send({ ...data, budget: 6000 })
    ).status,
  ).toBe(200);
  const removable = await f
    .post('/auctions/' + f.id + '/teams', f.a)
    .send({ ...data, name: 'Delete me' });
  expect(
    (
      await request(f.app)
        .delete('/auctions/' + f.id + '/teams/' + removable.body.id)
        .set('Origin', origin)
        .set('Cookie', f.a)
    ).status,
  ).toBe(200);
  await (
    await collections()
  ).auctions.updateOne(
    { _id: f.id },
    { $set: { startedAt: new Date(), status: 'LIVE' } },
  );
  expect(
    (
      await request(f.app)
        .patch('/auctions/' + f.id + '/teams/' + teamId)
        .set('Origin', origin)
        .set('Cookie', f.a)
        .send(data)
    ).status,
  ).toBe(409);
  expect(
    (
      await request(f.app)
        .delete('/auctions/' + f.id + '/teams/' + teamId)
        .set('Origin', origin)
        .set('Cookie', f.a)
    ).status,
  ).toBe(409);
  expect(await (await domain()).teams.countDocuments({ auctionId: f.id })).toBe(
    1,
  );
});
