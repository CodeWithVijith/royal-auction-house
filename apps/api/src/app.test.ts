import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import { envSchema } from './config';
describe('HTTP boundary', () => {
  const app = createApp();
  it('serves liveness without claiming database readiness', async () => {
    const result = await request(app).get('/health/live');
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      status: 'ok',
      service: 'sports-auction-api',
    });
    expect(result.headers['x-powered-by']).toBeUndefined();
  });
  it('returns structured 404', async () => {
    expect((await request(app).get('/missing')).status).toBe(404);
  });
  it('rejects malformed JSON', async () => {
    expect(
      (
        await request(app)
          .post('/missing')
          .set('Content-Type', 'application/json')
          .send('{')
      ).status,
    ).toBe(400);
  });
  it('validates ports', () => {
    expect(envSchema.safeParse({ API_PORT: '-1' }).success).toBe(false);
    expect(envSchema.safeParse({ PORT: '65536' }).success).toBe(false);
  });
  it('uses the hosting port before the local API port', () => {
    expect(envSchema.parse({ PORT: '10000', API_PORT: '4000' }).API_PORT).toBe(
      10000,
    );
    expect(envSchema.parse({ API_PORT: '4100' }).API_PORT).toBe(4100);
    expect(envSchema.parse({}).API_PORT).toBe(4000);
  });
});
