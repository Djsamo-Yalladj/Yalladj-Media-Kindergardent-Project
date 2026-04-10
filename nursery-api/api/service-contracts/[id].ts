// GET    /api/service-contracts/:id  — fetch one
// PATCH  /api/service-contracts/:id  — partial update. Auto-stamps cancelledAt when
//                                       status transitions to 'cancelled'.
// DELETE /api/service-contracts/:id  — soft delete (sets deletedAt)
// TODO(phase-b): add auth (req.user → audit actor).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma.js';
import { route, parseBody, ok, notFound, HttpError } from '../../src/lib/http.js';
import { recordAudit } from '../../src/lib/audit.js';
import { updateServiceContractSchema } from '../../src/schemas/ticket.js';

function getId(req: VercelRequest): string {
  const raw = req.query.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || typeof id !== 'string') notFound('service_contract');
  return id;
}

async function get(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const contract = await prisma.serviceContract.findFirst({ where: { id, deletedAt: null } });
  if (!contract) notFound('service_contract');
  ok(res, contract);
}

async function patch(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const input = parseBody(updateServiceContractSchema, req.body);

  const existing = await prisma.serviceContract.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) notFound('service_contract');

  if (input.nurseryId && input.nurseryId !== existing.nurseryId) {
    const n = await prisma.nursery.findFirst({
      where: { id: input.nurseryId, deletedAt: null },
      select: { id: true },
    });
    if (!n) throw new HttpError(400, 'invalid_nursery', 'nurseryId does not exist');
  }

  if (input.projectId) {
    const targetNurseryId = input.nurseryId ?? existing.nurseryId;
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, deletedAt: null },
      select: { id: true, nurseryId: true },
    });
    if (!project) throw new HttpError(400, 'invalid_project', 'projectId does not exist');
    if (project.nurseryId !== targetNurseryId) {
      throw new HttpError(
        400,
        'project_nursery_mismatch',
        'project does not belong to the given nursery',
      );
    }
  }

  if (input.contractTypeId) {
    const ct = await prisma.contractTypeDef.findFirst({
      where: { id: input.contractTypeId, deletedAt: null },
      select: { id: true },
    });
    if (!ct) throw new HttpError(400, 'invalid_contract_type', 'contractTypeId does not exist');
  }

  const data: Prisma.ServiceContractUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.amount !== undefined) data.amount = new Prisma.Decimal(input.amount);
  if (input.billingCycle !== undefined) data.billingCycle = input.billingCycle;
  if (input.startDate !== undefined) data.startDate = new Date(input.startDate);
  if (input.endDate !== undefined) {
    data.endDate = input.endDate ? new Date(input.endDate) : null;
  }
  if (input.renewsAt !== undefined) {
    data.renewsAt = input.renewsAt ? new Date(input.renewsAt) : null;
  }
  if (input.autoRenew !== undefined) data.autoRenew = input.autoRenew;
  if (input.terms !== undefined) data.terms = input.terms as Prisma.InputJsonValue;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.cancelReason !== undefined) data.cancelReason = input.cancelReason;
  if (input.nurseryId !== undefined) data.nurseryId = input.nurseryId;
  if (input.projectId !== undefined) data.projectId = input.projectId;
  if (input.contractTypeId !== undefined) {
    data.contractType = { connect: { id: input.contractTypeId } };
  }

  if (input.status !== undefined) {
    data.status = input.status;
    if (
      input.status === 'cancelled' &&
      input.cancelledAt === undefined &&
      !existing.cancelledAt
    ) {
      data.cancelledAt = new Date();
    }
  }
  if (input.cancelledAt !== undefined) {
    data.cancelledAt = input.cancelledAt ? new Date(input.cancelledAt) : null;
  }

  const contract = await prisma.serviceContract.update({ where: { id }, data });

  const cancelling =
    input.status === 'cancelled' && existing.status !== 'cancelled';
  await recordAudit({
    req,
    action: cancelling ? 'service_contract.cancelled' : 'service_contract.updated',
    entityTable: 'service_contracts',
    entityId: contract.id,
    entityLabel: contract.title,
    before: existing,
    after: contract,
    metadata: { patch: input },
  });

  ok(res, contract);
}

async function remove(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const existing = await prisma.serviceContract.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) notFound('service_contract');

  await prisma.serviceContract.update({ where: { id }, data: { deletedAt: new Date() } });

  await recordAudit({
    req,
    action: 'service_contract.deleted',
    entityTable: 'service_contracts',
    entityId: id,
    entityLabel: existing.title,
    before: existing,
  });

  ok(res, { id, deleted: true });
}

export default route({ GET: get, PATCH: patch, DELETE: remove });
