import type { AuctionInput } from '@sports/shared';
import { connectDb } from './index';
export interface UserRecord {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}
export interface SessionRecord {
  _id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}
export interface AuctionRecord extends AuctionInput {
  _id: string;
  ownerId: string;
  status: 'DRAFT' | 'LIVE' | 'PAUSED' | 'COMPLETED';
  version: number;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
}
export interface AuditRecord {
  _id: string;
  auctionId: string;
  actorId: string;
  action: string;
  at: Date;
  changes?: Record<string, unknown>;
}
export interface RateLimitRecord {
  _id: string;
  count: number;
  expiresAt: Date;
}
export async function collections() {
  const db = await connectDb();
  return {
    db,
    users: db.collection<UserRecord>('users'),
    sessions: db.collection<SessionRecord>('sessions'),
    auctions: db.collection<AuctionRecord>('auctions'),
    audit: db.collection<AuditRecord>('audit_events'),
    rateLimits: db.collection<RateLimitRecord>('rate_limits'),
  };
}
export async function setupIndexes() {
  const c = await collections();
  await c.db
    .collection('socket_tickets')
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await c.users.createIndex({ email: 1 }, { unique: true });
  await c.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await c.sessions.createIndex({ userId: 1 });
  await c.auctions.createIndex({ ownerId: 1, createdAt: -1 });
  await c.audit.createIndex({ auctionId: 1, at: 1 });
  await c.rateLimits.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}
