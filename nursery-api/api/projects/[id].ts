// GET    /api/projects/:id  — fetch one project
// PATCH  /api/projects/:id  — partial update. If stage changes: close current
//                             ProjectStageRecord (set exitedAt + duration_hours)
//                             and open a new one.
// DELETE /api/projects/:id  — soft delete (sets deletedAt)
// TODO(phase-b): add auth (req.user → audit actor).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma.js';
import { route, parseBody, ok, notFound, HttpError } from '../../src/lib/http.js';
import { recordAudit } from '../../src/lib/audit.js';
import { updateProjectSchema } from '../../src/schemas/project.js';

function getId(req: VercelRequest): string {
  const raw = req.query.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || typeof id !== 'string') notFound('project');
  return id;
}

async function get(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
  if (!project) notFound('project');
  ok(res, project);
}

async function patch(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const input = parseBody(updateProjectSchema, req.body);

  const existing = await prisma.project.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) notFound('project');

  // If changing nursery, validate it exists.
  if (input.nurseryId && input.nurseryId !== existing.nurseryId) {
    const n = await prisma.nursery.findFirst({
      where: { id: input.nurseryId, deletedAt: null },
      select: { id: true },
    });
    if (!n) throw new HttpError(400, 'invalid_nursery', 'nurseryId does not exist');
  }

  // Slug collision check.
  if (input.slug) {
    const clash = await prisma.project.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (clash && clash.id !== id) {
      throw new HttpError(409, 'slug_taken', `slug "${input.slug}" is already in use`);
    }
  }

  const data: Prisma.ProjectUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.slug !== undefined) data.slug = input.slug;
  if (input.description !== undefined) {
    data.description = input.description as Prisma.InputJsonValue;
  }
  if (input.packageType !== undefined) data.packageType = input.packageType;
  if (input.contractValue !== undefined) {
    data.contractValue =
      input.contractValue != null ? new Prisma.Decimal(input.contractValue) : null;
  }
  if (input.startDate !== undefined) {
    data.startDate = input.startDate ? new Date(input.startDate) : null;
  }
  if (input.targetLaunchDate !== undefined) {
    data.targetLaunchDate = input.targetLaunchDate ? new Date(input.targetLaunchDate) : null;
  }
  if (input.launchedAt !== undefined) {
    data.launchedAt = input.launchedAt ? new Date(input.launchedAt) : null;
  }
  if (input.assignedToId !== undefined) data.assignedToId = input.assignedToId;
  if (input.progressPercent !== undefined) data.progressPercent = input.progressPercent;
  if (input.liveUrl !== undefined) data.liveUrl = input.liveUrl;
  if (input.repoUrl !== undefined) data.repoUrl = input.repoUrl;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.nurseryId !== undefined) data.nurseryId = input.nurseryId;

  const stageChanging = input.stage !== undefined && input.stage !== existing.stage;
  if (stageChanging) {
    data.stage = input.stage;
    // Auto-stamp launchedAt when entering 'launched' if caller didn't set it.
    if (input.stage === 'launched' && input.launchedAt === undefined && !existing.launchedAt) {
      data.launchedAt = new Date();
    }
  }

  // Stage-transition bookkeeping. NOTE: PrismaNeonHTTP doesn't support interactive
  // $transaction, so these run as sequential calls. Risk window is small and the
  // audit_logs helper (A3.8) will catch any drift.
  if (stageChanging) {
    const open = await prisma.projectStageRecord.findFirst({
      where: { projectId: id, exitedAt: null },
      orderBy: { enteredAt: 'desc' },
    });
    if (open) {
      const now = new Date();
      const durationHours = Math.round(
        (now.getTime() - new Date(open.enteredAt).getTime()) / 3_600_000,
      );
      await prisma.projectStageRecord.update({
        where: { id: open.id },
        data: { exitedAt: now, durationHours },
      });
    }
    await prisma.projectStageRecord.create({
      data: {
        projectId: id,
        stage: input.stage!,
        notes: input.stageChangeNotes,
      },
    });
  }
  const project = await prisma.project.update({ where: { id }, data });

  await recordAudit({
    req,
    action: stageChanging ? 'project.stage_changed' : 'project.updated',
    entityTable: 'projects',
    entityId: project.id,
    entityLabel: project.name,
    before: existing,
    after: project,
    metadata: {
      patch: input,
      ...(stageChanging
        ? { stageFrom: existing.stage, stageTo: input.stage }
        : {}),
    },
  });

  ok(res, project);
}

async function remove(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const existing = await prisma.project.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) notFound('project');

  await prisma.project.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await recordAudit({
    req,
    action: 'project.deleted',
    entityTable: 'projects',
    entityId: id,
    entityLabel: existing.name,
    before: existing,
  });

  ok(res, { id, deleted: true });
}

export default route({ GET: get, PATCH: patch, DELETE: remove });
