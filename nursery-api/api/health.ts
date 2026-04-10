// Smoke-test endpoint: confirms the API is alive AND Prisma can reach Neon.
// TODO(phase-b): add auth. For now this is publicly accessible.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../src/lib/prisma.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  try {
    const contractTypeCount = await prisma.contractTypeDef.count();
    res.status(200).json({
      ok: true,
      service: 'nursery-api',
      db: 'connected',
      contractTypes: contractTypeCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({
      ok: false,
      service: 'nursery-api',
      db: 'error',
      error: message,
    });
  }
}
