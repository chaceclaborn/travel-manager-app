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
      user: 'postgres.biaxoishtoysdjfiqddl',
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  const adapter = new PrismaPg(globalForPrisma.pool);
  return new PrismaClient({ adapter });
}

function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    // Validate that the cached client has new models — if it was cached
    // before a schema change, `.expense` etc. would be undefined.
    if (typeof (globalForPrisma.prisma as unknown as Record<string, unknown>).expense === 'undefined') {
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
