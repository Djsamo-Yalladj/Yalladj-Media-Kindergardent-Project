// GET  /api/content-blocks — list (category, nurseryId, isGlobal, isActive, search, pagination)
// POST /api/content-blocks — create. Unique `key`. Validates nursery if scoped.
// TODO(phase-b): add auth (req.user → audit actor).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma.js';
import {
  route,
  parseBody,
  parseQuery,
  ok,
  HttpError,
  isUniqueViolation,
} from '../../src/lib/http.js';
import { recordAudit } from '../../src/lib/audit.js';
import {
  createContentBlockSchema,
  listContentBlocksQuerySchema,
} from '../../src/schemas/content.js';

async function list(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { category, nurseryId, isGlobal, isActive, search, limit, offset } = parseQuery(
    listContentBlocksQuerySchema,
    req.query,
  );

  const where: Prisma.ContentBlockWhereInput = { deletedAt: null };
  if (category) where.category = category;
  if (nurseryId) where.nurseryId = nurseryId;
  if (isGlobal !== undefined) where.isGlobal = isGlobal;
  if (isActive !== undefined) where.isActive = isActive;
  if (search) {
    where.OR = [
      { key: { contains: search, mode: 'insensitive' } },
      { titleEn: { contains: search, mode: 'insensitive' } },
      { titleAr: { contains: search, mode: 'insensitive' } },
      { bodyEn: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.contentBlock.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
    }),
    prisma.contentBlock.count({ where }),
  ]);

  ok(res, { rows, total, limit, offset });
}

async function create(req: VercelRequest, res: VercelResponse): Promise<void> {
  const input = parseBody(createContentBlockSchema, req.body);

  if (input.nurseryId) {
    const nursery = await prisma.nursery.findFirst({
      where: { id: input.nurseryId, deletedAt: null },
      select: { id: true },
    });
    if (!nursery) throw new HttpError(400, 'invalid_nursery', 'nurseryId does not exist');
  }

  try {
    const block = await prisma.contentBlock.create({
      data: {
        key: input.key,
        category: input.category,
        titleEn: input.titleEn,
        titleAr: input.titleAr,
        bodyEn: input.bodyEn,
        bodyAr: input.bodyAr,
        mediaUrl: input.mediaUrl,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        tags: input.tags ?? [],
        isGlobal: input.isGlobal ?? false,
        nurseryId: input.nurseryId ?? null,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
      },
    });
    await recordAudit({
      req,
      action: 'content_block.created',
      entityTable: 'content_blocks',
      entityId: block.id,
      entityLabel: block.key,
      after: block,
    });
    ok(res, block, 201);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new HttpError(409, 'duplicate_key', 'a content_block with this key already exists');
    }
    throw err;
  }
}

export default route({ GET: list, POST: create });
