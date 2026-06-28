import { execSync } from 'node:child_process';

// Must mirror the DATABASE_URL in vitest.config.ts — globalSetup runs in the main
// process before test.env is applied, so it can't inherit that value automatically.
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/resolute_test?schema=public';

export default function setup() {
  execSync('npx prisma db push --force-reset --skip-generate', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
