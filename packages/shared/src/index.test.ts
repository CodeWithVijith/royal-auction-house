import { describe, expect, it } from 'vitest';
import { denominationSchema, healthSchema } from './index';
describe('shared contracts', () => {
  it('accepts only supported denominations', () => {
    expect(denominationSchema.parse('INR')).toBe('INR');
    expect(denominationSchema.safeParse('USD').success).toBe(false);
  });
  it('rejects unrecognized service responses', () => {
    expect(
      healthSchema.safeParse({ status: 'ok', service: 'other' }).success,
    ).toBe(false);
  });
});
