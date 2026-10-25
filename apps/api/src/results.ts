import { Router } from 'express';
import ExcelJS from 'exceljs';
import { randomUUID } from 'node:crypto';
import { collections, domain } from '@sports/db';
import { z } from 'zod';
import { requireUser, currentUser } from './auth';
import { owned, touch, transact, validId } from './owned';
import { teamTotals } from './teams';
import { HttpError } from './errors';
import type { ClientSession } from 'mongodb';
export function safeCell(value: unknown): string | number {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new HttpError(500, 'LEDGER_RANGE');
    return value;
  }
  const text = value === null || value === undefined ? '' : String(value);
  return /^[\s]*[=+\-@]/.test(text) ? "'" + text : text;
}
export async function resultsSnapshot(
  auctionId: string,
  ownerId: string,
  session: ClientSession,
) {
  const a = await owned(auctionId, ownerId, session),
    d = await domain();
  const players = await d.players
      .find({ auctionId }, { session })
      .sort({ name: 1, _id: 1 })
      .toArray(),
    teams = await d.teams
      .find({ auctionId }, { session })
      .sort({ name: 1 })
      .toArray(),
    transactions = await d.sales
      .find({ auctionId }, { session })
      .sort({ at: 1, _id: 1 })
      .toArray(),
    attempts = await d.lots
      .find({ auctionId }, { session })
      .sort({ round: 1, decisionVersion: 1 })
      .toArray(),
    engine = await d.engines.findOne(
      { _id: auctionId, auctionId },
      { session },
    );
  const totals = teams.map((team) => teamTotals(team, transactions));
  const spent = transactions
    .filter((t) => !t.void)
    .reduce((sum, t) => sum + t.amount, 0);
  if (
    !Number.isSafeInteger(spent) ||
    totals.reduce((sum, t) => sum + t.spent, 0) !== spent ||
    transactions.filter((t) => !t.void).length !==
      players.filter((p) => p.status === 'SOLD').length
  )
    throw new HttpError(500, 'LEDGER_RECONCILIATION_FAILED');
  return {
    auction: {
      id: a._id,
      name: a.name,
      denomination: a.denomination,
      status: a.status,
      label: a.status === 'COMPLETED' ? 'FINAL' : 'DRAFT',
    },
    engine,
    players,
    teams: totals,
    transactions,
    attempts,
    summary: {
      players: players.length,
      sold: players.filter((p) => p.status === 'SOLD').length,
      unsold: players.filter((p) => p.status === 'UNSOLD').length,
      pending: players.filter((p) => p.status === 'SELECTED').length,
      available: players.filter((p) => p.status === 'AVAILABLE').length,
      spent,
    },
  };
}
export function resultRouter() {
  const r = Router({ mergeParams: true });
  r.use(requireUser);
  r.use(async (req, res, next) => {
    const auctionId = validId(req.params.id);
    await owned(auctionId, currentUser(res)._id);
    res.locals.auctionId = auctionId;
    next();
  });
  r.get('/results', async (_req, res) => {
    res.json(
      await transact((session) =>
        resultsSnapshot(res.locals.auctionId, currentUser(res)._id, session),
      ),
    );
  });
  for (const action of ['rounds/unsold', 'complete'] as const) {
    r.post('/' + action, async (req, res) => {
      const input = z
        .object({ version: z.number().int().nonnegative() })
        .strict()
        .parse(req.body);
      const auctionId = res.locals.auctionId as string,
        ownerId = currentUser(res)._id;
      await transact(async (session) => {
        await owned(auctionId, ownerId, session);
        const d = await domain(),
          c = await collections();
        const engine = await d.engines.findOne(
          { _id: auctionId, auctionId },
          { session },
        );
        if (!engine || engine.version !== input.version)
          throw new HttpError(409, 'STALE_STATE');
        if (engine.completed) throw new HttpError(409, 'AUCTION_COMPLETED');
        if (engine.pendingId || engine.queue.length)
          throw new HttpError(409, 'ROUND_NOT_FINISHED');
        await touch(auctionId, ownerId, session);
        if (action === 'rounds/unsold') {
          const players = await d.players
            .find({ auctionId, status: 'UNSOLD' }, { session })
            .sort({ _id: 1 })
            .toArray();
          if (!players.length) throw new HttpError(409, 'NO_UNSOLD_PLAYERS');
          if (engine.round >= 10) throw new HttpError(409, 'ROUND_LIMIT');
          await d.engines.updateOne(
            { _id: auctionId, auctionId, version: engine.version },
            {
              $set: {
                queue: players.map((p) => p._id),
                round: engine.round + 1,
                paused: false,
              },
              $inc: { version: 1 },
            },
            { session },
          );
          await c.auctions.updateOne(
            { _id: auctionId, ownerId },
            { $set: { status: 'LIVE' } },
            { session },
          );
        } else {
          await d.engines.updateOne(
            { _id: auctionId, auctionId, version: engine.version },
            { $set: { completed: true, paused: true }, $inc: { version: 1 } },
            { session },
          );
          await c.auctions.updateOne(
            { _id: auctionId, ownerId },
            { $set: { status: 'COMPLETED' } },
            { session },
          );
        }
        await c.audit.insertOne(
          {
            _id: randomUUID(),
            auctionId,
            actorId: ownerId,
            action:
              action === 'complete'
                ? 'AUCTION_COMPLETED'
                : 'UNSOLD_ROUND_STARTED',
            at: new Date(),
            changes: {
              round: action === 'complete' ? engine.round : engine.round + 1,
            },
          },
          { session },
        );
      });
      res.json(
        await transact((session) =>
          resultsSnapshot(auctionId, ownerId, session),
        ),
      );
    });
  }
  r.get('/export', async (_req, res) => {
    const result = await transact((s) =>
      resultsSnapshot(res.locals.auctionId, currentUser(res)._id, s),
    );
    if (!result) throw new HttpError(500, 'EXPORT_FAILED');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sports Auction';
    workbook.created = new Date();
    const denomination = result.auction.denomination,
      label = result.auction.label;
    const add = (name: string, headers: string[], rows: unknown[][]) => {
      const sheet = workbook.addWorksheet(name);
      sheet.addRow(headers);
      for (const row of rows) sheet.addRow(row.map(safeCell));
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(sheet.rowCount, 1), column: headers.length },
      };
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F172A' },
      };
      sheet.columns.forEach((column, index) => {
        column.width = Math.min(
          42,
          Math.max(16, (headers[index]?.length ?? 10) + 3),
        );
      });
    };
    const names = new Map(result.players.map((p) => [p._id, p.name])),
      teams = new Map(result.teams.map((t) => [t._id, t.name])),
      active = new Map(
        result.transactions.filter((t) => !t.void).map((t) => [t.playerId, t]),
      );
    add(
      'Summary',
      [
        'Snapshot',
        'Auction',
        'Denomination',
        'Players',
        'Sold',
        'Unsold',
        'Available',
        'Pending',
        'Total spent (' + denomination + ')',
      ],
      [
        [
          label,
          result.auction.name,
          denomination,
          result.summary.players,
          result.summary.sold,
          result.summary.unsold,
          result.summary.available,
          result.summary.pending,
          result.summary.spent,
        ],
      ],
    );
    const headers = [
      'Snapshot',
      'Player ID',
      'Registration ID',
      'Name',
      'DOB',
      'Previous team',
      'Category',
      'Status',
      'Team',
      'Amount (' + denomination + ')',
      'Denomination',
    ];
    const playerRows = (status?: string) =>
      result.players
        .filter((p) => !status || p.status === status)
        .map((p) => {
          const sale = active.get(p._id);
          return [
            label,
            p._id,
            p.registrationId,
            p.name,
            p.dob,
            p.previousTeam,
            p.category,
            p.status,
            sale ? teams.get(sale.teamId) : '',
            sale?.amount ?? 0,
            denomination,
          ];
        });
    add('All Players', headers, playerRows());
    add('Sold Players', headers, playerRows('SOLD'));
    add('Unsold Players', headers, playerRows('UNSOLD'));
    add(
      'Teams',
      [
        'Snapshot',
        'Team ID',
        'Team',
        'Budget (' + denomination + ')',
        'Spent (' + denomination + ')',
        'Remaining (' + denomination + ')',
        'Roster slots',
        'Used slots',
        'Denomination',
      ],
      result.teams.map((t) => [
        label,
        t._id,
        t.name,
        t.budget,
        t.spent,
        t.remaining,
        t.maxSlots,
        t.usedSlots,
        denomination,
      ]),
    );
    add(
      'Transactions',
      [
        'Snapshot',
        'Transaction ID',
        'Player',
        'Team',
        'Amount (' + denomination + ')',
        'Denomination',
        'Void',
        'Actor',
        'Time',
        'Lot ID',
      ],
      result.transactions.map((t) => [
        label,
        t._id,
        names.get(t.playerId),
        teams.get(t.teamId),
        t.amount,
        denomination,
        t.void ? 'YES' : 'NO',
        t.actorId,
        t.at.toISOString(),
        t.lotId,
      ]),
    );
    const bytes = await workbook.xlsx.writeBuffer();
    res
      .set(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      .set(
        'Content-Disposition',
        'attachment; filename="auction-' +
          result.auction.id +
          '-' +
          label.toLowerCase() +
          '.xlsx"',
      )
      .set('Cache-Control', 'no-store')
      .send(Buffer.from(bytes));
  });
  return r;
}
