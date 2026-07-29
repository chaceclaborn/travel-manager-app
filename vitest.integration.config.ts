import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Integration tests — these talk to a REAL Postgres.
 *
 * Kept in a separate project from `yarn test` on purpose. The default suite is
 * pure and runs anywhere in milliseconds; that property is worth protecting,
 * and it is why the permission decision core was extracted prisma-free in the
 * first place. But a pure suite cannot prove the decision is wired to a
 * database correctly — that "account B is denied on account A's trip" holds
 * through real queries, real joins and real cascades. This project does that.
 *
 *   yarn test:integration                       # uses the local dev database
 *   DATABASE_URL=postgres://... yarn test:integration
 *
 * Requires a database with the current schema. NEVER point it at production —
 * it creates and deletes rows.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    // One database, shared fixtures: parallel files would race on the seeded
    // rows. These are fast enough that serial costs nothing.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
