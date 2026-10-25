import { randomInt, randomUUID, createHash } from 'node:crypto';
import { Router } from 'express';
import type { ClientSession } from 'mongodb';
import { collections, domain, type EngineRecord } from '@sports/db';
import { z } from 'zod';
import { requireUser, currentUser } from './auth';
import { owned, touch, transact, validId } from './owned';
import { teamTotals } from './teams';
import { HttpError } from './errors';
const versionSchema = z
  .object({ version: z.number().int().nonnegative() })
  .strict();
const decisionSchema = z
  .object({
    version: z.number().int().nonnegative(),
    lotId: z.string().uuid(),
    requestId: z.string().uuid(),
    decision: z.enum(['SOLD', 'UNSOLD']),
    teamId: z.string().uuid().optional(),
    amount: z.number().int().positive().safe().optional(),
  })
  .strict();
export async function state(
  auctionId: string,
  ownerId: string,
  session?: ClientSession,
) {
  const a = await owned(auctionId, ownerId, session),
    d = await domain(),
    opts = session ? { session } : {};
  const engine = await d.engines.findOne({ _id: auctionId, auctionId }, opts);
  const current = engine?.pendingId
    ? await d.lots.findOne({ _id: engine.pendingId, auctionId }, opts)
    : null;
  const player = current
    ? await d.players.findOne({ _id: current.playerId, auctionId }, opts)
    : null;
  const teams = await d.teams
      .find({ auctionId }, opts)
      .sort({ name: 1 })
      .toArray(),
    sales = await d.sales.find({ auctionId, void: false }, opts).toArray();
  const history = await d.lots
    .find({ auctionId, status: { $in: ['SOLD', 'UNSOLD', 'VOID'] } }, opts)
    .sort({ decisionVersion: -1 })
    .limit(20)
    .toArray();
  const names = await d.players
    .find({ auctionId, _id: { $in: history.map((l) => l.playerId) } }, opts)
    .project<{ _id: string; name: string }>({ _id: 1, name: 1 })
    .toArray();
  const byId = new Map(names.map((p) => [p._id, p.name]));
  return {
    auction: {
      id: a._id,
      name: a.name,
      version: a.version,
      status: a.status,
      denomination: a.denomination,
      minimumPrice: a.minimumPrice,
    },
    engine,
    current: current ? { ...current, player } : null,
    teams: teams.map((team) => teamTotals(team, sales)),
    history: history.map((lot) => ({
      ...lot,
      playerName: byId.get(lot.playerId) ?? lot.playerId,
    })),
  };
}
async function engineFor(
  auctionId: string,
  version: number,
  session: ClientSession,
) {
  const e = await (
    await domain()
  ).engines.findOne({ _id: auctionId, auctionId }, { session });
  if (!e) throw new HttpError(409, 'AUCTION_NOT_STARTED');
  if (e.version !== version) throw new HttpError(409, 'STALE_STATE');
  if (e.completed) throw new HttpError(409, 'AUCTION_COMPLETED');
  return e;
}
async function audit(
  auctionId: string,
  actorId: string,
  action: string,
  changes: Record<string, unknown>,
  session: ClientSession,
) {
  await (
    await collections()
  ).audit.insertOne(
    { _id: randomUUID(), auctionId, actorId, action, at: new Date(), changes },
    { session },
  );
}
export function engineRouter() {
  const r = Router({ mergeParams: true });
  r.use(requireUser);
  r.use(async (req, res, next) => {
    const auctionId = validId(req.params.id);
    await owned(auctionId, currentUser(res)._id);
    res.locals.auctionId = auctionId;
    next();
  });
  r.get('/live', async (_req, res) => {
    res.json(
      await transact((s) =>
        state(res.locals.auctionId, currentUser(res)._id, s),
      ),
    );
  });
  r.post('/live/start', async (_req, res) => {
    const auctionId = res.locals.auctionId as string,
      ownerId = currentUser(res)._id;
    await transact(async (session) => {
      const a = await owned(auctionId, ownerId, session),
        d = await domain();
      if (a.status !== 'DRAFT' || a.startedAt !== null)
        throw new HttpError(409, 'AUCTION_ALREADY_STARTED');
      const players = await d.players
        .find({ auctionId, status: 'AVAILABLE' }, { session })
        .sort({ _id: 1 })
        .toArray();
      if (
        !players.length ||
        !(await d.teams.findOne({ auctionId }, { session }))
      )
        throw new HttpError(409, 'SETUP_REQUIRED');
      await touch(auctionId, ownerId, session);
      await (
        await collections()
      ).auctions.updateOne(
        { _id: auctionId, ownerId },
        { $set: { status: 'LIVE', startedAt: new Date() } },
        { session },
      );
      const engine: EngineRecord = {
        _id: auctionId,
        auctionId,
        version: 0,
        round: 1,
        queue: players.map((p) => p._id),
        pendingId: null,
        paused: false,
        completed: false,
        autoNext: true,
        delayMs: 1500,
      };
      await d.engines.insertOne(engine, { session });
      await audit(
        auctionId,
        ownerId,
        'ROUND_STARTED',
        { round: 1, count: players.length },
        session,
      );
    });
    res.json(await transact((s) => state(auctionId, ownerId, s)));
  });
  r.post('/live/spin', async (req, res) => {
    const input = versionSchema.parse(req.body),
      auctionId = res.locals.auctionId as string,
      ownerId = currentUser(res)._id;
    await transact(async (session) => {
      await owned(auctionId, ownerId, session);
      const d = await domain(),
        e = await engineFor(auctionId, input.version, session);
      if (e.paused) throw new HttpError(409, 'AUCTION_PAUSED');
      if (e.pendingId) throw new HttpError(409, 'DECISION_PENDING');
      if (!e.queue.length) throw new HttpError(409, 'ROUND_FINISHED');
      const index = randomInt(e.queue.length),
        playerId = e.queue[index]!;
      const player = await d.players.findOne(
        { _id: playerId, auctionId, status: { $in: ['AVAILABLE', 'UNSOLD'] } },
        { session },
      );
      if (!player) throw new HttpError(409, 'PLAYER_NOT_AVAILABLE');
      await touch(auctionId, ownerId, session);
      const lotId = randomUUID();
      await d.lots.insertOne(
        {
          _id: lotId,
          auctionId,
          round: e.round,
          playerId,
          status: 'PENDING',
          actorId: ownerId,
          createdAt: new Date(),
          decidedAt: null,
          requestId: null,
          decisionHash: null,
          selectionIndex: index,
          eligibleCount: e.queue.length,
          decisionVersion: null,
        },
        { session },
      );
      await d.players.updateOne(
        { _id: playerId, auctionId },
        { $set: { status: 'SELECTED' } },
        { session },
      );
      await d.engines.updateOne(
        { _id: auctionId, auctionId, version: e.version },
        {
          $set: {
            queue: e.queue.filter((id) => id !== playerId),
            pendingId: lotId,
          },
          $inc: { version: 1 },
        },
        { session },
      );
      await audit(
        auctionId,
        ownerId,
        'PLAYER_SELECTED',
        { lotId, playerId, round: e.round },
        session,
      );
    });
    res.json(await transact((s) => state(auctionId, ownerId, s)));
  });
  r.post('/live/decision', async (req, res) => {
    const input = decisionSchema.parse(req.body),
      auctionId = res.locals.auctionId as string,
      ownerId = currentUser(res)._id;
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex');
    await transact(async (session) => {
      await owned(auctionId, ownerId, session);
      const d = await domain();
      const previous = await d.lots.findOne(
        { auctionId, requestId: input.requestId },
        { session },
      );
      if (previous) {
        if (previous.decisionHash !== fingerprint)
          throw new HttpError(409, 'IDEMPOTENCY_CONFLICT');
        return;
      }
      const e = await engineFor(auctionId, input.version, session);
      if (e.pendingId !== input.lotId)
        throw new HttpError(409, 'STALE_SELECTION');
      const lot = await d.lots.findOne(
        { _id: input.lotId, auctionId, status: 'PENDING' },
        { session },
      );
      if (!lot) throw new HttpError(409, 'STALE_SELECTION');
      const a = await owned(auctionId, ownerId, session);
      await touch(auctionId, ownerId, session);
      if (input.decision === 'SOLD') {
        if (
          !input.teamId ||
          !input.amount ||
          input.amount < Math.max(a.minimumPrice ?? 0, 1)
        )
          throw new HttpError(422, 'INVALID_SALE');
        const team = await d.teams.findOne(
          { _id: input.teamId, auctionId },
          { session },
        );
        if (!team) throw new HttpError(404, 'TEAM_NOT_FOUND');
        const sales = await d.sales
          .find({ auctionId, teamId: team._id, void: false }, { session })
          .toArray();
        const totals = teamTotals(team, sales);
        if (input.amount > totals.remaining)
          throw new HttpError(409, 'INSUFFICIENT_BUDGET');
        if (totals.remainingSlots < 1) throw new HttpError(409, 'TEAM_FULL');
        await d.teams.updateOne(
          { _id: team._id, auctionId },
          { $inc: { version: 1 } },
          { session },
        );
        await d.sales.insertOne(
          {
            _id: randomUUID(),
            auctionId,
            lotId: lot._id,
            playerId: lot.playerId,
            teamId: team._id,
            amount: input.amount,
            void: false,
            actorId: ownerId,
            at: new Date(),
          },
          { session },
        );
      } else if (input.teamId !== undefined || input.amount !== undefined)
        throw new HttpError(422, 'INVALID_UNSOLD');
      await d.lots.updateOne(
        { _id: lot._id, auctionId, status: 'PENDING' },
        {
          $set: {
            status: input.decision,
            requestId: input.requestId,
            decisionHash: fingerprint,
            decidedAt: new Date(),
            decisionVersion: e.version + 1,
            actorId: ownerId,
          },
        },
        { session },
      );
      await d.players.updateOne(
        { _id: lot.playerId, auctionId, status: 'SELECTED' },
        { $set: { status: input.decision } },
        { session },
      );
      await d.engines.updateOne(
        { _id: auctionId, auctionId, version: e.version },
        { $set: { pendingId: null }, $inc: { version: 1 } },
        { session },
      );
      await audit(
        auctionId,
        ownerId,
        input.decision,
        {
          lotId: lot._id,
          playerId: lot.playerId,
          teamId: input.teamId ?? null,
          amount: input.amount ?? null,
          requestId: input.requestId,
        },
        session,
      );
    });
    res.json(await transact((s) => state(auctionId, ownerId, s)));
  });
  for (const action of ['pause', 'resume', 'settings'] as const) {
    r.post('/live/' + action, async (req, res) => {
      const input =
        action === 'settings'
          ? z
              .object({
                version: z.number().int().nonnegative(),
                autoNext: z.boolean(),
                delayMs: z.number().int().min(500).max(10000),
              })
              .strict()
              .parse(req.body)
          : versionSchema.parse(req.body);
      const auctionId = res.locals.auctionId as string,
        ownerId = currentUser(res)._id;
      await transact(async (session) => {
        await owned(auctionId, ownerId, session);
        const e = await engineFor(auctionId, input.version, session);
        await touch(auctionId, ownerId, session);
        const patch: Partial<EngineRecord> =
          action === 'settings'
            ? {
                autoNext: z
                  .boolean()
                  .parse('autoNext' in input ? input.autoNext : true),
                delayMs: z
                  .number()
                  .parse('delayMs' in input ? input.delayMs : 1500),
              }
            : { paused: action === 'pause' };
        await (
          await domain()
        ).engines.updateOne(
          { _id: auctionId, auctionId, version: e.version },
          { $set: patch, $inc: { version: 1 } },
          { session },
        );
        if (action !== 'settings')
          await (
            await collections()
          ).auctions.updateOne(
            { _id: auctionId, ownerId },
            { $set: { status: action === 'pause' ? 'PAUSED' : 'LIVE' } },
            { session },
          );
        await audit(
          auctionId,
          ownerId,
          'AUCTION_' + action.toUpperCase(),
          patch,
          session,
        );
      });
      res.json(await transact((s) => state(auctionId, ownerId, s)));
    });
  }
  r.post('/live/correct', async (req, res) => {
    const input = z
      .object({
        version: z.number().int().nonnegative(),
        lotId: z.string().uuid(),
        requestId: z.string().uuid(),
        reason: z.string().trim().min(10).max(500),
      })
      .strict()
      .parse(req.body);
    const auctionId = res.locals.auctionId as string,
      ownerId = currentUser(res)._id;
    await transact(async (session) => {
      await owned(auctionId, ownerId, session);
      const c = await collections(),
        d = await domain();
      const existing = await c.audit.findOne(
        { _id: 'correction:' + input.requestId, auctionId },
        { session },
      );
      if (existing) {
        if (
          existing.changes?.lotId !== input.lotId ||
          existing.changes?.reason !== input.reason
        )
          throw new HttpError(409, 'IDEMPOTENCY_CONFLICT');
        return;
      }
      const e = await d.engines.findOne(
        { _id: auctionId, auctionId },
        { session },
      );
      if (!e || e.version !== input.version)
        throw new HttpError(409, 'STALE_STATE');
      if (!e.paused || e.pendingId)
        throw new HttpError(409, 'PAUSE_WITH_NO_PENDING_SELECTION');
      const lot = await d.lots.findOne(
        { auctionId, status: { $in: ['SOLD', 'UNSOLD'] } },
        { session, sort: { decisionVersion: -1 } },
      );
      if (!lot || lot._id !== input.lotId)
        throw new HttpError(409, 'ONLY_LAST_DECISION_CAN_BE_CORRECTED');
      await touch(auctionId, ownerId, session);
      await d.sales.updateOne(
        { auctionId, lotId: lot._id, void: false },
        { $set: { void: true } },
        { session },
      );
      await d.lots.updateOne(
        { _id: lot._id, auctionId },
        { $set: { status: 'VOID' } },
        { session },
      );
      await d.players.updateOne(
        { _id: lot.playerId, auctionId },
        { $set: { status: lot.round === 1 ? 'AVAILABLE' : 'UNSOLD' } },
        { session },
      );
      await d.engines.updateOne(
        { _id: auctionId, auctionId, version: e.version },
        {
          $set: { queue: [lot.playerId, ...e.queue], completed: false },
          $inc: { version: 1 },
        },
        { session },
      );
      await c.auctions.updateOne(
        { _id: auctionId, ownerId },
        { $set: { status: 'PAUSED' } },
        { session },
      );
      await c.audit.insertOne(
        {
          _id: 'correction:' + input.requestId,
          auctionId,
          actorId: ownerId,
          action: 'DECISION_VOIDED',
          at: new Date(),
          changes: {
            lotId: lot._id,
            reason: input.reason,
            previousStatus: lot.status,
          },
        },
        { session },
      );
    });
    res.json(await transact((s) => state(auctionId, ownerId, s)));
  });
  return r;
}
