// GET  /api/leads        — list leads (status, assignedToId, search, pagination)
// POST /api/leads        — create lead
// TODO(phase-b): add auth (req.user → audit actor).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma.js';
import { route, parseBody, parseQuery, ok } from '../../src/lib/http.js';
import { recordAudit } from '../../src/lib/audit.js';
import {
  createLeadSchema,
  listLeadsQuerySchema,
} from '../../src/schemas/lead.js';

async function list(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { status, assignedToId, search, limit, offset } = parseQuery(
    listLeadsQuerySchema,
    req.query,
  );

  const where: Prisma.LeadWhereInput = { deletedAt: null };
  if (status) where.status = status;
  if (assignedToId) where.assignedToId = assignedToId;
  if (search) {
    where.OR = [
      { nurseryName: { contains: search, mode: 'insensitive' } },
      { contactName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.lead.count({ where }),
  ]);

  ok(res, { rows, total, limit, offset });
}

async function create(req: VercelRequest, res: VercelResponse): Promise<void> {
  const input = parseBody(createLeadSchema, req.body);

  const lead = await prisma.lead.create({
    data: {
      nurseryName: input.nurseryName,
      contactName: input.contactName,
      email: input.email,
      phone: input.phone,
      country: input.country,
      city: input.city,
      website: input.website,
      source: input.source,
      budget: input.budget != null ? new Prisma.Decimal(input.budget) : null,
      packageInterest: input.packageInterest,
      notes: input.notes,
      status: input.status ?? 'new',
      intakeData: (input.intakeData ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  await recordAudit({
    req,
    action: 'lead.created',
    entityTable: 'leads',
    entityId: lead.id,
    entityLabel: lead.nurseryName,
    after: lead,
  });

  ok(res, lead, 201);
}

export default route({ GET: list, POST: create });
