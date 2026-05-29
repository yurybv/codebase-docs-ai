import { z } from 'zod';

export const sourceRoleSchema = z.enum([
  'frontend',
  'backend',
  'shared',
  'infra',
  'mobile',
  'docs',
  'unknown'
]);

export const documentationOutputFormatSchema = z.enum([
  'markdown-tree',
  'single-markdown',
  'json'
]);

export const sourceInputMetadataSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  role: sourceRoleSchema,
  metadata: z.record(z.unknown()).optional()
});

export const documentationRunOptionsSchema = z.object({
  outputFormats: z.array(documentationOutputFormatSchema).min(1),
  language: z.literal('en').default('en'),
  includeSourceReferences: z.boolean().default(true),
  includeWarnings: z.boolean().default(true)
});

export const createDocumentationRunSchema = z.object({
  name: z.string().min(1),
  options: documentationRunOptionsSchema
});
