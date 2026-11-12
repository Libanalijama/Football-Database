import { z } from 'zod';
import { graphicSchema } from '@/lib/graphics/schema';

export const episodeItemSchema = z.object({
  id: z.string().min(1).max(160),
  title: z.string().max(200),
  graphic: graphicSchema,
  subjectIds: z.array(z.string().max(160)).max(20).default([]),
  sourceScope: z.record(z.string(), z.unknown()).default({}),
  sourceSnapshot: z.record(z.string(), z.unknown()).default({}),
  overrides: z.record(z.string(), z.unknown()).default({}),
  mediaIds: z.array(z.string().max(160)).max(100).default([]),
});
export const episodeSchema = z.object({
  schemaVersion: z.literal(1), id: z.string(), name: z.string().min(1).max(200), version: z.number().int().positive(),
  archived: z.boolean(), items: z.array(episodeItemSchema).max(250),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});
export type EpisodeItem = z.infer<typeof episodeItemSchema>;
export type Episode = z.infer<typeof episodeSchema>;
export const episodeUpdateSchema = z.object({ expectedVersion: z.number().int().positive(), name: z.string().min(1).max(200).optional(), archived: z.boolean().optional(), items: z.array(episodeItemSchema).max(250).optional() });
export const programMutationSchema = z.object({ action: z.enum(['take', 'clear', 'freeze', 'unfreeze']), expectedVersion: z.number().int().nonnegative(), graphic: graphicSchema.optional() });
export const programSchema = z.object({ version: z.number().int().nonnegative(), graphic: graphicSchema.nullable(), frozen: z.boolean(), updatedAt: z.string() });
export type ProgramState = z.infer<typeof programSchema>;
export const assetMetadataSchema = z.object({ origin: z.string().max(1000).default('Manual upload'), attribution: z.string().max(1000).default(''), rights: z.string().max(1000).default('Usage rights require production review') });
