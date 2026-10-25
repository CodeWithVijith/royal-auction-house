import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { domain, collections } from '../packages/db/src';
import type { state } from '../apps/api/src/engine';
import { fixture } from './helpers';
type State = Awaited<ReturnType<typeof state>>;
let f: Awaited<ReturnType<typeof fixture>>,
  live: State,
  teamA: string,
  teamB: string,
  winning: Record<string, unknown>;
const selected: string[] = [];
async function action(name: string, body: object) {
  const response = await f
    .post('/auctions/' + f.id + '/live/' + name, f.a)
    .send(body);
  expect(response.status, response.body.error).toBe(200);
  live = response.body as State;
  return live;
}
beforeAll(async () => {
  f = await fixture();
  const uploaded = await f
    .post('/auctions/' + f.id + '/imports/upload?format=csv', f.a)
    .set('Content-Type', 'application/octet-stream')
    .send(Buffer.from('Name,ID\nAlice,A\nBob,B\nCharlie,C\n'));
  expect(uploaded.status).toBe(201);
  expect(
    (
      await f.post('/auctions/' + f.id + '/imports/commit', f.a).send({
        uploadId: uploaded.body.uploadId,
        sheet: 0,
        header: 0,
        mapping: { name: 0, registrationId: 1 },
      })
    ).status,
  ).toBe(200);
  const a = await f.post('/auctions/' + f.id + '/teams', f.a).send({
      name: 'Budget limited',
      budget: 2000,
      maxSlots: 2,
      logoUrl: null,
    }),
    b = await f.post('/auctions/' + f.id + '/teams', f.a).send({
      name: 'Slot limited',
      budget: 10000,
      maxSlots: 1,
      logoUrl: null,
    });
  expect(a.status).toBe(201);
  expect(b.status).toBe(201);
  teamA = a.body.id;
  teamB = b.body.id;
  await action('start', {});
});
afterAll(async () => {
  await f?.cleanup();
});
it('selects only queued players, persists pending selection, blocks another spin and isolates tenants', async () => {
  await action('spin', { version: live.engine!.version });
  selected.push(live.current!.playerId);
  const recovered = await request(f.app)
    .get('/auctions/' + f.id + '/live')
    .set('Cookie', f.a);
  expect(recovered.body.current._id).toBe(live.current!._id);
  expect(recovered.body.current.player._id).toBe(live.current!.playerId);
  expect(
    (
      await f
        .post('/auctions/' + f.id + '/live/spin', f.a)
        .send({ version: live.engine!.version })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(f.app)
        .get('/auctions/' + f.id + '/live')
        .set('Cookie', f.b)
    ).status,
  ).toBe(404);
});
it('two concurrent sale requests cannot double-sell or double-deduct', async () => {
  const first = {
      version: live.engine!.version,
      lotId: live.current!._id,
      requestId: randomUUID(),
      decision: 'SOLD',
      teamId: teamA,
      amount: 2000,
    },
    second = { ...first, requestId: randomUUID() };
  const responses = await Promise.all([
    f.post('/auctions/' + f.id + '/live/decision', f.a).send(first),
    f.post('/auctions/' + f.id + '/live/decision', f.a).send(second),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  const index = responses.findIndex((r) => r.status === 200);
  winning = index === 0 ? first : second;
  live = responses[index]!.body;
  const d = await domain();
  expect(await d.sales.countDocuments({ auctionId: f.id, void: false })).toBe(
    1,
  );
  expect(live.teams.find((t) => t._id === teamA)).toMatchObject({
    spent: 2000,
    remaining: 0,
    usedSlots: 1,
  });
});
it('retries one decision idempotently and rejects reuse with another amount', async () => {
  const result = await f
    .post('/auctions/' + f.id + '/live/decision', f.a)
    .send(winning);
  expect(result.status).toBe(200);
  expect(
    (
      await f
        .post('/auctions/' + f.id + '/live/decision', f.a)
        .send({ ...winning, amount: 1999 })
    ).status,
  ).toBe(409);
  expect(
    await (
      await domain()
    ).sales.countDocuments({ auctionId: f.id, void: false }),
  ).toBe(1);
});
it('does not replace earlier selections and enforces both budget and capacity transactionally', async () => {
  await action('spin', { version: live.engine!.version });
  selected.push(live.current!.playerId);
  await action('decision', {
    version: live.engine!.version,
    lotId: live.current!._id,
    requestId: randomUUID(),
    decision: 'SOLD',
    teamId: teamB,
    amount: 1000,
  });
  await action('spin', { version: live.engine!.version });
  selected.push(live.current!.playerId);
  expect(new Set(selected).size).toBe(3);
  const version = live.engine!.version,
    lotId = live.current!._id;
  for (const teamId of [teamA, teamB]) {
    const response = await f
      .post('/auctions/' + f.id + '/live/decision', f.a)
      .send({
        version,
        lotId,
        requestId: randomUUID(),
        decision: 'SOLD',
        teamId,
        amount: 100,
      });
    expect(response.status).toBe(409);
  }
  const recovered = await request(f.app)
    .get('/auctions/' + f.id + '/live')
    .set('Cookie', f.a);
  expect(recovered.body.engine.version).toBe(version);
  expect(recovered.body.current._id).toBe(lotId);
  expect(
    await (
      await domain()
    ).sales.countDocuments({ auctionId: f.id, void: false }),
  ).toBe(2);
});
it('UNSOLD leaves the ledger unchanged and retains round history', async () => {
  await action('decision', {
    version: live.engine!.version,
    lotId: live.current!._id,
    requestId: randomUUID(),
    decision: 'UNSOLD',
  });
  expect(live.engine?.queue).toHaveLength(0);
  expect(live.current).toBeNull();
  expect(live.history.filter((l) => l.status === 'UNSOLD')).toHaveLength(1);
  expect(live.teams.reduce((sum, t) => sum + t.spent, 0)).toBe(3000);
});
it('pauses authoritatively, prevents spins and rejects stale versions', async () => {
  await action('pause', { version: live.engine!.version });
  expect(live.engine?.paused).toBe(true);
  expect(
    (
      await f
        .post('/auctions/' + f.id + '/live/spin', f.a)
        .send({ version: live.engine!.version })
    ).status,
  ).toBe(409);
  expect(
    (
      await f
        .post('/auctions/' + f.id + '/live/resume', f.a)
        .send({ version: live.engine!.version - 1 })
    ).status,
  ).toBe(409);
});
it('audits an explicit undo without deleting history, requeues the player and retains balances', async () => {
  const lot = live.history.find((l) => l.status === 'UNSOLD')!;
  const correction = {
    version: live.engine!.version,
    lotId: lot._id,
    requestId: randomUUID(),
    reason: 'Organizer selected the wrong outcome',
  };
  await action('correct', correction);
  expect(
    (await f.post('/auctions/' + f.id + '/live/correct', f.a).send(correction))
      .status,
  ).toBe(200);
  expect(
    (
      await f
        .post('/auctions/' + f.id + '/live/correct', f.a)
        .send({ ...correction, reason: 'A different correction payload' })
    ).status,
  ).toBe(409);
  expect(live.engine?.queue).toEqual([lot.playerId]);
  expect(live.history.find((l) => l._id === lot._id)?.status).toBe('VOID');
  expect(
    await (
      await collections()
    ).audit.countDocuments({ auctionId: f.id, action: 'DECISION_VOIDED' }),
  ).toBe(1);
  await action('resume', { version: live.engine!.version });
  await action('spin', { version: live.engine!.version });
  expect(live.current?.playerId).toBe(lot.playerId);
  await action('decision', {
    version: live.engine!.version,
    lotId: live.current!._id,
    requestId: randomUUID(),
    decision: 'UNSOLD',
  });
  expect(live.teams.reduce((sum, t) => sum + t.spent, 0)).toBe(3000);
});
