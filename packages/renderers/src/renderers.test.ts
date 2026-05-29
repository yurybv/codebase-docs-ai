import { describe, expect, it } from 'vitest';
import type { DocumentationTree } from '@codebase-docs-ai/shared';
import AdmZip from 'adm-zip';
import { renderJson } from './json-renderer.js';
import { findRenderedFile, renderMarkdownTree, renderSingleMarkdown } from './markdown-renderer.js';
import { renderZip } from './zip-renderer.js';

describe('markdown renderers', () => {
  it('renders a documentation tree as markdown files', () => {
    const rendered = renderMarkdownTree(documentationTreeFixture());

    expect(rendered.format).toBe('markdown-tree');
    expect(rendered.files.map((file) => file.path)).toEqual(['01-overview.md', '02-api.md']);
    expect(findRenderedFile(rendered, '01-overview.md')?.content).toContain('# Overview');
  });

  it('preserves sanitized rendered content in markdown tree files', () => {
    const rawOpenAiKey = `sk-${'n'.repeat(24)}`;
    const rendered = renderMarkdownTree({
      ...documentationTreeFixture(),
      pages: [
        {
          key: 'api-contracts',
          title: '06. API Contracts',
          order: 1,
          markdown: '# API Contracts\n\n| POST | /v1/[REDACTED_OPENAI_API_KEY] |',
          sourceReferences: [],
          warnings: []
        }
      ]
    });
    const content = findRenderedFile(rendered, '01-api-contracts.md')?.content ?? '';

    expect(content).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(content).not.toContain(rawOpenAiKey);
    expect(content).not.toContain('SHOULD_NOT_APPEAR');
    expect(content).not.toContain('.env');
  });

  it('renders a documentation tree as a single markdown file', () => {
    const rendered = renderSingleMarkdown(documentationTreeFixture());

    expect(rendered.files).toHaveLength(1);
    expect(rendered.files[0]?.path).toBe('PROJECT_DOCUMENTATION.md');
    expect(rendered.files[0]?.content).toContain('---');
  });

  it('preserves sanitized rendered content in single markdown files', () => {
    const rawOpenAiKey = `sk-${'m'.repeat(24)}`;
    const rendered = renderSingleMarkdown({
      ...documentationTreeFixture(),
      pages: [
        {
          key: 'api-contracts',
          title: '06. API Contracts',
          order: 1,
          markdown: '# API Contracts\n\n| POST | /v1/[REDACTED_OPENAI_API_KEY] |',
          sourceReferences: [],
          warnings: []
        }
      ]
    });
    const content = rendered.files[0]?.content ?? '';

    expect(content).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(content).not.toContain(rawOpenAiKey);
    expect(content).not.toContain('SHOULD_NOT_APPEAR');
    expect(content).not.toContain('.env');
  });
});

describe('json renderer', () => {
  it('renders a documentation tree as JSON', () => {
    const rendered = renderJson(documentationTreeFixture());

    expect(rendered.files[0]?.path).toBe('documentation-tree.json');
    expect(JSON.parse(rendered.files[0]?.content ?? '{}')).toMatchObject({
      title: 'Docs'
    });
  });

  it('preserves sanitized rendered content in JSON files', () => {
    const rawOpenAiKey = `sk-${'l'.repeat(24)}`;
    const rendered = renderJson({
      ...documentationTreeFixture(),
      pages: [
        {
          key: 'api-contracts',
          title: '06. API Contracts',
          order: 1,
          markdown: '# API Contracts\n\n| POST | /v1/[REDACTED_OPENAI_API_KEY] |',
          sourceReferences: [],
          warnings: []
        }
      ],
      warnings: [
        {
          level: 'medium',
          message: 'A source reference contained [REDACTED_OPENAI_API_KEY].'
        }
      ]
    });
    const content = rendered.files[0]?.content ?? '';

    expect(JSON.parse(content)).toMatchObject({
      title: 'Docs'
    });
    expect(content).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(content).not.toContain(rawOpenAiKey);
    expect(content).not.toContain('SHOULD_NOT_APPEAR');
    expect(content).not.toContain('.env');
  });
});

describe('zip renderer', () => {
  it('packages rendered files into a zip buffer', () => {
    const zip = renderZip(renderMarkdownTree(documentationTreeFixture()));

    expect(Buffer.isBuffer(zip)).toBe(true);
    expect(zip.byteLength).toBeGreaterThan(0);
  });

  it('preserves sanitized rendered content in zip files', () => {
    const rawOpenAiKey = `sk-${'k'.repeat(24)}`;
    const zip = new AdmZip(
      renderZip(
        renderMarkdownTree({
          ...documentationTreeFixture(),
          pages: [
            {
              key: 'api-contracts',
              title: '06. API Contracts',
              order: 1,
              markdown: '# API Contracts\n\n| POST | /v1/[REDACTED_OPENAI_API_KEY] |',
              sourceReferences: [],
              warnings: []
            }
          ]
        })
      )
    );
    const zipContent = zip
      .getEntries()
      .filter((entry) => !entry.isDirectory)
      .map((entry) => entry.getData().toString('utf8'))
      .join('\n');

    expect(zipContent).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(zipContent).not.toContain(rawOpenAiKey);
    expect(zipContent).not.toContain('SHOULD_NOT_APPEAR');
    expect(zipContent).not.toContain('.env');
  });
});

function documentationTreeFixture(): DocumentationTree {
  return {
    title: 'Docs',
    summary: 'Summary',
    pages: [
      {
        key: 'api',
        title: '02. API',
        order: 2,
        markdown: '# API',
        sourceReferences: [],
        warnings: []
      },
      {
        key: 'overview',
        title: '01. Overview',
        order: 1,
        markdown: '# Overview',
        sourceReferences: [],
        warnings: []
      }
    ],
    warnings: [],
    sourceReferences: [],
    generatedAt: '2026-05-29T00:00:00.000Z'
  };
}
