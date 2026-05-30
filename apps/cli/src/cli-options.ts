import path from 'node:path';
import {
  documentationOutputFormatSchema,
  maxDocumentationRunListLimit,
  sourceRoleSchema,
  stripSupportedSourceArchiveExtension
} from '@codebase-docs-ai/shared';
import type {
  DocumentationOutputFormat,
  DocumentationRunStatus,
  SourceInputMetadata,
  SourceRole
} from '@codebase-docs-ai/shared';
import { CliError } from './cli-error.js';

export type CliOutputFormat = DocumentationOutputFormat | 'zip';
export type RunListSort =
  | 'updatedAt:desc'
  | 'updatedAt:asc'
  | 'createdAt:desc'
  | 'createdAt:asc'
  | 'completedAt:desc'
  | 'completedAt:asc';

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

export interface ListRunsCommandOptions {
  apiUrl: string;
  limit?: number;
  status?: DocumentationRunStatus;
  role?: SourceRole;
  name?: string;
  format?: DocumentationOutputFormat;
  minSources?: number;
  maxSources?: number;
  sort?: RunListSort;
  createdAfter?: string;
  createdBefore?: string;
  completedAfter?: string;
  completedBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
  cursor?: string;
}

const cliRunListStatusOptions: DocumentationRunStatus[] = [
  'created',
  'uploading_sources',
  'ready',
  'running',
  'extracting_sources',
  'analyzing_sources',
  'building_system_map',
  'generating_documentation',
  'rendering_output',
  'completed',
  'failed',
  'cancelled',
  'expired'
];
const maxRunListCursorLength = 512;
const maxRunListNameLength = 200;
const runListSortOptions: RunListSort[] = [
  'updatedAt:desc',
  'updatedAt:asc',
  'createdAt:desc',
  'createdAt:asc',
  'completedAt:desc',
  'completedAt:asc'
];
const runListIsoTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

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
    throw new CliError('CLI_SOURCE_REQUIRED', 'At least one --source path:role input is required.');
  }

  const parsedOptions: GenerateCommandOptions = {
    source: sources,
    output: options.output ?? './generated-docs',
    format: parseCliOutputFormat(options.format ?? 'markdown-tree'),
    name: options.name ?? 'Generated Project Documentation'
  };
  if (options.apiUrl) {
    assertHttpUrl(options.apiUrl);
    parsedOptions.apiUrl = options.apiUrl;
  }

  return parsedOptions;
}

export function parseListRunsOptions(options: {
  apiUrl?: string;
  limit?: string;
  status?: string;
  role?: string;
  name?: string;
  format?: string;
  minSources?: string;
  maxSources?: string;
  sort?: string;
  createdAfter?: string;
  createdBefore?: string;
  completedAfter?: string;
  completedBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
  cursor?: string;
}): ListRunsCommandOptions {
  if (!options.apiUrl) {
    throw new CliError(
      'CLI_API_URL_REQUIRED',
      'API URL is required for listing remote documentation runs.'
    );
  }

  assertHttpUrl(options.apiUrl);
  const limit = parseRunListLimit(options.limit);
  const status = parseRunListStatus(options.status);
  const role = parseRunListSourceRole(options.role);
  const name = parseRunListName(options.name);
  const format = parseRunListFormat(options.format);
  const sourceCountRange = parseRunListSourceCountRange(options.minSources, options.maxSources);
  const sort = parseRunListSort(options.sort);
  const createdAfter = parseRunListCreatedAfter(options.createdAfter);
  const createdBefore = parseRunListCreatedBefore(options.createdBefore);
  const completedAfter = parseRunListCompletedAfter(options.completedAfter);
  const completedBefore = parseRunListCompletedBefore(options.completedBefore);
  const updatedAfter = parseRunListUpdatedAfter(options.updatedAfter);
  const updatedBefore = parseRunListUpdatedBefore(options.updatedBefore);
  const cursor = parseRunListCursor(options.cursor);
  return {
    apiUrl: options.apiUrl,
    ...(limit === undefined ? {} : { limit }),
    ...(status === undefined ? {} : { status }),
    ...(role === undefined ? {} : { role }),
    ...(name === undefined ? {} : { name }),
    ...(format === undefined ? {} : { format }),
    ...(sourceCountRange.minSources === undefined ? {} : { minSources: sourceCountRange.minSources }),
    ...(sourceCountRange.maxSources === undefined ? {} : { maxSources: sourceCountRange.maxSources }),
    ...(sort === undefined ? {} : { sort }),
    ...(createdAfter === undefined ? {} : { createdAfter }),
    ...(createdBefore === undefined ? {} : { createdBefore }),
    ...(completedAfter === undefined ? {} : { completedAfter }),
    ...(completedBefore === undefined ? {} : { completedBefore }),
    ...(updatedAfter === undefined ? {} : { updatedAfter }),
    ...(updatedBefore === undefined ? {} : { updatedBefore }),
    ...(cursor === undefined ? {} : { cursor })
  };
}

