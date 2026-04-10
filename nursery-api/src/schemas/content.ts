// Zod schemas for Deliverable + ContentBlock + SiteTemplate + File + Setting endpoints.
// Mirrors prisma/schema.prisma Deliverable, ContentBlock, SiteTemplate, File, Setting models.

import { z } from 'zod';
import { packageType } from './lead.js';

const keyRegex = /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/;

// ============================================================
// DELIVERABLES
// ============================================================

export const createDeliverableSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(300),
  titleAr: z.string().max(300).optional(),
  description: z.string().max(10000).optional(),
  type: z.string().min(1).max(50), // mockup / asset / document / code / other
  fileUrl: z.string().url().max(1000).optional(),
  previewUrl: z.string().url().max(1000).optional(),
  version: z.number().int().min(1).optional(),
  isApproved: z.boolean().optional(),
  approvedAt: z.string().datetime().nullable().optional(),
  approvedById: z.string().optional(),
  deliveredAt: z.string().datetime().nullable().optional(),
});

export const updateDeliverableSchema = createDeliverableSchema.partial();

export const listDeliverablesQuerySchema = z.object({
  projectId: z.string().optional(),
  type: z.string().optional(),
  isApproved: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateDeliverableInput = z.infer<typeof createDeliverableSchema>;
export type UpdateDeliverableInput = z.infer<typeof updateDeliverableSchema>;
export type ListDeliverablesQuery = z.infer<typeof listDeliverablesQuerySchema>;

// ============================================================
// CONTENT BLOCKS
// ============================================================

export const createContentBlockSchema = z.object({
  key: z.string().min(1).max(100).regex(keyRegex, 'key must be lowercase snake/kebab case'),
  category: z.string().min(1).max(50),
  titleEn: z.string().max(500).optional(),
  titleAr: z.string().max(500).optional(),
  bodyEn: z.string().max(20000).optional(),
  bodyAr: z.string().max(20000).optional(),
  mediaUrl: z.string().url().max(1000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string().max(50)).max(30).optional(),
  isGlobal: z.boolean().optional(),
  nurseryId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const updateContentBlockSchema = createContentBlockSchema.partial();

export const listContentBlocksQuerySchema = z.object({
  category: z.string().optional(),
  nurseryId: z.string().optional(),
  isGlobal: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .optional(),
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateContentBlockInput = z.infer<typeof createContentBlockSchema>;
export type UpdateContentBlockInput = z.infer<typeof updateContentBlockSchema>;
export type ListContentBlocksQuery = z.infer<typeof listContentBlocksQuerySchema>;

// ============================================================
// SITE TEMPLATES
// ============================================================

const descI18n = z.object({
  en: z.string().optional(),
  ar: z.string().optional(),
});

export const createSiteTemplateSchema = z.object({
  key: z.string().min(1).max(100).regex(keyRegex, 'key must be lowercase snake/kebab case'),
  name: z.string().min(1).max(200),
  nameAr: z.string().max(200).optional(),
  description: descI18n.optional(),
  packageType,
  version: z.string().max(20).optional(),
  thumbnailUrl: z.string().url().max(1000).optional(),
  previewUrl: z.string().url().max(1000).optional(),
  pages: z.array(z.record(z.string(), z.unknown())).min(1),
  defaultBrand: z.record(z.string(), z.unknown()).optional(),
  features: z.array(z.unknown()).optional(),
  contentRefs: z.record(z.string(), z.unknown()).optional(),
  repoUrl: z.string().url().max(1000).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export const updateSiteTemplateSchema = createSiteTemplateSchema.partial();

export const listSiteTemplatesQuerySchema = z.object({
  packageType: packageType.optional(),
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateSiteTemplateInput = z.infer<typeof createSiteTemplateSchema>;
export type UpdateSiteTemplateInput = z.infer<typeof updateSiteTemplateSchema>;
export type ListSiteTemplatesQuery = z.infer<typeof listSiteTemplatesQuerySchema>;

// ============================================================
// FILES
// ============================================================

export const fileLinkedTableEnum = z.enum([
  'nurseries',
  'projects',
  'project_specs',
  'deliverables',
  'tickets',
  'handovers',
  'leads',
  'users',
  'content_blocks',
  'audit_reports',
]);

export const createFileSchema = z.object({
  filename: z.string().min(1).max(500),
  storageKey: z.string().min(1).max(1000),
  url: z.string().url().max(2000),
  mimeType: z.string().min(1).max(200),
  sizeBytes: z.number().int().nonnegative(),
  checksum: z.string().max(200).optional(),
  linkedTable: fileLinkedTableEnum,
  linkedId: z.string().min(1),
  label: z.string().max(200).optional(),
  isPublic: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  uploadedById: z.string().optional(),
});

export const updateFileSchema = z
  .object({
    filename: z.string().min(1).max(500),
    url: z.string().url().max(2000),
    label: z.string().max(200),
    isPublic: z.boolean(),
    metadata: z.record(z.string(), z.unknown()),
    checksum: z.string().max(200),
  })
  .partial();

export const listFilesQuerySchema = z.object({
  linkedTable: fileLinkedTableEnum.optional(),
  linkedId: z.string().optional(),
  mimeType: z.string().optional(),
  uploadedById: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateFileInput = z.infer<typeof createFileSchema>;
export type UpdateFileInput = z.infer<typeof updateFileSchema>;
export type ListFilesQuery = z.infer<typeof listFilesQuerySchema>;

// ============================================================
// SETTINGS
// ============================================================

export const createSettingSchema = z.object({
  key: z.string().min(1).max(200),
  value: z.unknown(),
  category: z.string().max(50).optional(),
  label: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  isPublic: z.boolean().optional(),
  isSystem: z.boolean().optional(),
  isEncrypted: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const updateSettingSchema = z
  .object({
    value: z.unknown(),
    category: z.string().max(50),
    label: z.string().max(200),
    description: z.string().max(2000),
    isPublic: z.boolean(),
    isEncrypted: z.boolean(),
    sortOrder: z.number().int(),
  })
  .partial();

export const listSettingsQuerySchema = z.object({
  key: z.string().optional(),
  category: z.string().optional(),
  isPublic: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateSettingInput = z.infer<typeof createSettingSchema>;
export type UpdateSettingInput = z.infer<typeof updateSettingSchema>;
export type ListSettingsQuery = z.infer<typeof listSettingsQuerySchema>;
