import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CodebaseDocsAIClient } from '@codebase-docs-ai/sdk';

const client = new CodebaseDocsAIClient({
  apiBaseUrl: process.env.CODEBASE_DOCS_AI_API_URL ?? 'http://localhost:3000'
});

const created = await client.documentationRuns.create({
  name: 'Custom Polling Documentation',
  options: {
    outputFormats: ['markdown-tree'],
    language: 'en',
    includeSourceReferences: true,
    includeWarnings: true
  }
});

await client.documentationRuns.uploadSources(created.runId, [
  {
    name: 'Backend',
    role: 'backend',
    fileName: 'backend.zip',
    file: new Blob([await readFile('./backend.zip')])
  }
]);

await client.documentationRuns.start(created.runId);

let status = 'running';
while (status !== 'completed') {
  const run = await client.documentationRuns.get(created.runId);
  status = run.status;

  if (run.status === 'failed' || run.status === 'cancelled' || run.status === 'expired') {
    throw new Error(run.error?.message ?? `Run ended with status ${run.status}.`);
  }

  await delay(1000);
}

const download = await client.documentationRuns.download({
  runId: created.runId,
  format: 'markdown-tree'
});

await mkdir('./generated-docs', {
  recursive: true
});
await writeFile(
  path.join('./generated-docs', download.fileName ?? 'documentation.zip'),
  Buffer.from(await download.content.arrayBuffer())
);

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