export function parseCliSourceInput(value: string): CliSourceInput {
  const delimiterIndex = value.lastIndexOf(':');
  if (delimiterIndex <= 0 || delimiterIndex === value.length - 1) {
    throw new CliError('CLI_SOURCE_INVALID', `Invalid source "${value}". Expected path:role.`);
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
    throw new CliError(
      'CLI_FORMAT_UNSUPPORTED',
      `Unsupported output format "${value}". Use markdown-tree, single-markdown, json, or zip.`
    );
  }

  return parsed.data;
}

function parseSourceRole(value: string): SourceRole {
  const parsed = sourceRoleSchema.safeParse(value);
  if (!parsed.success) {
    throw new CliError('CLI_SOURCE_ROLE_UNSUPPORTED', `Unsupported source role "${value}".`);
  }

  return parsed.data;
}

function parseRunListLimit(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (
    !Number.isInteger(parsed) ||
    String(parsed) !== value ||
    parsed < 1 ||
    parsed > maxDocumentationRunListLimit
  ) {
    throw new CliError(
      'CLI_RUN_LIST_LIMIT_INVALID',
      `Run list limit must be an integer between 1 and ${maxDocumentationRunListLimit}.`,
      2,
      {
        min: 1,
        max: maxDocumentationRunListLimit
      }
    );
  }

  return parsed;
}

function parseRunListStatus(value: string | undefined): DocumentationRunStatus | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!cliRunListStatusOptions.includes(value as DocumentationRunStatus)) {
    throw new CliError(
      'CLI_RUN_LIST_STATUS_INVALID',
      'Run list status must be a supported documentation run status.',
      2,
      {
        allowedStatuses: [...cliRunListStatusOptions]
      }
    );
  }

  return value as DocumentationRunStatus;
}

function parseRunListSourceRole(value: string | undefined): SourceRole | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = sourceRoleSchema.safeParse(value);
  if (!parsed.success) {
    throw new CliError(
      'CLI_RUN_LIST_SOURCE_ROLE_INVALID',
      'Run list source role must be a supported source role.',
      2,
      {
        allowedRoles: [...sourceRoleSchema.options]
      }
    );
  }

  return parsed.data;
}

function parseRunListCursor(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value.length === 0 || value.length > maxRunListCursorLength) {
    throw new CliError('CLI_RUN_LIST_CURSOR_INVALID', 'Run list cursor is invalid.', 2);
  }

  return value;
}

function parseRunListName(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const name = value.trim();
  if (name.length === 0 || name.length > maxRunListNameLength) {
    throw new CliError(
      'CLI_RUN_LIST_NAME_INVALID',
      `Run list name filter must be between 1 and ${maxRunListNameLength} characters.`,
      2
    );
  }

  return name;
}

