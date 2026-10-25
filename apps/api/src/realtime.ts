import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { collections } from '@sports/db';
import type { ChangeStream, Document } from 'mongodb';
import { z } from 'zod';
import { requireUser, currentUser, readToken, digest } from './auth';
import { owned, validId } from './owned';
import { envSchema } from './config';
interface Ticket {
  _id: string;
  auctionId: string;
  userId: string;
  sessionHash: string;
  expiresAt: Date;
}
async function tickets() {
  return (await collections()).db.collection<Ticket>('socket_tickets');
}
export async function setupRealtime() {
  await (
    await tickets()
  ).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}
export function eventRouter() {
  const r = Router({ mergeParams: true });
  r.post('/events', requireUser, async (req, res) => {
    const auctionId = validId(req.params.id);
    await owned(auctionId, currentUser(res)._id);
    const token = readToken(req);
    if (!token) {
      res.status(401).end();
      return;
    }
    const ticket = randomBytes(32).toString('hex');
    await (
      await tickets()
    ).insertOne({
      _id: digest(ticket),
      auctionId,
      userId: currentUser(res)._id,
      sessionHash: digest(token),
      expiresAt: new Date(Date.now() + 30000),
    });
    const env = envSchema.parse(process.env);
    res.json({
      ticket,
      url:
        process.env.PUBLIC_API_URL ??
        process.env.RENDER_EXTERNAL_URL ??
        'http://localhost:' + env.API_PORT,
    });
  });
  return r;
}
export function createRealtime(server: HttpServer, origin: string) {
  const io = new Server(server, {
    cors: { origin, credentials: true },
    transports: ['websocket'],
    maxHttpBufferSize: 4096,
    allowRequest: (req, next) => next(null, req.headers.origin === origin),
  });
  io.use(async (socket, next) => {
    try {
      const token = z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .parse(socket.handshake.auth.ticket);
      const ticket = await (
        await tickets()
      ).findOneAndDelete({
        _id: digest(token),
        expiresAt: { $gt: new Date() },
      });
      if (!ticket) throw new Error();
      const c = await collections();
      const session = await c.sessions.findOne({
        _id: ticket.sessionHash,
        userId: ticket.userId,
        expiresAt: { $gt: new Date() },
      });
      if (!session) throw new Error();
      await owned(ticket.auctionId, ticket.userId);
      socket.data.auctionId = ticket.auctionId;
      socket.data.sessionHash = ticket.sessionHash;
      socket.data.expiresAt = session.expiresAt.getTime();
      next();
    } catch {
      next(new Error('AUTH_REQUIRED'));
    }
  });
  io.on('connection', (socket) => {
    void socket.join('auction:' + socket.data.auctionId);
    const timer = setTimeout(
      () => socket.disconnect(true),
      Math.max(1, Number(socket.data.expiresAt) - Date.now()),
    );
    timer.unref();
    socket.on('disconnect', () => clearTimeout(timer));
  });
  let stopped = false,
    stream: ChangeStream<Document> | undefined,
    restart: ReturnType<typeof setTimeout> | undefined;
  async function watch() {
    if (stopped) return;
    try {
      const c = await collections();
      if (stopped) return;
      stream = c.db.watch(
        [
          {
            $match: {
              $or: [
                { 'ns.coll': 'audit_events', operationType: 'insert' },
                { 'ns.coll': 'sessions', operationType: 'delete' },
              ],
            },
          },
        ],
        { maxAwaitTimeMS: 1000 },
      );
      let recovering = false;
      stream.on('change', (change) => {
        void (async () => {
          if (change.operationType === 'delete') {
            for (const socket of io.sockets.sockets.values())
              if (socket.data.sessionHash === change.documentKey._id)
                socket.disconnect(true);
            return;
          }
          if (change.operationType !== 'insert') return;
          const auctionId = change.fullDocument.auctionId;
          if (typeof auctionId !== 'string') return;
          const auction = await c.auctions.findOne(
            { _id: auctionId },
            { projection: { version: 1 } },
          );
          if (auction)
            io.to('auction:' + auctionId).emit('auction.changed', {
              auctionId,
              version: auction.version,
            });
          else
            io.to('auction:' + auctionId).emit('auction.deleted', {
              auctionId,
            });
        })().catch(() => {
          console.error(
            'Real-time notification failed; REST recovery remains available.',
          );
        });
      });
      stream.on('error', () => {
        if (recovering || stopped) return;
        recovering = true;
        void stream?.close().catch(() => undefined);
        restart = setTimeout(() => void watch(), 1000);
        restart.unref();
      });
    } catch {
      if (!stopped) {
        restart = setTimeout(() => void watch(), 2000);
        restart.unref();
      }
    }
  }
  void watch();
  return {
    io,
    async close() {
      stopped = true;
      if (restart) clearTimeout(restart);
      await stream?.close();
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}
