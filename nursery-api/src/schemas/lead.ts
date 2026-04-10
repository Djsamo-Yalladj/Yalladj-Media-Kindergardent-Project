// Zod schemas for Lead endpoints. Mirrors prisma/schema.prisma Lead model.
// Create schema requires the minimum needed to reach `new` status.
// Update schema is all fields optional.

import { z } from 'zod';

export const leadStatus = z.enum([
  'new',
  'contacted',
  'qualified',
  'proposal_sent',
  'won',
  'lost',
  'archived',
]);

export const packageType = z.enum(['starter', 'standard', 'premium', 'custom']);

export const createLeadSchema = z.object({
  nurseryName: z.string().min(1).max(200),
  contactName: z.string().min(1).max(200),
  email: z.string().email().max(320),
  phone: z.string().max(50).optional(),
  country: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  website: z.string().url().max(500).optional(),
  source: z.string().max(100).optional(),
  budget: z.number().positive().optional(),
  packageInterest: packageType.optional(),
  notes: z.string().max(5000).optional(),
  status: leadStatus.optional(),
  intakeData: z.record(z.string(), z.unknown()).optional(),
});

export const updateLeadSchema = createLeadSchema.partial().extend({
  assignedToId: z.string().optional(),
  qualifiedAt: z.string().datetime().optional(),
  convertedAt: z.string().datetime().optional(),
});

export const listLeadsQuerySchema = z.object({
  status: leadStatus.optional(),
  assignedToId: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;
