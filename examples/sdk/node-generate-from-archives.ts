import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CodebaseDocsAIClient } from '@codebase-docs-ai/sdk';

const apiBaseUrl = process.env.CODEBASE_DOCS_AI_API_URL ?? 'http://localhost:3000';
const outputPath = process.env.CODEBASE_DOCS_AI_OUTPUT_PATH ?? './generated-docs';

const client = new CodebaseDocsAIClient({
  apiBaseUrl
});

const frontendArchive = new Blob([await readFile('./frontend.zip')]);
const backendArchive = new Blob([await readFile('./backend.zip')]);

const result = await client.documentationRuns.generateFromArchives({
  name: 'Generated Project Documentation',
  options: {
    outputFormats: ['single-markdown'],
    language: 'en',
    includeSourceReferences: true,
    includeWarnings: true
  },
  sources: [
    {
      name: 'Frontend',
      role: 'frontend',
      fileName: 'frontend.zip',
      file: frontendArchive
    },
    {
      name: 'Backend',
      role: 'backend',
      fileName: 'backend.zip',
      file: backendArchive
    }
  ],
  poll: {
    intervalMs: 1000,
    timeoutMs: 120000
  },
  downloadFormat: 'single-markdown'
});

if (result.download) {
  await mkdir(outputPath, {
    recursive: true
  });
  await writeFile(
    path.join(outputPath, result.download.fileName ?? 'PROJECT_DOCUMENTATION.md'),
    Buffer.from(await result.download.content.arrayBuffer())
  );
}

console.log(
  JSON.stringify(
    {
      runId: result.run.id,
      status: result.run.status,
      pages: result.result.documentation.pages.length
    },
    null,
    2
  )
);
