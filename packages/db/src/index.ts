import { MongoClient, type Db } from 'mongodb';

interface SystemMetadata {
  _id: string;
  value: string;
}
interface ConnectionState {
  client?: MongoClient;
  pending?: Promise<MongoClient>;
}
const globalDb = globalThis as unknown as { sportsMongo?: ConnectionState };
const state = globalDb.sportsMongo ?? (globalDb.sportsMongo = {});

export async function connectDb(): Promise<Db> {
  if (!state.client) {
    if (!state.pending) {
      const uri = process.env.MONGODB_URI;
      if (
        !uri ||
        uri.includes('<db_username>') ||
        uri.includes('<db_password>')
      )
        throw new Error('Configure MONGODB_URI with a database user');
      const client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000,
        maxPoolSize: 10,
      });
      state.pending = client
        .connect()
        .then(() => {
          state.client = client;
          delete state.pending;
          return client;
        })
        .catch(async () => {
          delete state.pending;
          await client.close();
          throw new Error('MongoDB connection unavailable');
        });
    }
    await state.pending;
  }
  return state.client!.db(process.env.MONGODB_DB_NAME ?? 'sports_auction');
}

export async function disconnectDb() {
  const pending = state.pending;
  if (pending) await pending.catch(() => undefined);
  const client = state.client;
  delete state.client;
  delete state.pending;
  if (client) await client.close();
}
export async function systemMetadata() {
  return (await connectDb()).collection<SystemMetadata>('system_metadata');
}
export async function setupDatabase() {
  const database = await connectDb();
  const topology = await database.command({ hello: 1 });
  if (!topology.setName && topology.msg !== 'isdbgrid')
    throw new Error(
      'MongoDB must use a replica set or sharded cluster for auction transactions',
    );
  await (
    await systemMetadata()
  ).updateOne(
    { _id: 'schema_version' },
    { $setOnInsert: { value: 'bootstrap' } },
    { upsert: true },
  );
}

export { collections, setupIndexes } from './models';
export type { UserRecord, SessionRecord, AuctionRecord } from './models';

export { domain, setupDomainIndexes } from './domain';
export { SCHEMA_VERSION } from './domain';
export type { AssetRecord } from './domain';
export type {
  PlayerRecord,
  TeamRecord,
  EngineRecord,
  LotRecord,
  SaleRecord,
} from './domain';
