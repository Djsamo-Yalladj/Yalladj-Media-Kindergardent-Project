// Zod schemas for Ticket + ServiceContract + Handover endpoints.
// Mirrors prisma/schema.prisma Ticket, ServiceContract, Handover models.

import { z } from 'zod';

export const ticketTypeEnum = z.enum(['bug', 'content_update', 'support', 'feature_request']);
export const ticketPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);
export const ticketStatusEnum = z.enum([
  'open',
  'in_progress',
  'waiting_client',
  'resolved',
  'closed',
]);

export const contractStatusEnum = z.enum(['active', 'paused', 'expired', 'cancelled']);

export const handoverTypeEnum = z.enum([
  'code_handover',
  'asset_bundle',
  'final_delivery',
  'archive',
]);

// ============================================================
// TICKETS
// ============================================================

export const createTicketSchema = z.object({
  nurseryId: z.string().min(1),
  projectId: z.string().optional(),
  title: z.string().min(1).max(300),
  description: z.string().min(1).max(20000),
  type: ticketTypeEnum,
  priority: ticketPriorityEnum.optional(),
  status: ticketStatusEnum.optional(),
  assignedToId: z.string().optional(),
  reportedById: z.string().optional(),
  reportedEmail: z.string().email().max(320).optional(),
  dueAt: z.string().datetime().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const updateTicketSchema = createTicketSchema.partial().extend({
  resolvedAt: z.string().datetime().nullable().optional(),
  closedAt: z.string().datetime().nullable().optional(),
  resolutionNote: z.string().max(10000).optional(),
});

export const listTicketsQuerySchema = z.object({
  nurseryId: z.string().optional(),
  projectId: z.string().optional(),
  status: ticketStatusEnum.optional(),
  priority: ticketPriorityEnum.optional(),
  type: ticketTypeEnum.optional(),
  assignedToId: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;

// ============================================================
// SERVICE CONTRACTS
// ============================================================

export const createServiceContractSchema = z.object({
  nurseryId: z.string().min(1),
  projectId: z.string().optional(),
  contractTypeId: z.string().min(1),
  title: z.string().min(1).max(300),
  amount: z.number().positive(),
  billingCycle: z.string().max(50).optional(),
  status: contractStatusEnum.optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  renewsAt: z.string().datetime().optional(),
  autoRenew: z.boolean().optional(),
  terms: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().max(10000).optional(),
});

export const updateServiceContractSchema = createServiceContractSchema.partial().extend({
  cancelledAt: z.string().datetime().nullable().optional(),
  cancelReason: z.string().max(2000).optional(),
});

export const listServiceContractsQuerySchema = z.object({
  nurseryId: z.string().optional(),
  projectId: z.string().optional(),
  contractTypeId: z.string().optional(),
  status: contractStatusEnum.optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateServiceContractInput = z.infer<typeof createServiceContractSchema>;
export type UpdateServiceContractInput = z.infer<typeof updateServiceContractSchema>;
export type ListServiceContractsQuery = z.infer<typeof listServiceContractsQuerySchema>;

// ============================================================
// HANDOVERS
// ============================================================

export const createHandoverSchema = z.object({
  nurseryId: z.string().min(1),
  projectId: z.string().optional(),
  type: handoverTypeEnum,
  title: z.string().min(1).max(300),
  description: z.string().max(10000).optional(),
  archiveUrl: z.string().url().max(1000).optional(),
  manifest: z.record(z.string(), z.unknown()).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  deliveredAt: z.string().datetime().optional(),
  deliveredToEmail: z.string().email().max(320).optional(),
});

export const updateHandoverSchema = createHandoverSchema.partial().extend({
  acknowledgedAt: z.string().datetime().nullable().optional(),
});

export const listHandoversQuerySchema = z.object({
  nurseryId: z.string().optional(),
  projectId: z.string().optional(),
  type: handoverTypeEnum.optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateHandoverInput = z.infer<typeof createHandoverSchema>;
export type UpdateHandoverInput = z.infer<typeof updateHandoverSchema>;
export type ListHandoversQuery = z.infer<typeof listHandoversQuerySchema>;
