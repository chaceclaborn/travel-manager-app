import { PrismaClient } from './generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: pg.Pool | undefined;
};

function createPrismaClient(): PrismaClient {
  // Local development: when a full DATABASE_URL is provided (e.g. `yarn local`
  // pointing at the Docker Postgres), use it directly instead of the hardcoded
  // Supabase pooler. Guarded on NODE_ENV so production can NEVER take this path
  // (and thus never bypass the transaction-pooler tuning below), regardless of
  // whether DATABASE_URL happens to be set in the deployed environment.
  if (process.env.NODE_ENV !== 'production' && process.env.DATABASE_URL) {
    if (!globalForPrisma.pool) {
      globalForPrisma.pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        max: 5,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 10000,
        allowExitOnIdle: true,
      });
    }
    const adapter = new PrismaPg(globalForPrisma.pool);
    return new PrismaClient({ adapter });
  }

  if (!process.env.DB_PASSWORD) {
    throw new Error('DB_PASSWORD environment variable is not set');
  }

  if (!globalForPrisma.pool) {
    globalForPrisma.pool = new pg.Pool({
      host: 'aws-1-us-east-2.pooler.supabase.com',
      // Transaction-mode pooler (6543), NOT session mode (5432). Session mode
      // pins one server connection per client for the client's lifetime — with
      // ~15 pooled server slots on the free-tier nano, a burst of serverless
      // instances (especially during deploy rollover) held every slot idle and
      // 500'd the whole API. Transaction mode multiplexes slots per statement.
      port: 6543,
      database: 'postgres',
      user: 'postgres.bsnzgcmizbonttgnxvqi',
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
      max: process.env.NODE_ENV === 'development' ? 3 : 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: true,
    });
  }

  const adapter = new PrismaPg(globalForPrisma.pool);
  return new PrismaClient({ adapter });
}

function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    // Validate that the cached client has new models — if it was cached
    // before a schema change, `.expense` etc. would be undefined.
    if (typeof (globalForPrisma.prisma as unknown as Record<string, unknown>).deviceToken === 'undefined') {
      globalForPrisma.pool?.end().catch(() => {});
      globalForPrisma.prisma = undefined;
      globalForPrisma.pool = undefined;
    } else {
      return globalForPrisma.prisma;
    }
  }
  return createPrismaClient();
}

export const prisma = getPrismaClient();

export default prisma;

globalForPrisma.prisma = prisma;
