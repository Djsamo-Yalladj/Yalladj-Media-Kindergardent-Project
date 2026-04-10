// GET /api/projects/:id/stages — list the stage history for a project
//                                 (newest enteredAt first).
// TODO(phase-b): add auth.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../../src/lib/prisma.js';
import { route, ok, notFound } from '../../../src/lib/http.js';

function getProjectId(req: VercelRequest): string {
  const raw = req.query.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || typeof id !== 'string') notFound('project');
  return id;
}

async function get(req: VercelRequest, res: VercelResponse): Promise<void> {
  const projectId = getProjectId(req);
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true },
  });
  if (!project) notFound('project');

  const rows = await prisma.projectStageRecord.findMany({
    where: { projectId },
    orderBy: { enteredAt: 'desc' },
  });

  ok(res, { rows, total: rows.length });
}

export default route({ GET: get });
