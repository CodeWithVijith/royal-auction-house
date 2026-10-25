import { collections } from '@sports/db';
import type { ClientSession } from 'mongodb';
import { z } from 'zod';
import { HttpError } from './errors';
export function validId(value: unknown) {
  const result = z.string().uuid().safeParse(value);
  if (!result.success) throw new HttpError(404, 'NOT_FOUND');
  return result.data;
}
export async function owned(
  auctionId: string,
  ownerId: string,
  session?: ClientSession,
) {
  const c = await collections();
  const auction = await c.auctions.findOne(
    { _id: auctionId, ownerId },
    session ? { session } : {},
  );
  if (!auction) throw new HttpError(404, 'NOT_FOUND');
  return auction;
}
export async function touch(
  auctionId: string,
  ownerId: string,
  session: ClientSession,
) {
  await (
    await collections()
  ).auctions.updateOne(
    { _id: auctionId, ownerId },
    { $inc: { version: 1 }, $set: { updatedAt: new Date() } },
    { session },
  );
}
export async function transact<T>(
  work: (session: ClientSession) => Promise<T>,
) {
  const c = await collections();
  const session = c.db.client.startSession();
  try {
    return await session.withTransaction(() => work(session), {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
    });
  } finally {
    await session.endSession();
  }
}
