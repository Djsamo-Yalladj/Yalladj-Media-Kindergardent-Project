// Zod schemas for Project + ProjectSpec + ProjectStage endpoints.
// Mirrors prisma/schema.prisma Project, ProjectSpec, ProjectStageRecord models.

import { z } from 'zod';
import { packageType } from './lead.js';

export const projectStageEnum = z.enum([
  'lead',
  'spec',
  'design',
  'build',
  'review',
  'launched',
  'archived',
]);

export const claudeCodeStatusEnum = z.enum([
  'not_started',
  'brief_ready',
  'in_progress',
  'completed',
  'failed',
]);

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const descriptionSchema = z.object({
  en: z.string().optional(),
  ar: z.string().optional(),
});

export const createProjectSchema = z.object({
  nurseryId: z.string().min(1),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(slugRegex, 'slug must be lowercase-with-hyphens'),
  description: descriptionSchema.optional(),
  packageType,
  stage: projectStageEnum.optional(),
  contractValue: z.number().positive().optional(),
  startDate: z.string().datetime().optional(),
  targetLaunchDate: z.string().datetime().optional(),
  assignedToId: z.string().optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  liveUrl: z.string().url().max(500).optional(),
  repoUrl: z.string().url().max(500).optional(),
  notes: z.string().max(10000).optional(),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  launchedAt: z.string().datetime().nullable().optional(),
  stageChangeNotes: z.string().max(2000).optional(),
});

export const listProjectsQuerySchema = z.object({
  nurseryId: z.string().optional(),
  stage: projectStageEnum.optional(),
  assignedToId: z.string().optional(),
  packageType: packageType.optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// Project spec — upsert payload (PUT). All fields optional.
export const upsertProjectSpecSchema = z.object({
  brandColors: z.record(z.string(), z.unknown()).optional(),
  brandFonts: z.record(z.string(), z.unknown()).optional(),
  logoUrl: z.string().url().max(500).optional(),
  pages: z.array(z.record(z.string(), z.unknown())).optional(),
  features: z.array(z.string()).optional(),
  integrations: z.record(z.string(), z.unknown()).optional(),
  contentPlan: z.record(z.string(), z.unknown()).optional(),
  targetAudience: z.record(z.string(), z.unknown()).optional(),
  referenceSites: z.array(z.string().url()).max(50).optional(),
  briefEn: z.string().max(20000).optional(),
  briefAr: z.string().max(20000).optional(),
  claudeCodeBrief: z.string().max(50000).optional(),
  claudeCodeStatus: claudeCodeStatusEnum.optional(),
  claudeCodeLog: z.record(z.string(), z.unknown()).optional(),
  approved: z.boolean().optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
export type UpsertProjectSpecInput = z.infer<typeof upsertProjectSpecSchema>;
