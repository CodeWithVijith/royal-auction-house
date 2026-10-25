import express, { Router } from 'express';
import { Binary } from 'mongodb';
import { createHash, randomUUID } from 'node:crypto';
import { collections, domain } from '@sports/db';
import { z } from 'zod';
import { currentUser, requireUser } from './auth';
import { owned, touch, transact, validId } from './owned';
import {
  fields,
  mappingSchema,
  normalizeRows,
  readSheets,
} from './spreadsheet';
import { HttpError } from './errors';
const importSchema = z
  .object({
    uploadId: z.string().uuid(),
    sheet: z.number().int().min(0).max(9),
    header: z.number().int().min(0).max(19),
    mapping: mappingSchema,
  })
  .strict();
export function playerRouter() {
  const r = Router({ mergeParams: true });
  r.use(requireUser);
  r.use(async (req, res, next) => {
    const auctionId = validId(req.params.id);
    await owned(auctionId, currentUser(res)._id);
    res.locals.auctionId = auctionId;
    next();
  });
  r.post(
    '/imports/upload',
    express.raw({ type: () => true, limit: '5mb' }),
    async (req, res) => {
      const auctionId = res.locals.auctionId as string;
      const format = z.enum(['csv', 'xlsx']).parse(req.query.format);
      if (!Buffer.isBuffer(req.body))
        throw new HttpError(422, 'INVALID_UPLOAD');
      const sheets = await readSheets(req.body, format);
      if (sheets.every((s) => s.rows.length < 2))
        throw new HttpError(422, 'EMPTY_SHEET');
      const uploadId = randomUUID();
      const d = await domain();
      await d.uploads.insertOne({
        _id: uploadId,
        auctionId,
        ownerId: currentUser(res)._id,
        hash: createHash('sha256').update(req.body).digest('hex'),
        format,
        bytes: new Binary(req.body),
        expiresAt: new Date(Date.now() + 30 * 60000),
      });
      const last = await d.imports.findOne(
        { auctionId },
        {
          sort: { createdAt: -1 },
          projection: { mapping: 1, sheet: 1, header: 1 },
        },
      );
      res.status(201).json({
        uploadId,
        sheets: sheets.map((s) => ({
          name: s.name,
          headers: s.rows
            .slice(0, 20)
            .map((row) =>
              row.map((cell) =>
                typeof cell === 'string' || typeof cell === 'number'
                  ? String(cell).slice(0, 120)
                  : '',
              ),
            ),
        })),
        savedMapping: last
          ? { mapping: last.mapping, sheet: last.sheet, header: last.header }
          : null,
        fields,
      });
    },
  );
  async function preview(
    input: z.infer<typeof importSchema>,
    auctionId: string,
    ownerId: string,
  ) {
    const d = await domain();
    const upload = await d.uploads.findOne({
      _id: input.uploadId,
      auctionId,
      ownerId,
      expiresAt: { $gt: new Date() },
    });
    if (!upload) throw new HttpError(404, 'UPLOAD_EXPIRED');
    const sheets = await readSheets(
      Buffer.from(upload.bytes.buffer),
      upload.format,
    );
    const sheet = sheets[input.sheet];
    if (!sheet) throw new HttpError(422, 'INVALID_SHEET');
    const rows = normalizeRows(sheet.rows, input.header, input.mapping);
    if (rows.length === 0) throw new HttpError(422, 'EMPTY_SHEET');
    const keys = rows.map((row) => row.key);
    const existing = await d.players
      .find({ auctionId, key: { $in: keys } }, { projection: { key: 1 } })
      .toArray();
    const found = new Set(existing.map((p) => p.key));
    return {
      rows: rows.map((row) => ({ ...row, existing: found.has(row.key) })),
      upload,
    };
  }
  r.post('/imports/preview', async (req, res) => {
    const input = importSchema.parse(req.body);
    const result = await preview(
      input,
      res.locals.auctionId,
      currentUser(res)._id,
    );
    res.json({
      rows: result.rows,
      valid: result.rows.filter((row) => !row.errors.length).length,
      invalid: result.rows.filter((row) => row.errors.length).length,
    });
  });
  r.post('/imports/commit', async (req, res) => {
    const input = importSchema.parse(req.body);
    const auctionId = res.locals.auctionId as string;
    const ownerId = currentUser(res)._id;
    const result = await preview(input, auctionId, ownerId);
    if (result.rows.some((row) => row.errors.length))
      throw new HttpError(422, 'IMPORT_HAS_ERRORS');
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify([
          result.upload.hash,
          input.sheet,
          input.header,
          input.mapping,
        ]),
      )
      .digest('hex');
    const committed = await transact(async (session) => {
      const a = await owned(auctionId, ownerId, session);
      if (a.status === 'COMPLETED') throw new HttpError(409, 'AUCTION_LOCKED');
      await touch(auctionId, ownerId, session);
      const d = await domain();
      const previous = await d.imports.findOne(
        { auctionId, fingerprint },
        { session },
      );
      if (previous)
        return { inserted: 0, skipped: result.rows.length, duplicate: true };
      const existing = await d.players
        .find(
          { auctionId, key: { $in: result.rows.map((row) => row.key) } },
          { session, projection: { key: 1 } },
        )
        .toArray();
      const found = new Set(existing.map((p) => p.key));
      const fresh = result.rows.filter(
        (row) => !row.duplicate && !found.has(row.key),
      );
      if (fresh.length && a.startedAt !== null)
        throw new HttpError(409, 'IMPORT_NEW_PLAYERS_AFTER_START');
      const count = await d.players.countDocuments({ auctionId }, { session });
      if (count + fresh.length > 5000)
        throw new HttpError(413, 'AUCTION_PLAYER_LIMIT');
      const inserted = fresh.length,
        skipped = result.rows.length - inserted;
      if (fresh.length)
        await d.players.insertMany(
          fresh.map((row) => ({
            _id: randomUUID(),
            auctionId,
            key: row.key,
            ...row.player,
            status: 'AVAILABLE' as const,
            createdAt: new Date(),
          })),
          { session },
        );
      await d.imports.insertOne(
        {
          _id: randomUUID(),
          auctionId,
          fingerprint,
          sheet: input.sheet,
          header: input.header,
          mapping: Object.fromEntries(
            Object.entries(input.mapping).filter(([, v]) => v !== undefined),
          ) as Record<string, number>,
          inserted,
          skipped,
          createdAt: new Date(),
        },
        { session },
      );
      await (
        await collections()
      ).audit.insertOne(
        {
          _id: randomUUID(),
          auctionId,
          actorId: ownerId,
          action: 'PLAYERS_IMPORTED',
          at: new Date(),
          changes: { inserted, skipped },
        },
        { session },
      );
      return { inserted, skipped, duplicate: false };
    });
    res.json(committed);
  });
  r.get('/players', async (req, res) => {
    const q = z
      .string()
      .max(100)
      .parse(req.query.q ?? '');
    const d = await domain();
    const rows = await d.players
      .find({ auctionId: res.locals.auctionId })
      .sort({ name: 1, _id: 1 })
      .toArray();
    res.json({
      players: rows.filter(
        (row) =>
          !q ||
          [row.name, row.registrationId, row.category].some((v) =>
            v?.toLowerCase().includes(q.toLowerCase()),
          ),
      ),
    });
  });
  r.patch('/players/:playerId', async (req, res) => {
    const input = z
      .object({
        name: z.string().trim().min(1).max(200),
        previousTeam: z.string().max(200).nullable(),
        category: z.string().max(200).nullable(),
      })
      .strict()
      .parse(req.body);
    const auctionId = res.locals.auctionId as string;
    const playerId = validId(req.params.playerId);
    const ownerId = currentUser(res)._id;
    await transact(async (session) => {
      const a = await owned(auctionId, ownerId, session);
      if (a.startedAt !== null) throw new HttpError(409, 'AUCTION_LOCKED');
      await touch(auctionId, ownerId, session);
      const d = await domain();
      const changed = await d.players.updateOne(
        { _id: playerId, auctionId },
        { $set: input },
        { session },
      );
      if (!changed.matchedCount) throw new HttpError(404, 'NOT_FOUND');
      await (
        await collections()
      ).audit.insertOne(
        {
          _id: randomUUID(),
          auctionId,
          actorId: ownerId,
          action: 'PLAYER_EDITED',
          at: new Date(),
          changes: { playerId },
        },
        { session },
      );
    });
    res.json({ ok: true });
  });
  return r;
}
