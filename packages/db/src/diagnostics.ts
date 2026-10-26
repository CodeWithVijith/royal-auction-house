// Only fixed descriptions and numeric server codes leave this boundary.
// MongoDB error messages/stacks can contain connection strings or user data.
export function databaseDiagnostic(error: unknown) {
  const pending: unknown[] = [error];
  const seen = new Set<unknown>();
  const names = new Set<string>();
  const codes = new Set<string | number>();
  let configuration = false;
  let topology = false;
  let atlasAuthentication = false;
  for (let i = 0; i < pending.length && i < 40; i++) {
    const value = pending[i];
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    const item = value as {
      name?: unknown;
      code?: unknown;
      message?: unknown;
      cause?: unknown;
      reason?: unknown;
      error?: unknown;
      servers?: unknown;
    };
    if (typeof item.name === 'string') names.add(item.name);
    if (typeof item.code === 'number' || typeof item.code === 'string')
      codes.add(item.code);
    atlasAuthentication ||=
      item.code === 8000 &&
      typeof item.message === 'string' &&
      /bad auth|authentication failed/i.test(item.message);
    configuration ||=
      item.message === 'Configure MONGODB_URI with a database user';
    topology ||=
      item.message ===
      'MongoDB must use a replica set or sharded cluster for auction transactions';
    pending.push(item.cause, item.reason, item.error);
    if (item.servers instanceof Map) pending.push(...item.servers.values());
  }
  if (configuration)
    return {
      category: 'CONFIGURATION',
      action:
        'Set MONGODB_URI with completed database-user credentials in Render Environment.',
    };
  if (codes.has(18) || atlasAuthentication)
    return {
      category: 'AUTHENTICATION',
      action:
        'Check the Atlas database username/password, URL encoding and authSource. Atlas website credentials are separate.',
    };
  if (codes.has(13))
    return {
      category: 'DATABASE_PERMISSIONS',
      action:
        'Grant the database user readWrite on MONGODB_DB_NAME, including collection and index creation.',
    };
  if (codes.has(11000))
    return {
      category: 'DUPLICATE_DATA',
      action:
        'A unique index conflicts with existing records. Review duplicates; do not reset the database.',
    };
  if (codes.has(85) || codes.has(86))
    return {
      category: 'INDEX_CONFLICT',
      action:
        'An existing index has different options. Review the index definitions before applying a migration.',
    };
  if (topology)
    return {
      category: 'REPLICA_SET_REQUIRED',
      action: 'Use an Atlas replica set or sharded cluster for transactions.',
    };
  if (
    names.has('MongoParseError') ||
    names.has('MongoInvalidArgumentError') ||
    names.has('URIError')
  )
    return {
      category: 'INVALID_URI',
      action:
        'Copy the Drivers connection string from the correct Atlas cluster, remove surrounding quotes and URL-encode credentials.',
    };
  if (
    codes.has('ENOTFOUND') ||
    codes.has('ENODATA') ||
    codes.has('ESERVFAIL') ||
    codes.has('EAI_AGAIN')
  )
    return {
      category: 'DNS',
      action:
        'Verify the Atlas Drivers hostname and that the cluster is running. Check DNS availability.',
    };
  if (
    [...codes].some(
      (code) =>
        typeof code === 'string' && /^(ERR_TLS_|ERR_SSL_|CERT_)/.test(code),
    )
  )
    return {
      category: 'TLS',
      action:
        'Check the supported Node version, TLS certificates and cluster endpoint. Keep certificate verification enabled.',
    };
  if (
    names.has('MongoServerSelectionError') ||
    names.has('MongoNetworkError') ||
    names.has('MongoNetworkTimeoutError') ||
    codes.has('ETIMEDOUT') ||
    codes.has('ECONNREFUSED')
  )
    return {
      category: 'NETWORK_OR_CLUSTER',
      action:
        'Check Atlas Network Access for all Render outbound ranges, cluster availability and the Drivers hostname. A selection timeout alone does not prove an IP allowlist failure.',
    };
  const numericCode = [...codes].find(
    (code) => typeof code === 'number' && Number.isSafeInteger(code),
  );
  return {
    category: 'DATABASE_SETUP',
    ...(numericCode === undefined ? {} : { serverCode: numericCode }),
    action:
      'Review the reported bootstrap stage and numeric server code. Raw error details are intentionally not logged.',
  };
}
