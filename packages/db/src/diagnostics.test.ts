import { describe, expect, it } from 'vitest';
import { databaseDiagnostic } from './diagnostics';
describe('safe database bootstrap diagnostics', () => {
  it.each([
    [{ code: 18 }, 'AUTHENTICATION'],
    [
      { code: 8000, message: 'bad auth : authentication failed' },
      'AUTHENTICATION',
    ],
    [{ code: 8000, message: 'another Atlas error' }, 'DATABASE_SETUP'],
    [{ code: 13 }, 'DATABASE_PERMISSIONS'],
    [{ code: 11000 }, 'DUPLICATE_DATA'],
    [{ code: 85 }, 'INDEX_CONFLICT'],
    [{ name: 'MongoParseError' }, 'INVALID_URI'],
    [{ code: 'ENOTFOUND' }, 'DNS'],
    [{ code: 'ERR_TLS_CERT_ALTNAME_INVALID' }, 'TLS'],
    [{ name: 'MongoServerSelectionError' }, 'NETWORK_OR_CLUSTER'],
    [new Error('Configure MONGODB_URI with a database user'), 'CONFIGURATION'],
    [
      new Error(
        'MongoDB must use a replica set or sharded cluster for auction transactions',
      ),
      'REPLICA_SET_REQUIRED',
    ],
  ])('classifies %j as %s', (error, category) => {
    expect(databaseDiagnostic(error).category).toBe(category);
  });
  it('finds authentication failures nested in connection and topology errors', () => {
    const cause = {
      name: 'MongoServerSelectionError',
      reason: { servers: new Map([['private-host', { error: { code: 18 } }]]) },
    };
    expect(
      databaseDiagnostic(new Error('connection unavailable', { cause }))
        .category,
    ).toBe('AUTHENTICATION');
  });
  it('never outputs arbitrary messages, strings, stacks, URIs or duplicate record data', () => {
    const secret =
      'mongodb+srv://private-user:private-password@private-host/private-db';
    for (const code of [11000, 13, 12345, secret]) {
      const result = databaseDiagnostic({
        name: secret,
        message: secret,
        stack: secret,
        code,
        keyValue: { email: secret },
      });
      expect(JSON.stringify(result)).not.toContain(secret);
    }
  });
  it('bounds cyclic error traversal', () => {
    const error: { cause?: unknown } = {};
    error.cause = error;
    expect(databaseDiagnostic(error).category).toBe('DATABASE_SETUP');
  });
});
