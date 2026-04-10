// GET  /api/settings — list (key, category, isPublic, search, pagination). Passing
//                       ?key=... returns that single row as rows[0] for convenience.
// POST /api/settings — create a setting. Unique `key`. JSON `value` accepts any shape.
// TODO(phase-b): add auth (req.user → audit actor). Encryption at rest for isEncrypted.

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
import { createSettingSchema, listSettingsQuerySchema } from '../../src/schemas/content.js';

async function list(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { key, category, isPublic, search, limit, offset } = parseQuery(
    listSettingsQuerySchema,
    req.query,
  );

  const where: Prisma.SettingWhereInput = { deletedAt: null };
  if (key) where.key = key;
  if (category) where.category = category;
  if (isPublic !== undefined) where.isPublic = isPublic;
  if (search) {
    where.OR = [
      { key: { contains: search, mode: 'insensitive' } },
      { label: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.setting.findMany({
      where,
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { key: 'asc' }],
      take: limit,
      skip: offset,
    }),
    prisma.setting.count({ where }),
  ]);

  ok(res, { rows, total, limit, offset });
}

async function create(req: VercelRequest, res: VercelResponse): Promise<void> {
  const input = parseBody(createSettingSchema, req.body);

  try {
    const setting = await prisma.setting.create({
      data: {
        key: input.key,
        value: (input.value ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        category: input.category,
        label: input.label,
        description: input.description,
        isPublic: input.isPublic ?? false,
        isSystem: input.isSystem ?? false,
        isEncrypted: input.isEncrypted ?? false,
        sortOrder: input.sortOrder ?? 0,
      },
    });
    await recordAudit({
      req,
      action: 'setting.created',
      entityTable: 'settings',
      entityId: setting.id,
      entityLabel: setting.key,
      // Never persist encrypted values to audit_logs. Store a redacted marker.
      after: setting.isEncrypted ? { ...setting, value: '[redacted]' } : setting,
    });
    ok(res, setting, 201);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new HttpError(409, 'duplicate_key', 'a setting with this key already exists');
    }
    throw err;
  }
}

export default route({ GET: list, POST: create });
