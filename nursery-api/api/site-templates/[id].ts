// GET    /api/site-templates/:id  — fetch one
// PATCH  /api/site-templates/:id  — partial update. If flipping isDefault=true,
//                                    clears other defaults for same package first
//                                    (sequential — no tx).
// DELETE /api/site-templates/:id  — soft delete
// TODO(phase-b): add auth (req.user → audit actor).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma.js';
import {
  route,
  parseBody,
  ok,
  notFound,
  HttpError,
  isUniqueViolation,
} from '../../src/lib/http.js';
import { recordAudit } from '../../src/lib/audit.js';
import { updateSiteTemplateSchema } from '../../src/schemas/content.js';

function getId(req: VercelRequest): string {
  const raw = req.query.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || typeof id !== 'string') notFound('site_template');
  return id;
}

async function get(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const row = await prisma.siteTemplate.findFirst({ where: { id, deletedAt: null } });
  if (!row) notFound('site_template');
  ok(res, row);
}

async function patch(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const input = parseBody(updateSiteTemplateSchema, req.body);

  const existing = await prisma.siteTemplate.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) notFound('site_template');

  // Clearing prior defaults for this package (raw UPDATE — updateMany opens a tx
  // which HTTP mode rejects).
  if (input.isDefault === true) {
    const targetPkg = input.packageType ?? existing.packageType;
    await prisma.$executeRaw`
      UPDATE site_templates
         SET is_default = false
       WHERE package_type = ${targetPkg}::"PackageType"
         AND is_default = true
         AND deleted_at IS NULL
         AND id <> ${id}
    `;
  }

  const data: Prisma.SiteTemplateUpdateInput = {};
  if (input.key !== undefined) data.key = input.key;
  if (input.name !== undefined) data.name = input.name;
  if (input.nameAr !== undefined) data.nameAr = input.nameAr;
  if (input.description !== undefined) {
    data.description = (input.description ?? Prisma.JsonNull) as Prisma.InputJsonValue;
  }
  if (input.packageType !== undefined) data.packageType = input.packageType;
  if (input.version !== undefined) data.version = input.version;
  if (input.thumbnailUrl !== undefined) data.thumbnailUrl = input.thumbnailUrl;
  if (input.previewUrl !== undefined) data.previewUrl = input.previewUrl;
  if (input.pages !== undefined) data.pages = input.pages as unknown as Prisma.InputJsonValue;
  if (input.defaultBrand !== undefined) {
    data.defaultBrand = (input.defaultBrand ?? Prisma.JsonNull) as Prisma.InputJsonValue;
  }
  if (input.features !== undefined) {
    data.features = (input.features ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue;
  }
  if (input.contentRefs !== undefined) {
    data.contentRefs = (input.contentRefs ?? Prisma.JsonNull) as Prisma.InputJsonValue;
  }
  if (input.repoUrl !== undefined) data.repoUrl = input.repoUrl;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.isDefault !== undefined) data.isDefault = input.isDefault;

  try {
    const row = await prisma.siteTemplate.update({ where: { id }, data });
    await recordAudit({
      req,
      action: 'site_template.updated',
      entityTable: 'site_templates',
      entityId: row.id,
      entityLabel: row.key,
      before: existing,
      after: row,
      metadata: { patch: input },
    });
    ok(res, row);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new HttpError(409, 'duplicate_key', 'a site_template with this key already exists');
    }
    throw err;
  }
}

async function remove(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const existing = await prisma.siteTemplate.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) notFound('site_template');

  await prisma.siteTemplate.update({ where: { id }, data: { deletedAt: new Date() } });

  await recordAudit({
    req,
    action: 'site_template.deleted',
    entityTable: 'site_templates',
    entityId: id,
    entityLabel: existing.key,
    before: existing,
  });

  ok(res, { id, deleted: true });
}

export default route({ GET: get, PATCH: patch, DELETE: remove });
