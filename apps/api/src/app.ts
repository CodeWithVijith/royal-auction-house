import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectDb, systemMetadata, SCHEMA_VERSION } from '@sports/db';
import { randomUUID } from 'node:crypto';
import { healthSchema } from '@sports/shared';
import { ZodError } from 'zod';
import { authRouter } from './auth';
import { auctionRouter } from './auctions';
import { playerRouter } from './players';
import { teamRouter } from './teams';
import { engineRouter } from './engine';
import { resultRouter } from './results';
import { eventRouter } from './realtime';
import { HttpError } from './errors';
export function createApp(origin = 'http://localhost:3000') {
  const app = express();
  app.use((req, res, next) => {
    const requestId = randomUUID();
    res.set('X-Request-Id', requestId);
    const start = Date.now();
    res.on('finish', () => {
      if (process.env.NODE_ENV === 'production')
        console.info(
          JSON.stringify({
            requestId,
            method: req.method,
            status: res.statusCode,
            durationMs: Date.now() - start,
            route: req.route?.path ?? 'unmatched',
          }),
        );
    });
    next();
  });
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin, credentials: true }));
  app.use(express.json({ limit: '32kb' }));
  app.use('/auth', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/auctions', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(['/auth', '/auctions'], (req, _res, next) => {
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.get('origin') !== origin
    )
      throw new HttpError(403, 'ORIGIN_REJECTED');
    next();
  });
  let schemaReady: Promise<void> | undefined;
  const checkSchema = async () => {
    const marker = await (
      await systemMetadata()
    ).findOne({ _id: 'app_schema' });
    if (marker?.value !== SCHEMA_VERSION)
      throw new HttpError(503, 'DATABASE_SETUP_REQUIRED');
  };
  app.use(['/auth', '/auctions'], async (_req, _res, next) => {
    schemaReady ??= checkSchema();
    try {
      await schemaReady;
    } catch {
      schemaReady = undefined;
      throw new HttpError(503, 'DATABASE_SETUP_REQUIRED');
    }
    next();
  });
  app.use('/auth', authRouter());
  app.use('/auctions/:id', playerRouter());
  app.use('/auctions/:id', teamRouter());
  app.use('/auctions/:id', engineRouter());
  app.use('/auctions/:id', resultRouter());
  app.use('/auctions/:id', eventRouter());
  app.use('/auctions', auctionRouter());
  app.get('/health/live', (_req, res) => {
    res.json(
      healthSchema.parse({ status: 'ok', service: 'sports-auction-api' }),
    );
  });
  app.get('/health/ready', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const database = await connectDb();
      await database.command({ ping: 1 });
      const metadata = await (
        await systemMetadata()
      ).findOne({ _id: 'schema_version' });
      if (metadata?.value !== 'bootstrap')
        throw new Error('Database setup missing');
      await checkSchema();
      res.json(
        healthSchema.parse({
          status: 'ok',
          service: 'sports-auction-api',
          database: 'connected',
        }),
      );
    } catch {
      res.status(503).json(
        healthSchema.parse({
          status: 'unavailable',
          service: 'sports-auction-api',
          database: 'unavailable',
        }),
      );
    }
  });
  app.use((_req, res) => {
    res.status(404).json({ error: 'NOT_FOUND' });
  });
  const onError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.code });
      return;
    }
    if (error instanceof ZodError) {
      res.status(422).json({
        error: 'VALIDATION_FAILED',
        fields: error.flatten().fieldErrors,
      });
      return;
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      const keys = 'keyPattern' in error ? error.keyPattern : undefined;
      const duplicateTeam =
        typeof keys === 'object' && keys !== null && 'nameKey' in keys;
      res.status(409).json({
        error: duplicateTeam ? 'TEAM_NAME_EXISTS' : 'ACCOUNT_UNAVAILABLE',
      });
      return;
    }
    const status =
      error instanceof SyntaxError
        ? 400
        : typeof error === 'object' &&
            error !== null &&
            'status' in error &&
            error.status === 413
          ? 413
          : 500;
    res.status(status).json({
      error:
        status === 400
          ? 'INVALID_JSON'
          : status === 413
            ? 'PAYLOAD_TOO_LARGE'
            : 'INTERNAL_ERROR',
    });
  };
  app.use(onError);
  return app;
}
