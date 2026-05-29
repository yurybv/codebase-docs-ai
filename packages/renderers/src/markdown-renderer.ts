import type {
  DocumentationTree,
  RenderedDocumentation,
  RenderedDocumentationFile
} from '@codebase-docs-ai/shared';

export function renderMarkdownTree(documentationTree: DocumentationTree): RenderedDocumentation {
  return {
    format: 'markdown-tree',
    files: documentationTree.pages
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((page) => ({
        path: `${String(page.order).padStart(2, '0')}-${slugify(page.key)}.md`,
        content: ensureTrailingNewline(page.markdown),
        mediaType: 'text/markdown'
      }))
  };
}

export function renderSingleMarkdown(documentationTree: DocumentationTree): RenderedDocumentation {
  const content = documentationTree.pages
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((page) => page.markdown.trim())
    .join('\n\n---\n\n');

  return {
    format: 'single-markdown',
    files: [
      {
        path: 'PROJECT_DOCUMENTATION.md',
        content: ensureTrailingNewline(content),
        mediaType: 'text/markdown'
      }
    ]
  };
}

export function findRenderedFile(
  renderedDocumentation: RenderedDocumentation,
  path: string
): RenderedDocumentationFile | undefined {
  return renderedDocumentation.files.find((file) => file.path === path);
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith('\n') ? value : `${value}\n`;
}
