import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { collections, domain, disconnectDb } from '../packages/db/src';
import { createApp } from '../apps/api/src/app';
export const origin = 'http://localhost:3000';
export const auctionInput = {
  name: 'Test season',
  sport: 'Cricket',
  denomination: 'INR',
  defaultBudget: 10000,
  defaultSlots: 2,
  minimumPrice: 100,
  logoUrl: null,
};
export async function fixture() {
  const app = createApp(origin);
  app.set('trust proxy', 1);
  const ip = '198.51.100.' + (1 + Math.floor(Math.random() * 250));
  const userIds: string[] = [];
  const post = (path: string, cookie?: string) => {
    const r = request(app)
      .post(path)
      .set('Origin', origin)
      .set('X-Forwarded-For', ip);
    return cookie ? r.set('Cookie', cookie) : r;
  };
  async function user() {
    const response = await post('/auth/register').send({
      name: 'Fixture organizer',
      email: randomUUID() + '@example.test',
      password: 'Long fixture password 2026!',
    });
    if (response.status !== 201)
      throw new Error('Fixture registration failed ' + response.status);
    userIds.push(response.body.user.id);
    return String(response.headers['set-cookie']?.[0]).split(';')[0]!;
  }
  const a = await user(),
    b = await user();
  const result = await post('/auctions', a).send(auctionInput);
  if (result.status !== 201) throw new Error('Fixture auction failed');
  const id: string = result.body.auction.id;
  return {
    app,
    a,
    b,
    id,
    post,
    userIds,
    async cleanup() {
      const c = await collections(),
        d = await domain();
      const owned = await c.auctions
        .find({ ownerId: { $in: userIds } }, { projection: { _id: 1 } })
        .toArray();
      const ids = [id, ...owned.map((a) => a._id)];
      for (const col of [
        d.players,
        d.teams,
        d.imports,
        d.uploads,
        d.assets,
        d.lots,
        d.sales,
        d.engines,
      ])
        await col.deleteMany({ auctionId: { $in: ids } });
      await c.audit.deleteMany({ auctionId: { $in: ids } });
      await c.auctions.deleteMany({
        _id: { $in: ids },
        ownerId: { $in: userIds },
      });
      await c.sessions.deleteMany({ userId: { $in: userIds } });
      await c.users.deleteMany({ _id: { $in: userIds } });
      await disconnectDb();
    },
  };
}
