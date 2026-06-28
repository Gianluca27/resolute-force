import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/globalSetup.ts'],
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/resolute_test?schema=public', NODE_ENV: 'test', ADMIN_NOTIFY_EMAIL: 'admin@test.com', ADMIN_EMAIL: 'admin@test.com', ADMIN_PASSWORD: 'secret123' },
    fileParallelism: false,
  },
});
