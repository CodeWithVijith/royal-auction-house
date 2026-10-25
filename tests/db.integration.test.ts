import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, expect, it } from 'vitest';
import { connectDb, disconnectDb, systemMetadata } from '../packages/db/src';
import { createApp } from '../apps/api/src/app';
afterAll(disconnectDb);
it('queries real MongoDB and verifies persisted bootstrap metadata', async () => {
  expect(
    await (await systemMetadata()).findOne({ _id: 'schema_version' }),
  ).toMatchObject({ value: 'bootstrap' });
  const response = await request(createApp()).get('/health/ready');
  expect(response.status).toBe(200);
  expect(response.body.database).toBe('connected');
});
it('supports a real multi-document transaction and safe rollback', async () => {
  const database = await connectDb();
  // Initialize collections before opening the transaction.
  await database.collection('transaction_probes').createIndex({ probe: 1 });
  const session = database.client.startSession();
  const probe = randomUUID();
  try {
    session.startTransaction();
    await database.collection('transaction_probes').insertMany(
      [
        { probe, step: 1 },
        { probe, step: 2 },
      ],
      { session },
    );
    expect(
      await database
        .collection('transaction_probes')
        .countDocuments({ probe }, { session }),
    ).toBe(2);
    await session.abortTransaction();
    expect(
      await database.collection('transaction_probes').countDocuments({ probe }),
    ).toBe(0);
  } finally {
    if (session.inTransaction()) await session.abortTransaction();
    await session.endSession();
  }
});
