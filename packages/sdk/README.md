# @codebase-docs-ai/sdk

TypeScript SDK for the `codebase-docs-ai` HTTP API.

## Usage

```ts
import { CodebaseDocsAIClient } from '@codebase-docs-ai/sdk';

const client = new CodebaseDocsAIClient({
  apiBaseUrl: 'http://localhost:3000'
});

const file = new Blob([archiveBytes]);

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
      file
    }
  ],
  downloadFormat: 'single-markdown'
});

console.log(result.result.renderedFormats);
```

The SDK expects runtime support for `fetch`, `FormData`, and `Blob`. Node.js `>=20.10.0` provides these APIs.

Full contract documentation: [SDK Contract](../../docs/SDK_CONTRACT.md).
