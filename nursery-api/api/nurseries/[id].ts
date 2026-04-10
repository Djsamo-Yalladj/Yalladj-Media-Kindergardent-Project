// GET    /api/nurseries/:id  — fetch one nursery
// PATCH  /api/nurseries/:id  — partial update
// DELETE /api/nurseries/:id  — soft delete (sets deletedAt)
// TODO(phase-b): add auth (req.user → audit actor).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma.js';
import { route, parseBody, ok, notFound, HttpError } from '../../src/lib/http.js';
import { recordAudit } from '../../src/lib/audit.js';
import { updateNurserySchema } from '../../src/schemas/nursery.js';

function getId(req: VercelRequest): string {
  const raw = req.query.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || typeof id !== 'string') notFound('nursery');
  return id;
}

async function get(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const nursery = await prisma.nursery.findFirst({ where: { id, deletedAt: null } });
  if (!nursery) notFound('nursery');
  ok(res, nursery);
}

async function patch(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const input = parseBody(updateNurserySchema, req.body);

  const existing = await prisma.nursery.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) notFound('nursery');

  // If slug changes, make sure it doesn't collide.
  if (input.slug) {
    const clash = await prisma.nursery.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (clash && clash.id !== id) {
      throw new HttpError(409, 'slug_taken', `slug "${input.slug}" is already in use`);
    }
  }

  const data: Prisma.NurseryUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.nameAr !== undefined) data.nameAr = input.nameAr;
  if (input.slug !== undefined) data.slug = input.slug;
  if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl;
  if (input.email !== undefined) data.email = input.email;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.whatsapp !== undefined) data.whatsapp = input.whatsapp;
  if (input.country !== undefined) data.country = input.country;
  if (input.city !== undefined) data.city = input.city;
  if (input.address !== undefined) data.address = input.address;
  if (input.website !== undefined) data.website = input.website;
  if (input.instagram !== undefined) data.instagram = input.instagram;
  if (input.facebook !== undefined) data.facebook = input.facebook;
  if (input.tiktok !== undefined) data.tiktok = input.tiktok;
  if (input.contactName !== undefined) data.contactName = input.contactName;
  if (input.contactRole !== undefined) data.contactRole = input.contactRole;
  if (input.packageType !== undefined) data.packageType = input.packageType;
  if (input.contractValue !== undefined) {
    data.contractValue =
      input.contractValue != null ? new Prisma.Decimal(input.contractValue) : null;
  }
  if (input.brandColors !== undefined) {
    data.brandColors = input.brandColors as Prisma.InputJsonValue;
  }
  if (input.brandFonts !== undefined) {
    data.brandFonts = input.brandFonts as Prisma.InputJsonValue;
  }
  if (input.description !== undefined) {
    data.description = input.description as Prisma.InputJsonValue;
  }
  if (input.tags !== undefined) data.tags = input.tags;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.onboardedAt !== undefined) {
    data.onboardedAt = input.onboardedAt ? new Date(input.onboardedAt) : null;
  }

  const nursery = await prisma.nursery.update({ where: { id }, data });

  await recordAudit({
    req,
    action: 'nursery.updated',
    entityTable: 'nurseries',
    entityId: nursery.id,
    entityLabel: nursery.name,
    before: existing,
    after: nursery,
    metadata: { patch: input },
  });

  ok(res, nursery);
}

async function remove(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const existing = await prisma.nursery.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) notFound('nursery');

  await prisma.nursery.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  await recordAudit({
    req,
    action: 'nursery.deleted',
    entityTable: 'nurseries',
    entityId: id,
    entityLabel: existing.name,
    before: existing,
  });

  ok(res, { id, deleted: true });
}

export default route({ GET: get, PATCH: patch, DELETE: remove });
