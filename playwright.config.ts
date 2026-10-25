import { defineConfig } from '@playwright/test';
const webPort = Number(process.env.E2E_WEB_PORT ?? 3000);
const apiPort = Number(process.env.E2E_API_PORT ?? 4000);
const webOrigin = `http://localhost:${webPort}`;
const apiOrigin = `http://localhost:${apiPort}`;
export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: webOrigin },
  webServer: [
    {
      command: 'pnpm --filter @sports/api dev',
      url: `${apiOrigin}/health/ready`,
      env: { API_PORT: String(apiPort), WEB_ORIGIN: webOrigin },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `pnpm --filter @sports/web dev --port ${webPort}`,
      url: webOrigin,
      env: { API_URL: apiOrigin },
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
