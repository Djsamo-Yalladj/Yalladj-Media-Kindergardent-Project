// Zod schemas for Nursery endpoints. Mirrors prisma/schema.prisma Nursery model.
// Create: name + slug required; everything else optional.
// Update: all fields optional.

import { z } from 'zod';
import { packageType } from './lead.js';

const brandColorsSchema = z
  .object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
    accent: z.string().optional(),
  })
  .passthrough();

const brandFontsSchema = z.record(z.string(), z.unknown());
const descriptionSchema = z.object({
  en: z.string().optional(),
  ar: z.string().optional(),
});

// slug: lowercase, alphanumeric + hyphens
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createNurserySchema = z.object({
  name: z.string().min(1).max(200),
  nameAr: z.string().max(200).optional(),
  slug: z.string().min(1).max(200).regex(slugRegex, 'slug must be lowercase-with-hyphens'),
  logoUrl: z.string().url().max(500).optional(),
  email: z.string().email().max(320).optional(),
  phone: z.string().max(50).optional(),
  whatsapp: z.string().max(50).optional(),
  country: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  website: z.string().url().max(500).optional(),
  instagram: z.string().max(200).optional(),
  facebook: z.string().max(200).optional(),
  tiktok: z.string().max(200).optional(),
  contactName: z.string().max(200).optional(),
  contactRole: z.string().max(100).optional(),
  packageType: packageType.optional(),
  contractValue: z.number().positive().optional(),
  brandColors: brandColorsSchema.optional(),
  brandFonts: brandFontsSchema.optional(),
  description: descriptionSchema.optional(),
  tags: z.array(z.string().max(50)).max(50).optional(),
  isActive: z.boolean().optional(),
  onboardedAt: z.string().datetime().optional(),
});

export const updateNurserySchema = createNurserySchema.partial();

export const listNurseriesQuerySchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  packageType: packageType.optional(),
  search: z.string().optional(),
  tag: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateNurseryInput = z.infer<typeof createNurserySchema>;
export type UpdateNurseryInput = z.infer<typeof updateNurserySchema>;
export type ListNurseriesQuery = z.infer<typeof listNurseriesQuerySchema>;
