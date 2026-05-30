import { CodebaseDocsAIClient } from '@codebase-docs-ai/sdk';
import type { DocumentationRunSummary } from '@codebase-docs-ai/shared';
import type { ListRunsCommandOptions } from './cli-options.js';

export interface ListRunsCommandResult {
  status: 'completed';
  runCount: number;
  runs: DocumentationRunSummary[];
}

export async function runListRunsCommand(
  options: ListRunsCommandOptions
): Promise<ListRunsCommandResult> {
  const client = new CodebaseDocsAIClient({
    apiBaseUrl: options.apiUrl
  });
  const list = await client.documentationRuns.list();

  return {
    status: 'completed',
    runCount: list.runs.length,
    runs: list.runs
  };
}
