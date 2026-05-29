import { CodebaseDocsAIClient } from '@codebase-docs-ai/sdk';

export async function generateDocumentationFromBrowserFile(input: {
  apiBaseUrl: string;
  file: File;
}): Promise<Blob | undefined> {
  const client = new CodebaseDocsAIClient({
    apiBaseUrl: input.apiBaseUrl
  });

  const result = await client.documentationRuns.generateFromArchives({
    name: 'Generated Browser Upload Documentation',
    options: {
      outputFormats: ['single-markdown'],
      language: 'en',
      includeSourceReferences: true,
      includeWarnings: true
    },
    sources: [
      {
        name: input.file.name.replace(/\.(zip|tar|tgz|tar\.gz)$/i, '') || 'Source',
        role: 'unknown',
        fileName: input.file.name,
        file: input.file
      }
    ],
    downloadFormat: 'single-markdown'
  });

  return result.download?.content;
}
