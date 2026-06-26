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
  return createPrismaClient();
}

// Defer initialization until first use so `next build` doesn't throw when
// DB_PASSWORD is absent from the Vercel Preview environment.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const client = getPrismaClient();
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = client;
    }
    const val = Reflect.get(client as object, prop);
    return typeof val === 'function' ? (val as (...args: unknown[]) => unknown).bind(client) : val;
  },
});

export default prisma;
