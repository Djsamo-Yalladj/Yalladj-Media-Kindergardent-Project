// GET  /api/service-contracts — list (nurseryId, projectId, contractTypeId, status, search, pagination)
// POST /api/service-contracts — create. Validates nursery + optional project + contract_type exist.
// TODO(phase-b): add auth (req.user → audit actor).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma.js';
import { route, parseBody, parseQuery, ok, HttpError } from '../../src/lib/http.js';
import { recordAudit } from '../../src/lib/audit.js';
import {
  createServiceContractSchema,
  listServiceContractsQuerySchema,
} from '../../src/schemas/ticket.js';

async function list(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { nurseryId, projectId, contractTypeId, status, search, limit, offset } = parseQuery(
    listServiceContractsQuerySchema,
    req.query,
  );

  const where: Prisma.ServiceContractWhereInput = { deletedAt: null };
  if (nurseryId) where.nurseryId = nurseryId;
  if (projectId) where.projectId = projectId;
  if (contractTypeId) where.contractTypeId = contractTypeId;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { notes: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.serviceContract.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.serviceContract.count({ where }),
  ]);

  ok(res, { rows, total, limit, offset });
}

async function create(req: VercelRequest, res: VercelResponse): Promise<void> {
  const input = parseBody(createServiceContractSchema, req.body);

  const nursery = await prisma.nursery.findFirst({
    where: { id: input.nurseryId, deletedAt: null },
    select: { id: true },
  });
  if (!nursery) throw new HttpError(400, 'invalid_nursery', 'nurseryId does not exist');

  if (input.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, deletedAt: null },
      select: { id: true, nurseryId: true },
    });
    if (!project) throw new HttpError(400, 'invalid_project', 'projectId does not exist');
    if (project.nurseryId !== input.nurseryId) {
      throw new HttpError(
        400,
        'project_nursery_mismatch',
        'project does not belong to the given nursery',
      );
    }
  }

  const contractType = await prisma.contractTypeDef.findFirst({
    where: { id: input.contractTypeId, deletedAt: null },
    select: { id: true },
  });
  if (!contractType) {
    throw new HttpError(400, 'invalid_contract_type', 'contractTypeId does not exist');
  }

  const contract = await prisma.serviceContract.create({
    data: {
      nurseryId: input.nurseryId,
      projectId: input.projectId,
      contractTypeId: input.contractTypeId,
      title: input.title,
      amount: new Prisma.Decimal(input.amount),
      billingCycle: input.billingCycle,
      status: input.status ?? 'active',
      startDate: new Date(input.startDate),
      endDate: input.endDate ? new Date(input.endDate) : null,
      renewsAt: input.renewsAt ? new Date(input.renewsAt) : null,
      autoRenew: input.autoRenew ?? false,
      terms: (input.terms ?? undefined) as Prisma.InputJsonValue | undefined,
      notes: input.notes,
    },
  });

  await recordAudit({
    req,
    action: 'service_contract.created',
    entityTable: 'service_contracts',
    entityId: contract.id,
    entityLabel: contract.title,
    after: contract,
  });

  ok(res, contract, 201);
}

export default route({ GET: list, POST: create });
