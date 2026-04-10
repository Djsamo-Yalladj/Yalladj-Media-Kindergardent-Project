// Prisma client singleton wired to Neon over HTTP (port 443).
// TCP 5432 is blocked on our dev network, so we use PrismaNeonHTTP
// (the WebSocket-based PrismaNeon would try port 5432 again).
// Safe in both local Node scripts and Vercel serverless (singleton via globalThis).

import { PrismaClient } from '@prisma/client';
import { PrismaNeonHTTP } from '@prisma/adapter-neon';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

type GlobalWithPrisma = typeof globalThis & { __prisma?: PrismaClient };
const globalForPrisma = globalThis as GlobalWithPrisma;

function createClient(): PrismaClient {
  const adapter = new PrismaNeonHTTP(connectionString!, {});
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.__prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma;
}
