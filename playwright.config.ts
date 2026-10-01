import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests', fullyParallel: true, forbidOnly: !!process.env.CI, retries: 0, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run start -- --hostname 127.0.0.1 --port 3000', url: 'http://127.0.0.1:3000/login', reuseExistingServer: !process.env.CI,
    env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' },
  },
  projects: [
    { name: 'unit', testMatch: '**/*.unit.spec.ts' },
    { name: 'http', testMatch: '**/*.http.spec.ts' },
    { name: 'desktop', testMatch: '**/*.browser.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', testMatch: '**/*.browser.spec.ts', use: { ...devices['Pixel 7'] } },
  ],
});
