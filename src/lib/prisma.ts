// lib/prisma.ts
import "dotenv/config";
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  // Use a connection POOL (not a single connection).
  // This is what prevents the 45-153s queue wait times.
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,                       // max 10 concurrent connections
    idleTimeoutMillis: 30_000,     // release idle connections after 30s
    connectionTimeoutMillis: 5_000, // fail fast if no connection in 5s
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;