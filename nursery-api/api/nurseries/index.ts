// GET  /api/nurseries       — list nurseries (isActive, packageType, search, tag, pagination)
// POST /api/nurseries       — create nursery
// TODO(phase-b): add auth (req.user → audit actor).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma.js';
import { route, parseBody, parseQuery, ok, HttpError } from '../../src/lib/http.js';
import { recordAudit } from '../../src/lib/audit.js';
import {
  createNurserySchema,
  listNurseriesQuerySchema,
} from '../../src/schemas/nursery.js';

async function list(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { isActive, packageType, search, tag, limit, offset } = parseQuery(
    listNurseriesQuerySchema,
    req.query,
  );

  const where: Prisma.NurseryWhereInput = { deletedAt: null };
  if (isActive !== undefined) where.isActive = isActive;
  if (packageType) where.packageType = packageType;
  if (tag) where.tags = { has: tag };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { nameAr: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.nursery.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.nursery.count({ where }),
  ]);

  ok(res, { rows, total, limit, offset });
}

async function create(req: VercelRequest, res: VercelResponse): Promise<void> {
  const input = parseBody(createNurserySchema, req.body);

  // Slug uniqueness pre-check for a friendlier error than Prisma's P2002.
  const clash = await prisma.nursery.findUnique({
    where: { slug: input.slug },
    select: { id: true },
  });
  if (clash) throw new HttpError(409, 'slug_taken', `slug "${input.slug}" is already in use`);

  const nursery = await prisma.nursery.create({
    data: {
      name: input.name,
      nameAr: input.nameAr,
      slug: input.slug,
      logoUrl: input.logoUrl,
      email: input.email,
      phone: input.phone,
      whatsapp: input.whatsapp,
      country: input.country,
      city: input.city,
      address: input.address,
      website: input.website,
      instagram: input.instagram,
      facebook: input.facebook,
      tiktok: input.tiktok,
      contactName: input.contactName,
      contactRole: input.contactRole,
      packageType: input.packageType,
      contractValue:
        input.contractValue != null ? new Prisma.Decimal(input.contractValue) : null,
      brandColors: (input.brandColors ?? undefined) as Prisma.InputJsonValue | undefined,
      brandFonts: (input.brandFonts ?? undefined) as Prisma.InputJsonValue | undefined,
      description: (input.description ?? undefined) as Prisma.InputJsonValue | undefined,
      tags: input.tags ?? [],
      isActive: input.isActive ?? true,
      onboardedAt: input.onboardedAt ? new Date(input.onboardedAt) : null,
    },
  });

  await recordAudit({
    req,
    action: 'nursery.created',
    entityTable: 'nurseries',
    entityId: nursery.id,
    entityLabel: nursery.name,
    after: nursery,
  });

  ok(res, nursery, 201);
}

export default route({ GET: list, POST: create });
