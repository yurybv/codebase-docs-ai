import path from 'node:path';
import { documentationOutputFormatSchema, sourceRoleSchema } from '@codebase-docs-ai/shared';
import type { DocumentationOutputFormat, SourceInputMetadata, SourceRole } from '@codebase-docs-ai/shared';

export type CliOutputFormat = DocumentationOutputFormat | 'zip';

export interface CliSourceInput {
  inputPath: string;
  metadata: SourceInputMetadata;
}

export interface GenerateCommandOptions {
  source: string[];
  output: string;
  format: CliOutputFormat;
  name: string;
  apiUrl?: string;
}

export function collectRepeatedOption(value: string, previous: string[]): string[] {
  return [...previous, value];
}

export function parseGenerateOptions(options: {
  source?: string[];
  output?: string;
  format?: string;
  name?: string;
  apiUrl?: string;
}): GenerateCommandOptions {
  const sources = options.source ?? [];
  if (sources.length === 0) {
    throw new Error('At least one --source path:role input is required.');
  }

  const parsedOptions: GenerateCommandOptions = {
    source: sources,
    output: options.output ?? './generated-docs',
    format: parseCliOutputFormat(options.format ?? 'markdown-tree'),
    name: options.name ?? 'Generated Project Documentation'
  };
  if (options.apiUrl) {
    parsedOptions.apiUrl = options.apiUrl;
  }

  return parsedOptions;
}

export function parseCliSourceInput(value: string): CliSourceInput {
  const delimiterIndex = value.lastIndexOf(':');
  if (delimiterIndex <= 0 || delimiterIndex === value.length - 1) {
    throw new Error(`Invalid source "${value}". Expected path:role.`);
  }

  const inputPath = value.slice(0, delimiterIndex);
  const role = parseSourceRole(value.slice(delimiterIndex + 1));

  return {
    inputPath,
    metadata: {
      name: sourceNameFromPath(inputPath),
      role
    }
  };
}

export function parseCliOutputFormat(value: string): CliOutputFormat {
  if (value === 'zip') {
    return value;
  }

  const parsed = documentationOutputFormatSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Unsupported output format "${value}". Use markdown-tree, single-markdown, json, or zip.`);
  }

  return parsed.data;
}

function parseSourceRole(value: string): SourceRole {
  const parsed = sourceRoleSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Unsupported source role "${value}".`);
  }

  return parsed.data;
}

function sourceNameFromPath(inputPath: string): string {
  const baseName = path.basename(inputPath);
  return baseName.replace(/(\.tar\.gz|\.tgz|\.zip|\.tar)$/i, '') || 'source';
}
