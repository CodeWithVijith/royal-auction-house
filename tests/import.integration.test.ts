import ExcelJS from 'exceljs';
import request from 'supertest';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { collections, domain } from '../packages/db/src';
import { fixture } from './helpers';
let f: Awaited<ReturnType<typeof fixture>>;
let bytes: Buffer, uploadId: string;
const mapping = { name: 0, dob: 1, previousTeam: 2, registrationId: 3 };
beforeAll(async () => {
  f = await fixture();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Form responses');
  sheet.addRow([
    'Full name',
    'DOB',
    'Old club',
    'Registration',
    ...Array.from({ length: 35 }, (_, i) => 'Private ' + i),
  ]);
  sheet.addRow([
    'Alice',
    36526,
    'Royals',
    'ID-1',
    ...Array(35).fill('private@example.test'),
  ]);
  sheet.addRow([
    'Bob',
    new Date('1995-05-10T00:00:00Z'),
    'Kings',
    'ID-2',
    ...Array(35).fill('street address'),
  ]);
  bytes = Buffer.from(await workbook.xlsx.writeBuffer());
  const uploaded = await f
    .post('/auctions/' + f.id + '/imports/upload?format=xlsx', f.a)
    .set('Content-Type', 'application/octet-stream')
    .send(bytes);
  expect(uploaded.status).toBe(201);
  uploadId = uploaded.body.uploadId;
});
afterAll(async () => {
  await f?.cleanup();
});
const input = () => ({ uploadId, sheet: 0, header: 0, mapping });
it('maps a 39-column XLSX while discarding unmapped personal details and normalizing dates', async () => {
  const preview = await f
    .post('/auctions/' + f.id + '/imports/preview', f.a)
    .send(input());
  expect(preview.status).toBe(200);
  expect(preview.body.invalid).toBe(0);
  expect(preview.body.rows[0].player.dob).toBe('2000-01-01');
  const committed = await f
    .post('/auctions/' + f.id + '/imports/commit', f.a)
    .send(input());
  expect(committed.status).toBe(200);
  expect(committed.body.inserted).toBe(2);
  const players = await (
    await domain()
  ).players
    .find({ auctionId: f.id })
    .toArray();
  expect(players).toHaveLength(2);
  expect(JSON.stringify(players)).not.toContain('private@example.test');
  expect(JSON.stringify(players)).not.toContain('street address');
  expect(Object.keys(players[0]!)).not.toContain('Private 0');
});
it('is idempotent for duplicate commits and repeat uploads', async () => {
  const retry = await f
    .post('/auctions/' + f.id + '/imports/commit', f.a)
    .send(input());
  expect(retry.body.inserted).toBe(0);
  const uploaded = await f
    .post('/auctions/' + f.id + '/imports/upload?format=xlsx', f.a)
    .set('Content-Type', 'application/octet-stream')
    .send(bytes);
  const repeated = await f
    .post('/auctions/' + f.id + '/imports/commit', f.a)
    .send({ ...input(), uploadId: uploaded.body.uploadId });
  expect(repeated.body.inserted).toBe(0);
  expect(
    await (await domain()).players.countDocuments({ auctionId: f.id }),
  ).toBe(2);
});
it('reports missing name and invalid birth date and blocks commit', async () => {
  const upload = await f
    .post('/auctions/' + f.id + '/imports/upload?format=csv', f.a)
    .set('Content-Type', 'application/octet-stream')
    .send(Buffer.from('Name,DOB\n,2020-99-01\n'));
  const body = {
    uploadId: upload.body.uploadId,
    sheet: 0,
    header: 0,
    mapping: { name: 0, dob: 1 },
  };
  const preview = await f
    .post('/auctions/' + f.id + '/imports/preview', f.a)
    .send(body);
  expect(preview.body.invalid).toBe(1);
  expect(preview.body.rows[0].errors.length).toBeGreaterThan(0);
  expect(
    (await f.post('/auctions/' + f.id + '/imports/commit', f.a).send(body))
      .status,
  ).toBe(422);
});
it('rejects malformed workbooks, oversize uploads and foreign upload IDs', async () => {
  expect(
    (
      await f
        .post('/auctions/' + f.id + '/imports/upload?format=xlsx', f.a)
        .set('Content-Type', 'application/octet-stream')
        .send(Buffer.from('not a zip'))
    ).status,
  ).toBe(422);
  expect(
    (
      await f
        .post('/auctions/' + f.id + '/imports/upload?format=csv', f.a)
        .set('Content-Type', 'application/octet-stream')
        .send(Buffer.alloc(5 * 1024 * 1024 + 1))
    ).status,
  ).toBe(413);
  expect(
    (await f.post('/auctions/' + f.id + '/imports/preview', f.b).send(input()))
      .status,
  ).toBe(404);
  expect(
    (
      await request(f.app)
        .get('/auctions/' + f.id + '/players')
        .set('Cookie', f.b)
    ).status,
  ).toBe(404);
});
it('preserves outcomes and disallows new players once bidding has started', async () => {
  const d = await domain();
  await d.players.updateOne(
    { auctionId: f.id, registrationId: 'ID-1' },
    { $set: { status: 'SOLD' } },
  );
  await (
    await collections()
  ).auctions.updateOne(
    { _id: f.id },
    { $set: { startedAt: new Date(), status: 'LIVE' } },
  );
  expect(
    (await f.post('/auctions/' + f.id + '/imports/commit', f.a).send(input()))
      .status,
  ).toBe(200);
  expect(
    (await d.players.findOne({ auctionId: f.id, registrationId: 'ID-1' }))
      ?.status,
  ).toBe('SOLD');
  const upload = await f
    .post('/auctions/' + f.id + '/imports/upload?format=csv', f.a)
    .set('Content-Type', 'application/octet-stream')
    .send(Buffer.from('Name\nCharlie\n'));
  const result = await f
    .post('/auctions/' + f.id + '/imports/commit', f.a)
    .send({
      uploadId: upload.body.uploadId,
      sheet: 0,
      header: 0,
      mapping: { name: 0 },
    });
  expect(result.status).toBe(409);
  expect(await d.players.countDocuments({ auctionId: f.id })).toBe(2);
});
