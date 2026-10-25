import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { collections, type AuctionRecord } from '@sports/db';
import {
  createAuctionSchema,
  updateAuctionSchema,
  type AuctionInput,
} from '@sports/shared';
import { z } from 'zod';
import { currentUser, requireUser } from './auth';
import { HttpError } from './errors';
function dto(a: AuctionRecord) {
  return {
    id: a._id,
    name: a.name,
    sport: a.sport,
    denomination: a.denomination,
    defaultBudget: a.defaultBudget,
    defaultSlots: a.defaultSlots,
    minimumPrice: a.minimumPrice,
    logoUrl: a.logoUrl,
    status: a.status,
    version: a.version,
    createdAt: a.createdAt,
  };
}
function id(value: unknown) {
  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success) throw new HttpError(404, 'NOT_FOUND');
  return parsed.data;
}
export function auctionRouter() {
  const router = Router();
  router.use(requireUser);
  router.get('/', async (_req, res) => {
    const { auctions } = await collections();
    const rows = await auctions
      .find({ ownerId: currentUser(res)._id })
      .sort({ createdAt: -1, _id: -1 })
      .limit(100)
      .toArray();
    res.json({ auctions: rows.map(dto) });
  });
  router.post('/', async (req, res) => {
    const input = createAuctionSchema.parse(req.body);
    const c = await collections();
    const now = new Date();
    const auction: AuctionRecord = {
      ...input,
      _id: randomUUID(),
      ownerId: currentUser(res)._id,
      status: 'DRAFT',
      version: 0,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
    };
    const session = c.db.client.startSession();
    try {
      await session.withTransaction(async () => {
        await c.auctions.insertOne(auction, { session });
        await c.audit.insertOne(
          {
            _id: randomUUID(),
            auctionId: auction._id,
            actorId: auction.ownerId,
            action: 'AUCTION_CREATED',
            at: now,
          },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
    res.status(201).json({ auction: dto(auction) });
  });
  router.get('/:id', async (req, res) => {
    const auction = await (
      await collections()
    ).auctions.findOne({
      _id: id(req.params.id),
      ownerId: currentUser(res)._id,
    });
    if (!auction) throw new HttpError(404, 'NOT_FOUND');
    res.json({ auction: dto(auction) });
  });
  router.patch('/:id', async (req, res) => {
    const auctionId = id(req.params.id);
    const input = updateAuctionSchema.parse(req.body);
    const { version, ...fields } = input;
    const changes = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    ) as Partial<AuctionInput>;
    const c = await collections();
    const ownerId = currentUser(res)._id;
    const session = c.db.client.startSession();
    try {
      const auction = await session.withTransaction(async () => {
        const existing = await c.auctions.findOne(
          { _id: auctionId, ownerId },
          { session },
        );
        if (!existing) throw new HttpError(404, 'NOT_FOUND');
        if (existing.status !== 'DRAFT' || existing.startedAt !== null)
          throw new HttpError(409, 'AUCTION_LOCKED');
        const updated = await c.auctions.findOneAndUpdate(
          {
            _id: auctionId,
            ownerId,
            version,
            status: 'DRAFT',
            startedAt: null,
          },
          { $set: { ...changes, updatedAt: new Date() }, $inc: { version: 1 } },
          { session, returnDocument: 'after' },
        );
        if (!updated) throw new HttpError(409, 'STALE_AUCTION');
        await c.audit.insertOne(
          {
            _id: randomUUID(),
            auctionId,
            actorId: ownerId,
            action: 'AUCTION_UPDATED',
            at: new Date(),
            changes,
          },
          { session },
        );
        return updated;
      });
      if (!auction) throw new HttpError(409, 'STALE_AUCTION');
      res.json({ auction: dto(auction) });
    } finally {
      await session.endSession();
    }
  });
  router.delete('/:id', async (req, res) => {
    const auctionId = id(req.params.id);
    const c = await collections();
    const ownerId = currentUser(res)._id;
    const session = c.db.client.startSession();
    try {
      await session.withTransaction(async () => {
        const auction = await c.auctions.findOne(
          { _id: auctionId, ownerId },
          { session },
        );
        if (!auction) throw new HttpError(404, 'NOT_FOUND');
        if (auction.status !== 'DRAFT' || auction.startedAt !== null)
          throw new HttpError(409, 'AUCTION_LOCKED');
        await c.auctions.deleteOne(
          { _id: auctionId, ownerId, version: auction.version },
          { session },
        );
        await c.audit.insertOne(
          {
            _id: randomUUID(),
            auctionId,
            actorId: ownerId,
            action: 'AUCTION_DELETED',
            at: new Date(),
          },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
    res.status(204).end();
  });
  return router;
}
