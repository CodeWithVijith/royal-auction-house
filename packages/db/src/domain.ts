import { connectDb } from './index';
export interface PlayerRecord {
  _id: string;
  auctionId: string;
  key: string;
  name: string;
  registrationId: string | null;
  dob: string | null;
  previousTeam: string | null;
  category: string | null;
  playerPhotoURL: string | null;
  status: 'AVAILABLE' | 'SELECTED' | 'SOLD' | 'UNSOLD';
  createdAt: Date;
}
export interface UploadRecord {
  _id: string;
  auctionId: string;
  ownerId: string;
  hash: string;
  format: 'csv' | 'xlsx';
  bytes: import('mongodb').Binary;
  expiresAt: Date;
}
export interface ImportRecord {
  _id: string;
  auctionId: string;
  fingerprint: string;
  mapping: Record<string, number>;
  sheet: number;
  header: number;
  inserted: number;
  skipped: number;
  createdAt: Date;
}
export interface TeamRecord {
  _id: string;
  auctionId: string;
  name: string;
  nameKey: string;
  budget: number;
  maxSlots: number;
  logoUrl: string | null;
  version: number;
}
export interface AssetRecord {
  _id: string;
  auctionId: string;
  bytes: import('mongodb').Binary | null;
  objectKey?: string;
  createdAt: Date;
}
export interface EngineRecord {
  _id: string;
  auctionId: string;
  version: number;
  round: number;
  queue: string[];
  pendingId: string | null;
  paused: boolean;
  completed: boolean;
  autoNext: boolean;
  delayMs: number;
}
export interface LotRecord {
  _id: string;
  auctionId: string;
  round: number;
  playerId: string;
  status: 'PENDING' | 'SOLD' | 'UNSOLD' | 'VOID';
  actorId: string;
  createdAt: Date;
  decidedAt: Date | null;
  requestId: string | null;
  decisionHash: string | null;
  selectionIndex: number;
  eligibleCount: number;
  decisionVersion: number | null;
}
export interface SaleRecord {
  _id: string;
  auctionId: string;
  lotId: string;
  playerId: string;
  teamId: string;
  amount: number;
  void: boolean;
  actorId: string;
  at: Date;
}
export async function domain() {
  const db = await connectDb();
  return {
    db,
    players: db.collection<PlayerRecord>('players'),
    uploads: db.collection<UploadRecord>('import_uploads'),
    imports: db.collection<ImportRecord>('imports'),
    teams: db.collection<TeamRecord>('teams'),
    assets: db.collection<AssetRecord>('assets'),
    engines: db.collection<EngineRecord>('engines'),
    lots: db.collection<LotRecord>('lots'),
    sales: db.collection<SaleRecord>('sales'),
  };
}
export async function setupDomainIndexes() {
  const c = await domain();
  await c.players.createIndex({ auctionId: 1, key: 1 }, { unique: true });
  await c.players.createIndex({ auctionId: 1, status: 1 });
  await c.uploads.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await c.imports.createIndex(
    { auctionId: 1, fingerprint: 1 },
    { unique: true },
  );
  await c.teams.createIndex({ auctionId: 1, nameKey: 1 }, { unique: true });
  await c.assets.createIndex({ auctionId: 1 });
  await c.lots.createIndex(
    { auctionId: 1, round: 1, playerId: 1 },
    {
      unique: true,
      partialFilterExpression: {
        status: { $in: ['PENDING', 'SOLD', 'UNSOLD'] },
      },
    },
  );
  await c.lots.createIndex(
    { auctionId: 1, status: 1 },
    { unique: true, partialFilterExpression: { status: 'PENDING' } },
  );
  await c.lots.createIndex(
    { auctionId: 1, requestId: 1 },
    {
      unique: true,
      partialFilterExpression: { requestId: { $type: 'string' } },
    },
  );
  await c.sales.createIndex(
    { auctionId: 1, playerId: 1 },
    { unique: true, partialFilterExpression: { void: false } },
  );
  await c.sales.createIndex({ auctionId: 1, teamId: 1, void: 1 });
  await c.db
    .collection<{ _id: string; value: string }>('system_metadata')
    .updateOne(
      { _id: 'app_schema' },
      { $set: { value: SCHEMA_VERSION } },
      { upsert: true },
    );
}
export const SCHEMA_VERSION = 'sports-auction-v1';
