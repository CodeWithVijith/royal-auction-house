import {
  disconnectDb,
  setupDatabase,
  setupIndexes,
  setupDomainIndexes,
} from './index';
try {
  await setupDatabase();
  await setupIndexes();
  await setupDomainIndexes();
  console.info('MongoDB bootstrap complete');
} catch {
  console.error(
    'MongoDB bootstrap failed. Check MONGODB_URI, database user access, network access, and replica-set configuration.',
  );
  process.exitCode = 1;
} finally {
  await disconnectDb();
}
