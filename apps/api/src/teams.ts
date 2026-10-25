import express, { Router } from 'express';

import sharp from 'sharp';
import { writeAsset, readAsset, discardAsset } from './storage';
import { randomUUID } from 'node:crypto';
import {
  collections,
  domain,
  type TeamRecord,
  type SaleRecord,
} from '@sports/db';
import { z } from 'zod';
import { currentUser, requireUser } from './auth';
import { owned, touch, transact, validId } from './owned';
import { HttpError } from './errors';
export const teamSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    budget: z.number().int().nonnegative().safe(),
    maxSlots: z.number().int().min(1).max(1000),
    logoUrl: z.string().max(2048).nullable().default(null),
  })
  .strict();
export function teamTotals(team: TeamRecord, sales: SaleRecord[]) {
  const purchases = sales.filter((s) => s.teamId === team._id && !s.void);
  const spent = purchases.reduce((sum, s) => sum + s.amount, 0);
  if (!Number.isSafeInteger(spent)) throw new HttpError(500, 'LEDGER_RANGE');
  return {
    ...team,
    spent,
    remaining: team.budget - spent,
    usedSlots: purchases.length,
    remainingSlots: team.maxSlots - purchases.length,
    purchases,
  };
}
export function teamRouter() {
  const r = Router({ mergeParams: true });
  r.use(requireUser);
  r.use(async (req, res, next) => {
    const auctionId = validId(req.params.id);
    await owned(auctionId, currentUser(res)._id);
    res.locals.auctionId = auctionId;
    next();
  });
  r.get('/teams', async (_req, res) => {
    const d = await domain();
    const auctionId = res.locals.auctionId as string;
    const a = await owned(auctionId, currentUser(res)._id);
    const [teams, sales] = await Promise.all([
      d.teams.find({ auctionId }).sort({ name: 1 }).toArray(),
      d.sales.find({ auctionId, void: false }).toArray(),
    ]);
    res.json({
      denomination: a.denomination,
      teams: teams.map((t) => teamTotals(t, sales)),
    });
  });
  for (const method of ['post', 'patch', 'delete'] as const) {
    r[method](
      method === 'post' ? '/teams' : '/teams/:teamId',
      async (req, res) => {
        const auctionId = res.locals.auctionId as string,
          ownerId = currentUser(res)._id;
        const teamId =
          method === 'post'
            ? randomUUID()
            : validId((req.params as { teamId?: string }).teamId);
        const input = method === 'delete' ? null : teamSchema.parse(req.body);
        const result = await transact(async (session) => {
          const a = await owned(auctionId, ownerId, session);
          if (a.startedAt !== null || a.status !== 'DRAFT')
            throw new HttpError(409, 'TEAM_LOCKED');
          await touch(auctionId, ownerId, session);
          const d = await domain();
          if (method !== 'post') {
            if (
              !(await d.teams.findOne({ _id: teamId, auctionId }, { session }))
            )
              throw new HttpError(404, 'NOT_FOUND');
            if (await d.sales.findOne({ auctionId, teamId }, { session }))
              throw new HttpError(409, 'TEAM_HAS_PURCHASES');
          }
          if (input?.logoUrl) {
            const prefix = '/api/auctions/' + auctionId + '/assets/';
            if (
              !input.logoUrl.startsWith(prefix) ||
              !(await d.assets.findOne(
                { _id: validId(input.logoUrl.slice(prefix.length)), auctionId },
                { session },
              ))
            )
              throw new HttpError(422, 'INVALID_LOGO');
          }
          if (method === 'delete')
            await d.teams.deleteOne({ _id: teamId, auctionId }, { session });
          else {
            const data = { ...input!, nameKey: input!.name.toLowerCase() };
            if (method === 'post')
              await d.teams.insertOne(
                { _id: teamId, auctionId, ...data, version: 0 },
                { session },
              );
            else
              await d.teams.updateOne(
                { _id: teamId, auctionId },
                { $set: data, $inc: { version: 1 } },
                { session },
              );
          }
          await (
            await collections()
          ).audit.insertOne(
            {
              _id: randomUUID(),
              auctionId,
              actorId: ownerId,
              action:
                'TEAM_' +
                (method === 'post'
                  ? 'CREATED'
                  : method === 'patch'
                    ? 'EDITED'
                    : 'DELETED'),
              at: new Date(),
              changes: { teamId },
            },
            { session },
          );
          return { id: teamId };
        });
        res.status(method === 'post' ? 201 : 200).json(result);
      },
    );
  }
  r.post(
    '/assets',
    express.raw({ type: () => true, limit: '2mb' }),
    async (req, res) => {
      const auctionId = res.locals.auctionId as string;
      await owned(auctionId, currentUser(res)._id);
      if (!Buffer.isBuffer(req.body) || req.body.length === 0)
        throw new HttpError(422, 'INVALID_IMAGE');
      let bytes: Buffer;
      try {
        const image = sharp(req.body, {
          limitInputPixels: 4000000,
          animated: false,
        });
        const metadata = await image.metadata();
        if (
          !['jpeg', 'png', 'webp'].includes(metadata.format ?? '') ||
          (metadata.pages ?? 1) > 1
        )
          throw new Error('Format');
        bytes = await image
          .rotate()
          .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer();
      } catch {
        throw new HttpError(422, 'INVALID_IMAGE');
      }
      const id = randomUUID();
      const stored = await writeAsset(auctionId, id, bytes);
      try {
        await transact(async (session) => {
          const a = await owned(auctionId, currentUser(res)._id, session);
          if (a.startedAt !== null) throw new HttpError(409, 'AUCTION_LOCKED');
          await touch(auctionId, currentUser(res)._id, session);
          await (
            await domain()
          ).assets.insertOne(
            {
              _id: id,
              auctionId,
              ...stored,
              createdAt: new Date(),
            },
            { session },
          );
        });
      } catch (error) {
        if (stored.objectKey)
          await discardAsset(stored.objectKey).catch(() => undefined);
        throw error;
      }
      res
        .status(201)
        .json({ url: '/api/auctions/' + auctionId + '/assets/' + id });
    },
  );
  r.get('/assets/:assetId', async (req, res) => {
    const asset = await (
      await domain()
    ).assets.findOne({
      _id: validId(req.params.assetId),
      auctionId: res.locals.auctionId,
    });
    if (!asset) throw new HttpError(404, 'NOT_FOUND');
    res
      .set('Content-Type', 'image/webp')
      .set('X-Content-Type-Options', 'nosniff')
      .send(await readAsset(asset));
  });
  return r;
}
