// GET  /api/files — list (linkedTable, linkedId, mimeType, uploadedById, search, pagination)
// POST /api/files — register file metadata. Validates that the linked parent row
//                   exists for tables we know about. Unique storageKey.
// NOTE: actual bytes live in object storage; this endpoint only tracks metadata.
// BigInt sizeBytes is serialized as string for JSON safety.
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
import { createFileSchema, listFilesQuerySchema } from '../../src/schemas/content.js';

type FileRow = Prisma.FileGetPayload<Record<string, never>>;

function serializeFile<T extends { sizeBytes: bigint | null }>(f: T): Omit<T, 'sizeBytes'> & {
  sizeBytes: string | null;
} {
  return { ...f, sizeBytes: f.sizeBytes == null ? null : f.sizeBytes.toString() };
}

// Validate that the linked parent row exists (best-effort for known tables).
// Unknown tables (project_specs, users, audit_reports) are accepted without check.
async function validateLinked(linkedTable: string, linkedId: string): Promise<void> {
  const notExist = (label: string) =>
    new HttpError(400, 'invalid_linked_parent', `${label} ${linkedId} does not exist`);
  switch (linkedTable) {
    case 'nurseries': {
      const row = await prisma.nursery.findFirst({
        where: { id: linkedId, deletedAt: null },
        select: { id: true },
      });
      if (!row) throw notExist('nursery');
      return;
    }
    case 'projects': {
      const row = await prisma.project.findFirst({
        where: { id: linkedId, deletedAt: null },
        select: { id: true },
      });
      if (!row) throw notExist('project');
      return;
    }
    case 'deliverables': {
      const row = await prisma.deliverable.findFirst({
        where: { id: linkedId, deletedAt: null },
        select: { id: true },
      });
      if (!row) throw notExist('deliverable');
      return;
    }
    case 'tickets': {
      const row = await prisma.ticket.findFirst({
        where: { id: linkedId, deletedAt: null },
        select: { id: true },
      });
      if (!row) throw notExist('ticket');
      return;
    }
    case 'handovers': {
      const row = await prisma.handover.findFirst({
        where: { id: linkedId, deletedAt: null },
        select: { id: true },
      });
      if (!row) throw notExist('handover');
      return;
    }
    case 'leads': {
      const row = await prisma.lead.findFirst({
        where: { id: linkedId, deletedAt: null },
        select: { id: true },
      });
      if (!row) throw notExist('lead');
      return;
    }
    case 'content_blocks': {
      const row = await prisma.contentBlock.findFirst({
        where: { id: linkedId, deletedAt: null },
        select: { id: true },
      });
      if (!row) throw notExist('content_block');
      return;
    }
    default:
      // project_specs, users, audit_reports — skip.
      return;
  }
}

async function list(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { linkedTable, linkedId, mimeType, uploadedById, search, limit, offset } = parseQuery(
    listFilesQuerySchema,
    req.query,
  );

  const where: Prisma.FileWhereInput = { deletedAt: null };
  if (linkedTable) where.linkedTable = linkedTable;
  if (linkedId) where.linkedId = linkedId;
  if (mimeType) where.mimeType = mimeType;
  if (uploadedById) where.uploadedById = uploadedById;
  if (search) {
    where.OR = [
      { filename: { contains: search, mode: 'insensitive' } },
      { label: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.file.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.file.count({ where }),
  ]);

  ok(res, {
    rows: (rows as FileRow[]).map(serializeFile),
    total,
    limit,
    offset,
  });
}

async function create(req: VercelRequest, res: VercelResponse): Promise<void> {
  const input = parseBody(createFileSchema, req.body);

  await validateLinked(input.linkedTable, input.linkedId);

  try {
    const file = await prisma.file.create({
      data: {
        filename: input.filename,
        storageKey: input.storageKey,
        url: input.url,
        mimeType: input.mimeType,
        sizeBytes: BigInt(input.sizeBytes),
        checksum: input.checksum,
        linkedTable: input.linkedTable,
        linkedId: input.linkedId,
        label: input.label,
        isPublic: input.isPublic ?? false,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        uploadedById: input.uploadedById,
      },
    });
    await recordAudit({
      req,
      action: 'file.created',
      entityTable: 'files',
      entityId: file.id,
      entityLabel: file.filename,
      after: file,
      metadata: { linkedTable: file.linkedTable, linkedId: file.linkedId },
    });
    ok(res, serializeFile(file), 201);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new HttpError(409, 'duplicate_storage_key', 'storageKey already exists');
    }
    throw err;
  }
}

export default route({ GET: list, POST: create });
