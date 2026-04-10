// GET    /api/leads/:id  — fetch one lead
// PATCH  /api/leads/:id  — partial update
// DELETE /api/leads/:id  — soft delete (sets deletedAt)
// TODO(phase-b): add auth (req.user → audit actor).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma.js';
import { route, parseBody, ok, notFound } from '../../src/lib/http.js';
import { recordAudit } from '../../src/lib/audit.js';
import { updateLeadSchema } from '../../src/schemas/lead.js';

function getId(req: VercelRequest): string {
  const raw = req.query.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || typeof id !== 'string') notFound('lead');
  return id;
}

async function get(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const lead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
  if (!lead) notFound('lead');
  ok(res, lead);
}

async function patch(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const input = parseBody(updateLeadSchema, req.body);

  const existing = await prisma.lead.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) notFound('lead');

  const data: Prisma.LeadUpdateInput = {};
  if (input.nurseryName !== undefined) data.nurseryName = input.nurseryName;
  if (input.contactName !== undefined) data.contactName = input.contactName;
  if (input.email !== undefined) data.email = input.email;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.country !== undefined) data.country = input.country;
  if (input.city !== undefined) data.city = input.city;
  if (input.website !== undefined) data.website = input.website;
  if (input.source !== undefined) data.source = input.source;
  if (input.budget !== undefined) {
    data.budget = input.budget != null ? new Prisma.Decimal(input.budget) : null;
  }
  if (input.packageInterest !== undefined) data.packageInterest = input.packageInterest;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.status !== undefined) data.status = input.status;
  if (input.intakeData !== undefined) {
    data.intakeData = input.intakeData as Prisma.InputJsonValue;
  }
  if (input.qualifiedAt !== undefined) data.qualifiedAt = new Date(input.qualifiedAt);
  if (input.convertedAt !== undefined) data.convertedAt = new Date(input.convertedAt);

  const lead = await prisma.lead.update({ where: { id }, data });

  await recordAudit({
    req,
    action: 'lead.updated',
    entityTable: 'leads',
    entityId: lead.id,
    entityLabel: lead.nurseryName,
    before: existing,
    after: lead,
    metadata: { patch: input },
  });

  ok(res, lead);
}

async function remove(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const existing = await prisma.lead.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) notFound('lead');

  await prisma.lead.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await recordAudit({
    req,
    action: 'lead.deleted',
    entityTable: 'leads',
    entityId: id,
    entityLabel: existing.nurseryName,
    before: existing,
  });

  ok(res, { id, deleted: true });
}

export default route({ GET: get, PATCH: patch, DELETE: remove });
