import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5180',
    viewport: { width: 1440, height: 900 },
    channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || undefined,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5180 --strictPort',
    url: 'http://127.0.0.1:5180',
    env: {
      VITE_TMDB_API_KEY: 'test-token',
      VITE_APPWRITE_ENDPOINT: '',
      VITE_APPWRITE_PROJECT_ID: '',
      VITE_APPWRITE_DATABASE_ID: '',
      VITE_APPWRITE_TABLE_ID: '',
    },
  },
})
