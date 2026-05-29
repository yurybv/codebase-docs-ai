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

  it('uses filtered and redacted source content for repository analysis', async () => {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'core-engine-sanitized-test-'));
    const rawOpenAiKey = `sk-${'a'.repeat(24)}`;

    try {
      await writeFile(
        path.join(fixtureRoot, 'package.json'),
        JSON.stringify({
          dependencies: {
            react: 'latest'
          }
        })
      );
      await writeFile(
        path.join(fixtureRoot, 'api.ts'),
        `fetch("https://api.example.com/v1/${rawOpenAiKey}", { method: "POST" });\n`
      );
      await writeFile(
        path.join(fixtureRoot, '.env'),
        'IGNORED_ENV=process.env.SHOULD_NOT_APPEAR\n'
      );

      const engine = new DocumentationEngine();
      const result = await engine.generateDocumentation({
        title: 'Sanitized Core Engine Test',
        loadedSources: [
          await loadedSourceFixture(fixtureRoot, {
            name: 'Frontend',
            role: 'frontend'
          })
        ],
        options: {
          outputFormats: ['markdown-tree', 'single-markdown', 'json'],
          language: 'en',
          includeSourceReferences: true,
          includeWarnings: true
        }
      });

      const repositoryMap = result.repositoryMaps[0];
      expect(repositoryMap?.apiClientCalls).toEqual([
        {
          method: 'POST',
          path: '/v1/[REDACTED_OPENAI_API_KEY]',
          sourceReference: {
            sourceName: 'Frontend',
            path: 'api.ts'
          }
        }
      ]);
      expect(repositoryMap?.environmentVariables.map((envVar) => envVar.name)).not.toContain(
        'SHOULD_NOT_APPEAR'
      );
      expect(JSON.stringify(result.repositoryMaps)).not.toContain(rawOpenAiKey);

      const generatedOutput = [
        JSON.stringify(result.documentationTree),
        ...[...result.rendered.values()].flatMap((rendered) =>
          rendered.files.map((file) => file.content)
        )
      ].join('\n');
      expect(generatedOutput).toContain('[REDACTED_OPENAI_API_KEY]');
      expect(generatedOutput).not.toContain(rawOpenAiKey);
      expect(generatedOutput).not.toContain('SHOULD_NOT_APPEAR');
      expect(generatedOutput).not.toContain('.env');
    } finally {
      await rm(fixtureRoot, {
        recursive: true,
        force: true
      });
    }
  });
});

async function loadedSourceFixture(
  rootPath: string,
  source: SourceInputMetadata
): Promise<LoadedSource> {
  const candidateFiles = ['package.json', 'app.tsx', 'api.ts', '.env'];
  const files = (
    await Promise.all(
      candidateFiles.map(async (relativePath) => {
        try {
          return await sourceFile(rootPath, relativePath);
        } catch {
          return undefined;
        }
      })
    )
  ).filter((file): file is SourceFile => file !== undefined);

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
