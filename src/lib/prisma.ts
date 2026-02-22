// lib/prisma.ts
import "dotenv/config";
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  // PrismaPg DOES support pg.Pool — but the pool needs generous timeouts
  // because Next.js dev mode cold-starts connections frequently.
  // The 5s connectionTimeout we had was too aggressive for local dev.
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,                          // 10 concurrent connections
    idleTimeoutMillis: 60_000,        // keep idle connections alive for 60s
    connectionTimeoutMillis: 10_000,  // wait up to 10s for a connection (not 5s)
    allowExitOnIdle: false,           // prevent pool from closing on idle in dev
  });

  // Log pool errors so they don't silently kill connections
  pool.on('error', (err) => {
    console.error('❌ pg pool error (idle client):', err.message);
  });

  pool.on('connect', () => {
    console.log(`✅ pg pool: new connection established (pool size: ${pool.totalCount})`);
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;