import { CodebaseDocsAIClient } from '@codebase-docs-ai/sdk';
import type { DocumentationRunSummary } from '@codebase-docs-ai/shared';
import type { ListRunsCommandOptions } from './cli-options.js';

export interface ListRunsCommandResult {
  status: 'completed';
  runCount: number;
  runs: DocumentationRunSummary[];
  nextCursor?: string;
}

export async function runListRunsCommand(
  options: ListRunsCommandOptions
): Promise<ListRunsCommandResult> {
  const client = new CodebaseDocsAIClient({
    apiBaseUrl: options.apiUrl
  });
  const listOptions = {
    ...(options.limit === undefined ? {} : { limit: options.limit }),
    ...(options.status === undefined ? {} : { status: options.status }),
    ...(options.role === undefined ? {} : { role: options.role }),
    ...(options.name === undefined ? {} : { name: options.name }),
    ...(options.format === undefined ? {} : { format: options.format }),
    ...(options.minSources === undefined ? {} : { minSources: options.minSources }),
    ...(options.maxSources === undefined ? {} : { maxSources: options.maxSources }),
    ...(options.sort === undefined ? {} : { sort: options.sort }),
    ...(options.createdAfter === undefined ? {} : { createdAfter: options.createdAfter }),
    ...(options.createdBefore === undefined ? {} : { createdBefore: options.createdBefore }),
    ...(options.updatedAfter === undefined ? {} : { updatedAfter: options.updatedAfter }),
    ...(options.updatedBefore === undefined ? {} : { updatedBefore: options.updatedBefore }),
    ...(options.cursor === undefined ? {} : { cursor: options.cursor })
  };
  const list = await client.documentationRuns.list(
    Object.keys(listOptions).length === 0 ? undefined : listOptions
  );

  return {
    status: 'completed',
    runCount: list.runs.length,
    runs: list.runs,
    ...(list.nextCursor ? { nextCursor: list.nextCursor } : {})
  };
}
