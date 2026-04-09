import { PrismaClient } from './generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: pg.Pool | undefined;
};

function createPrismaClient(): PrismaClient {
  if (!process.env.DB_PASSWORD) {
    throw new Error('DB_PASSWORD environment variable is not set');
  }

  if (!globalForPrisma.pool) {
    globalForPrisma.pool = new pg.Pool({
      host: 'aws-1-us-east-2.pooler.supabase.com',
      port: 5432,
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
    if (typeof (globalForPrisma.prisma as unknown as Record<string, unknown>).oAuthToken === 'undefined') {
      globalForPrisma.pool?.end().catch(() => {});
      globalForPrisma.prisma = undefined;
      globalForPrisma.pool = undefined;
    } else {
      return globalForPrisma.prisma;
    }
  }
  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
}

// Lazy singleton — resolved on first database access, not at module load time.
// This prevents build-time failures when DB_PASSWORD is absent (e.g. CI, local
// builds without a .env.local) because Next.js executes module initializers
// during the "Collecting page data" build phase.
const prismaProxy = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrismaClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const prisma: PrismaClient = prismaProxy;

export default prisma;
