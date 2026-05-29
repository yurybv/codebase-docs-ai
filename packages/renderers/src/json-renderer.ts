import type { DocumentationTree, RenderedDocumentation } from '@codebase-docs-ai/shared';

export function renderJson(documentationTree: DocumentationTree): RenderedDocumentation {
  return {
    format: 'json',
    files: [
      {
        path: 'documentation-tree.json',
        content: `${JSON.stringify(documentationTree, null, 2)}\n`,
        mediaType: 'application/json'
      }
    ]
  };
}
