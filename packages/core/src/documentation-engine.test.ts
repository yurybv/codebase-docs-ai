import { describe, expect, it } from 'vitest';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DocumentationEngine } from './documentation-engine.js';
import type { LoadedSource, SourceFile, SourceInputMetadata } from '@codebase-docs-ai/shared';

describe('DocumentationEngine', () => {
  it('creates a run plan from source metadata', () => {
    const engine = new DocumentationEngine();
    const plan = engine.createRunPlan({
      name: 'Customer Portal',
      sources: [
        {
          name: 'Frontend',
          role: 'frontend'
        },
        {
          name: 'Backend',
          role: 'backend'
        }
      ],
      options: {
        outputFormats: ['markdown-tree', 'json'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });

    expect(plan).toEqual({
      name: 'Customer Portal',
      sourceCount: 2,
      sourceRoles: ['frontend', 'backend'],
      outputFormats: ['markdown-tree', 'json']
    });
  });

  it('generates documentation and rendered artifacts from loaded sources', async () => {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'core-engine-test-'));

    try {
      await writeFile(
        path.join(fixtureRoot, 'package.json'),
        JSON.stringify({
          dependencies: {
            react: 'latest'
          }
        })
      );
      await writeFile(path.join(fixtureRoot, 'app.tsx'), 'fetch("/api/users");\n');

      const engine = new DocumentationEngine();
      const result = await engine.generateDocumentation({
        title: 'Core Engine Test',
        loadedSources: [
          await loadedSourceFixture(fixtureRoot, {
            name: 'Frontend',
            role: 'frontend'
          })
        ],
        options: {
          outputFormats: ['markdown-tree', 'json'],
          language: 'en',
          includeSourceReferences: true,
          includeWarnings: true
        }
      });

      expect(result.repositoryMaps).toHaveLength(1);
      expect(result.systemMap.sources).toHaveLength(1);
      expect(result.documentationTree.pages.length).toBeGreaterThan(0);
      expect(result.rendered.get('markdown-tree')?.files.length).toBeGreaterThan(0);
      expect(result.rendered.get('json')?.files[0]?.path).toBe('documentation-tree.json');
    } finally {
      await rm(fixtureRoot, {
        recursive: true,
        force: true
      });
    }
  });
});

async function loadedSourceFixture(rootPath: string, source: SourceInputMetadata): Promise<LoadedSource> {
  const files = await Promise.all([
    sourceFile(rootPath, 'package.json'),
    sourceFile(rootPath, 'app.tsx')
  ]);

  return {
    source,
    rootPath,
    files,
    skippedFiles: [],
    totalSizeBytes: files.reduce((total, file) => total + file.sizeBytes, 0)
  };
}

async function sourceFile(rootPath: string, relativePath: string): Promise<SourceFile> {
  const absolutePath = path.join(rootPath, relativePath);
  const fileStat = await stat(absolutePath);

  return {
    path: relativePath,
    absolutePath,
    sizeBytes: fileStat.size,
    extension: path.extname(relativePath)
  };
}
