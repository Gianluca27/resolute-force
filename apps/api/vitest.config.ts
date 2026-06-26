import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/globalSetup.ts'],
    env: { DATABASE_URL: 'file:./test.db', NODE_ENV: 'test' },
    fileParallelism: false,
  },
});