function parseRunListFormat(value: string | undefined): DocumentationOutputFormat | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = documentationOutputFormatSchema.safeParse(value);
  if (!parsed.success) {
    throw new CliError(
      'CLI_RUN_LIST_FORMAT_INVALID',
      'Run list format must be a supported documentation output format.',
      2,
      {
        allowedFormats: [...documentationOutputFormatSchema.options]
      }
    );
  }

  return parsed.data;
}

function parseRunListSourceCountRange(
  minSourcesValue: string | undefined,
  maxSourcesValue: string | undefined
): { minSources?: number; maxSources?: number } {
  const minSources = parseRunListSourceCount(minSourcesValue);
  const maxSources = parseRunListSourceCount(maxSourcesValue);

  if (minSources !== undefined && maxSources !== undefined && minSources > maxSources) {
    throw invalidRunListSourceCount();
  }

  return {
    ...(minSources === undefined ? {} : { minSources }),
    ...(maxSources === undefined ? {} : { maxSources })
  };
}

function parseRunListSourceCount(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || String(parsed) !== value || parsed < 0) {
    throw invalidRunListSourceCount();
  }

  return parsed;
}

function invalidRunListSourceCount(): CliError {
  return new CliError(
    'CLI_RUN_LIST_SOURCE_COUNT_INVALID',
    'Run list source count filters must be non-negative integers, and minSources must not exceed maxSources.',
    2,
    {
      min: 0
    }
  );
}

function parseRunListSort(value: string | undefined): RunListSort | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!runListSortOptions.includes(value as RunListSort)) {
    throw new CliError(
      'CLI_RUN_LIST_SORT_INVALID',
      'Run list sort must be a supported sort option.',
      2,
      {
        allowedSorts: [...runListSortOptions]
      }
    );
  }

  return value as RunListSort;
}

function parseRunListCreatedAfter(value: string | undefined): string | undefined {
  return parseRunListTimestamp(
    value,
    'CLI_RUN_LIST_CREATED_AFTER_INVALID',
    'Run list createdAfter must be a valid ISO timestamp.'
  );
}

function parseRunListCreatedBefore(value: string | undefined): string | undefined {
  return parseRunListTimestamp(
    value,
    'CLI_RUN_LIST_CREATED_BEFORE_INVALID',
    'Run list createdBefore must be a valid ISO timestamp.'
  );
}

function parseRunListCompletedAfter(value: string | undefined): string | undefined {
  return parseRunListTimestamp(
    value,
    'CLI_RUN_LIST_COMPLETED_AFTER_INVALID',
    'Run list completedAfter must be a valid ISO timestamp.'
  );
}

function parseRunListCompletedBefore(value: string | undefined): string | undefined {
  return parseRunListTimestamp(
    value,
    'CLI_RUN_LIST_COMPLETED_BEFORE_INVALID',
    'Run list completedBefore must be a valid ISO timestamp.'
  );
}

function parseRunListUpdatedAfter(value: string | undefined): string | undefined {
  return parseRunListTimestamp(
    value,
    'CLI_RUN_LIST_UPDATED_AFTER_INVALID',
    'Run list updatedAfter must be a valid ISO timestamp.'
  );
}

function parseRunListUpdatedBefore(value: string | undefined): string | undefined {
  return parseRunListTimestamp(
    value,
    'CLI_RUN_LIST_UPDATED_BEFORE_INVALID',
    'Run list updatedBefore must be a valid ISO timestamp.'
  );
}

function parseRunListTimestamp(
  value: string | undefined,
  code: string,
  message: string
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!runListIsoTimestampPattern.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new CliError(code, message, 2);
  }

  return value;
}

function sourceNameFromPath(inputPath: string): string {
  const baseName = path.basename(inputPath);
  return stripSupportedSourceArchiveExtension(baseName) || 'source';
}

function assertHttpUrl(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new CliError('CLI_API_URL_INVALID', `Invalid API URL "${value}".`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new CliError('CLI_API_URL_INVALID', 'API URL must use http or https.');
  }
}
