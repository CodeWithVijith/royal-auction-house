import {
  disconnectDb,
  setupDatabase,
  setupIndexes,
  setupDomainIndexes,
} from './index';
import { databaseDiagnostic } from './diagnostics';
let stage = 'connection and metadata';
try {
  await setupDatabase();
  stage = 'authentication and ownership indexes';
  await setupIndexes();
  stage = 'auction domain indexes';
  await setupDomainIndexes();
  console.info('MongoDB bootstrap complete');
} catch (error) {
  console.error(
    'MongoDB bootstrap failed. Check MONGODB_URI, database user access, network access, and replica-set configuration.',
  );
  console.error(JSON.stringify({ stage, ...databaseDiagnostic(error) }));
  process.exitCode = 1;
} finally {
  await disconnectDb();
}
