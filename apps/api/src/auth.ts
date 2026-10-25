import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { hash, verify, Algorithm } from '@node-rs/argon2';
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import { collections, type UserRecord } from '@sports/db';
import { loginSchema, registerSchema } from '@sports/shared';
import { HttpError } from './errors';
export const SESSION_COOKIE = 'sports_session';
const lifetime = 8 * 60 * 60 * 1000;
const hashOptions = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};
const dummyHash = hash(randomBytes(32).toString('hex'), hashOptions);
export const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export function readToken(req: Request) {
  const match = req.headers.cookie
    ?.split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(SESSION_COOKIE + '='));
  const token = match?.slice(SESSION_COOKIE.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : undefined;
}
export const organizer = (user: UserRecord) => ({
  id: user._id,
  name: user.name,
  email: user.email,
});
function cookie(res: Response, token: string, maxAge = lifetime) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}
export async function requireUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = readToken(req);
  if (!token) throw new HttpError(401, 'AUTH_REQUIRED');
  const c = await collections();
  const session = await c.sessions.findOne({
    _id: digest(token),
    expiresAt: { $gt: new Date() },
  });
  if (!session) throw new HttpError(401, 'AUTH_REQUIRED');
  const user = await c.users.findOne({ _id: session.userId });
  if (!user) throw new HttpError(401, 'AUTH_REQUIRED');
  res.locals.user = user;
  next();
}
export function currentUser(res: Response): UserRecord {
  return res.locals.user as UserRecord;
}
async function throttle(req: Request) {
  const c = await collections();
  const window = 15 * 60 * 1000;
  const now = Date.now();
  const email =
    typeof req.body?.email === 'string'
      ? req.body.email.trim().toLowerCase()
      : 'invalid';
  for (const [scope, cap] of [
    [req.ip ?? 'unknown', 100],
    ['email:' + email, 30],
  ] as const) {
    const key = digest(scope + ':' + Math.floor(now / window));
    const limit = await c.rateLimits.findOneAndUpdate(
      { _id: key },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date(now + window) },
      },
      { upsert: true, returnDocument: 'after' },
    );
    if (limit && limit.count > cap)
      throw new HttpError(429, 'TOO_MANY_ATTEMPTS');
  }
}
export function authRouter() {
  const router = Router();
  router.post('/register', async (req, res) => {
    await throttle(req);
    const input = registerSchema.parse(req.body);
    const c = await collections();
    const user: UserRecord = {
      _id: randomUUID(),
      name: input.name,
      email: input.email,
      passwordHash: await hash(input.password, hashOptions),
      createdAt: new Date(),
    };
    const token = randomBytes(32).toString('hex');
    const session = c.db.client.startSession();
    try {
      await session.withTransaction(async () => {
        await c.users.insertOne(user, { session });
        await c.sessions.insertOne(
          {
            _id: digest(token),
            userId: user._id,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + lifetime),
          },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
    cookie(res, token);
    res.status(201).json({ user: organizer(user) });
  });
  router.post('/login', async (req, res) => {
    await throttle(req);
    const input = loginSchema.parse(req.body);
    const c = await collections();
    const user = await c.users.findOne({ email: input.email });
    const valid = await verify(
      user?.passwordHash ?? (await dummyHash),
      input.password,
    );
    if (!user || !valid) throw new HttpError(401, 'INVALID_CREDENTIALS');
    const token = randomBytes(32).toString('hex');
    const old = readToken(req);
    const session = c.db.client.startSession();
    try {
      await session.withTransaction(async () => {
        if (old) await c.sessions.deleteOne({ _id: digest(old) }, { session });
        await c.sessions.insertOne(
          {
            _id: digest(token),
            userId: user._id,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + lifetime),
          },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
    cookie(res, token);
    res.json({ user: organizer(user) });
  });
  router.get('/me', requireUser, (_req, res) => {
    res.json({ user: organizer(currentUser(res)) });
  });
  router.post('/logout', async (req, res) => {
    const token = readToken(req);
    if (token)
      await (await collections()).sessions.deleteOne({ _id: digest(token) });
    cookie(res, '', 0);
    res.status(204).end();
  });
  return router;
}
