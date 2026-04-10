// GET  /api/site-templates — list (packageType, isActive, search, pagination)
// POST /api/site-templates — create. Unique `key`. If isDefault=true, unsets
//                            any prior default for the same package (sequential
//                            update — PrismaNeonHTTP has no transactions).
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
  createSiteTemplateSchema,
  listSiteTemplatesQuerySchema,
} from '../../src/schemas/content.js';

async function list(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { packageType, isActive, search, limit, offset } = parseQuery(
    listSiteTemplatesQuerySchema,
    req.query,
  );

  const where: Prisma.SiteTemplateWhereInput = { deletedAt: null };
  if (packageType) where.packageType = packageType;
  if (isActive !== undefined) where.isActive = isActive;
  if (search) {
    where.OR = [
      { key: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
      { nameAr: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.siteTemplate.findMany({
      where,
      orderBy: [{ packageType: 'asc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
    }),
    prisma.siteTemplate.count({ where }),
  ]);

  ok(res, { rows, total, limit, offset });
}

async function create(req: VercelRequest, res: VercelResponse): Promise<void> {
  const input = parseBody(createSiteTemplateSchema, req.body);

  // If caller wants this to be the default for a package, clear prior defaults first.
  // PrismaNeonHTTP does NOT support transactions — even `updateMany` trips the
  // "Transactions are not supported in HTTP mode" guard, so we issue a raw UPDATE.
  if (input.isDefault) {
    await prisma.$executeRaw`
      UPDATE site_templates
         SET is_default = false
       WHERE package_type = ${input.packageType}::"PackageType"
         AND is_default = true
         AND deleted_at IS NULL
    `;
  }

  try {
    const tpl = await prisma.siteTemplate.create({
      data: {
        key: input.key,
        name: input.name,
        nameAr: input.nameAr,
        description: (input.description ?? undefined) as Prisma.InputJsonValue | undefined,
        packageType: input.packageType,
        version: input.version ?? '1.0.0',
        thumbnailUrl: input.thumbnailUrl,
        previewUrl: input.previewUrl,
        pages: input.pages as unknown as Prisma.InputJsonValue,
        defaultBrand: (input.defaultBrand ?? undefined) as Prisma.InputJsonValue | undefined,
        features: (input.features ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
        contentRefs: (input.contentRefs ?? undefined) as Prisma.InputJsonValue | undefined,
        repoUrl: input.repoUrl,
        isActive: input.isActive ?? true,
        isDefault: input.isDefault ?? false,
      },
    });
    await recordAudit({
      req,
      action: 'site_template.created',
      entityTable: 'site_templates',
      entityId: tpl.id,
      entityLabel: tpl.key,
      after: tpl,
      metadata: { clearedPriorDefault: input.isDefault === true },
    });
    ok(res, tpl, 201);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new HttpError(409, 'duplicate_key', 'a site_template with this key already exists');
    }
    throw err;
  }
}

export default route({ GET: list, POST: create });
