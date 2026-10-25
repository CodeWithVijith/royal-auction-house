import { randomUUID } from 'node:crypto';
import type { Response } from 'supertest';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { beforeAll, afterAll, it, expect } from 'vitest';
import type { state } from '../apps/api/src/engine';
import { fixture, origin, auctionInput } from './helpers';
import { domain } from '../packages/db/src';
type State = Awaited<ReturnType<typeof state>>;
let f: Awaited<ReturnType<typeof fixture>>,
  live: State,
  teamId: string,
  unsoldId: string;
async function act(action: string, body: object) {
  const response = await f
    .post('/auctions/' + f.id + '/live/' + action, f.a)
    .send(body);
  expect(response.status, response.body.error).toBe(200);
  live = response.body;
  return live;
}
function binary(
  response: Response,
  done: (error: Error | null, body?: Buffer) => void,
) {
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer) => chunks.push(chunk));
  response.on('end', () => done(null, Buffer.concat(chunks)));
  response.on('error', done);
}
async function exported() {
  const response = await request(f.app)
    .get('/auctions/' + f.id + '/export')
    .set('Cookie', f.a)
    .buffer(true)
    .parse(binary);
  expect(response.status).toBe(200);
  expect(response.headers['content-disposition']).toContain('.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    response.body as Parameters<typeof workbook.xlsx.load>[0],
  );
  return workbook;
}
beforeAll(async () => {
  f = await fixture();
  const upload = await f
    .post('/auctions/' + f.id + '/imports/upload?format=csv', f.a)
    .set('Content-Type', 'application/octet-stream')
    .send(Buffer.from('Name,ID\n=2+2,ONE\nBob,TWO\n'));
  expect(
    (
      await f.post('/auctions/' + f.id + '/imports/commit', f.a).send({
        uploadId: upload.body.uploadId,
        sheet: 0,
        header: 0,
        mapping: { name: 0, registrationId: 1 },
      })
    ).status,
  ).toBe(200);
  const team = await f
    .post('/auctions/' + f.id + '/teams', f.a)
    .send({ name: '+Kings', budget: 10000, maxSlots: 3, logoUrl: null });
  teamId = team.body.id;
  await act('start', {});
  await act('spin', { version: live.engine!.version });
  unsoldId = live.current!.playerId;
  await act('decision', {
    version: live.engine!.version,
    lotId: live.current!._id,
    requestId: randomUUID(),
    decision: 'UNSOLD',
  });
  await act('spin', { version: live.engine!.version });
  await act('decision', {
    version: live.engine!.version,
    lotId: live.current!._id,
    requestId: randomUUID(),
    decision: 'SOLD',
    teamId,
    amount: 1000,
  });
});
afterAll(async () => {
  await f?.cleanup();
});
it('exports six reconciled DRAFT sheets with exact denominations and safe text', async () => {
  const workbook = await exported();
  expect(workbook.worksheets.map((s) => s.name)).toEqual([
    'Summary',
    'All Players',
    'Sold Players',
    'Unsold Players',
    'Teams',
    'Transactions',
  ]);
  expect(workbook.getWorksheet('Summary')!.getCell('A2').value).toBe('DRAFT');
  expect(workbook.getWorksheet('Summary')!.getCell('I2').value).toBe(1000);
  expect(workbook.getWorksheet('Teams')!.getCell('E2').value).toBe(1000);
  expect(workbook.getWorksheet('Teams')!.getCell('F2').value).toBe(9000);
  expect(workbook.getWorksheet('Teams')!.getCell('C2').value).toBe("'+Kings");
  const values = workbook.getWorksheet('All Players')!.getColumn(4).values;
  expect(values).toContain("'=2+2");
  expect(workbook.getWorksheet('Transactions')!.getCell('F2').value).toBe(
    'INR',
  );
});
it('denies foreign results/export and separates another auction denomination', async () => {
  expect(
    (
      await request(f.app)
        .get('/auctions/' + f.id + '/export')
        .set('Cookie', f.b)
    ).status,
  ).toBe(404);
  expect(
    (
      await request(f.app)
        .get('/auctions/' + f.id + '/results')
        .set('Cookie', f.b)
    ).status,
  ).toBe(404);
  const other = await f.post('/auctions', f.a).send({
    ...auctionInput,
    name: 'Separate points auction',
    denomination: 'POINTS',
  });
  const result = await request(f.app)
    .get('/auctions/' + other.body.auction.id + '/results')
    .set('Cookie', f.a);
  expect(result.status).toBe(200);
  expect(result.body.auction.denomination).toBe('POINTS');
  expect(result.body.players).toHaveLength(0);
  expect(result.body.teams).toHaveLength(0);
});
it('explicitly queues only final UNSOLD players and preserves first-round attempts', async () => {
  const next = await f
    .post('/auctions/' + f.id + '/rounds/unsold', f.a)
    .send({ version: live.engine!.version });
  expect(next.status, next.body.error).toBe(200);
  expect(next.body.engine.queue).toEqual([unsoldId]);
  expect(next.body.engine.round).toBe(2);
  live = (
    await request(f.app)
      .get('/auctions/' + f.id + '/live')
      .set('Cookie', f.a)
  ).body;
  await act('spin', { version: live.engine!.version });
  expect(live.current!.playerId).toBe(unsoldId);
  await act('decision', {
    version: live.engine!.version,
    lotId: live.current!._id,
    requestId: randomUUID(),
    decision: 'SOLD',
    teamId,
    amount: 2000,
  });
  const attempts = await (
    await domain()
  ).lots
    .find({ auctionId: f.id, playerId: unsoldId })
    .sort({ round: 1 })
    .toArray();
  expect(attempts.map((a) => a.status)).toEqual(['UNSOLD', 'SOLD']);
});
it('freezes completion and exports final ledger totals, with only audited corrections allowed', async () => {
  const response = await f
    .post('/auctions/' + f.id + '/complete', f.a)
    .send({ version: live.engine!.version });
  expect(response.status).toBe(200);
  expect(response.body.auction.label).toBe('FINAL');
  expect(response.body.summary).toMatchObject({
    sold: 2,
    unsold: 0,
    spent: 3000,
  });
  const workbook = await exported();
  expect(workbook.getWorksheet('Summary')!.getCell('A2').value).toBe('FINAL');
  expect(workbook.getWorksheet('Summary')!.getCell('I2').value).toBe(3000);
  expect(workbook.getWorksheet('Teams')!.getCell('F2').value).toBe(7000);
  expect(
    (
      await f
        .post('/auctions/' + f.id + '/live/spin', f.a)
        .send({ version: response.body.engine.version })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(f.app)
        .patch('/auctions/' + f.id)
        .set('Origin', origin)
        .set('Cookie', f.a)
        .send({ version: 0, name: 'Silent change' })
    ).status,
  ).toBe(409);
  const latest = response.body.attempts
    .filter((a: { status: string }) => a.status === 'SOLD')
    .at(-1);
  expect(
    (
      await f.post('/auctions/' + f.id + '/live/correct', f.a).send({
        version: response.body.engine.version,
        lotId: latest._id,
        requestId: randomUUID(),
        reason: 'Correcting final organizer input mistake',
      })
    ).status,
  ).toBe(200);
});
