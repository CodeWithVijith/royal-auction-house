import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';
config({ path: '.env' });
export default defineConfig({
  test: {
    include: ['tests/**/*.integration.test.ts'],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
