import { CodebaseDocsAIClient, CodebaseDocsAIClientError } from '@codebase-docs-ai/sdk';

const client = new CodebaseDocsAIClient({
  apiBaseUrl: process.env.CODEBASE_DOCS_AI_API_URL ?? 'http://localhost:3000'
});

try {
  await client.documentationRuns.getResult('run_missing');
} catch (error) {
  if (error instanceof CodebaseDocsAIClientError) {
    console.error(
      JSON.stringify(
        {
          status: error.status,
          code: error.code,
          message: error.message,
          details: error.details
        },
        null,
        2
      )
    );
  } else {
    throw error;
  }
}
