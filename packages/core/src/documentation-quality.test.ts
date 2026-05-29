import { mkdtemp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DocumentationEngine } from './documentation-engine.js';
import type { LoadedSource, SourceFile, SourceInputMetadata } from '@codebase-docs-ai/shared';

describe('DocumentationEngine documentation quality fixture', () => {
  it('documents a representative frontend and backend system', async () => {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'core-quality-fixture-'));

    try {
      const frontendPath = path.join(fixtureRoot, 'frontend');
      const backendPath = path.join(fixtureRoot, 'backend');
      await createFrontendFixture(frontendPath);
      await createBackendFixture(backendPath);

      const engine = new DocumentationEngine();
      const result = await engine.generateDocumentation({
        title: 'Golden Fixture Documentation',
        loadedSources: [
          await loadedSourceFixture(frontendPath, {
            name: 'Frontend',
            role: 'frontend'
          }),
          await loadedSourceFixture(backendPath, {
            name: 'Backend',
            role: 'backend'
          })
        ],
        options: {
          outputFormats: ['single-markdown', 'json'],
          language: 'en',
          includeSourceReferences: true,
          includeWarnings: true
        }
      });

      const page = (key: string): string =>
        result.documentationTree.pages.find((candidate) => candidate.key === key)?.markdown ?? '';

      expect(page('overview')).toContain('Frontend');
      expect(page('overview')).toContain('Backend');
      expect(page('system-architecture')).toContain('| frontend-calls-backend | Frontend | Backend | high |');
      expect(page('api-contracts')).toContain('| GET | /api/users | matched |');
      expect(page('api-contracts')).toContain('| POST | /api/users | matched |');
      expect(page('frontend')).toContain('| next-app-route | /dashboard |');
      expect(page('backend')).toContain('| NestJS | backend | Backend:package.json |');
      expect(page('backend')).toContain('| POST | /api/users | users.controller |');
      expect(page('environment')).toContain('VITE_API_BASE_URL');
      expect(page('environment')).toContain('DATABASE_URL');
      expect(page('testing')).toContain('| test | `vitest run` |');
      expect(page('build-deployment')).toContain('| docker | Backend:Dockerfile |');
      expect(page('external-integrations')).toContain('| Stripe | Backend |');
      expect(page('auth')).toContain('| jwt | Backend |');
      expect(result.documentationTree.sourceReferences).toContainEqual({
        sourceName: 'Frontend',
        path: 'src/api.ts'
      });
      expect(result.documentationTree.title).toBe('Golden Fixture Documentation');
      expect(result.rendered.get('single-markdown')?.files[0]?.content).toContain('# 01. Overview');
      expect(result.rendered.get('json')?.files[0]?.path).toBe('documentation-tree.json');
    } finally {
      await rm(fixtureRoot, {
        recursive: true,
        force: true
      });
    }
  });
});

async function createFrontendFixture(rootPath: string): Promise<void> {
  await mkdir(path.join(rootPath, 'app/dashboard'), {
    recursive: true
  });
  await mkdir(path.join(rootPath, 'src'), {
    recursive: true
  });
  await writeFile(
    path.join(rootPath, 'package.json'),
    JSON.stringify({
      scripts: {
        dev: 'next dev',
        build: 'next build',
        test: 'vitest run',
        lint: 'next lint'
      },
      dependencies: {
        next: 'latest',
        react: 'latest',
        'react-dom': 'latest'
      },
      devDependencies: {
        vitest: 'latest'
      }
    })
  );
  await writeFile(
    path.join(rootPath, 'app/dashboard/page.tsx'),
    'export default function DashboardPage() { return <main>Dashboard</main>; }\n'
  );
  await writeFile(
    path.join(rootPath, 'src/api.ts'),
    [
      'const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;',
      'export const listUsers = () => fetch("/api/users", { method: "GET" });',
      'export const createUser = () => fetch("/api/users", { method: "POST" });'
    ].join('\n')
  );
  await writeFile(path.join(rootPath, 'next.config.ts'), 'export default {};\n');
  await writeFile(path.join(rootPath, 'pnpm-lock.yaml'), 'lockfileVersion: "9.0"\n');
}

async function createBackendFixture(rootPath: string): Promise<void> {
  await mkdir(path.join(rootPath, 'src'), {
    recursive: true
  });
  await writeFile(
    path.join(rootPath, 'package.json'),
    JSON.stringify({
      scripts: {
        start: 'nest start',
        build: 'nest build',
        test: 'vitest run',
        lint: 'eslint .'
      },
      dependencies: {
        '@nestjs/common': 'latest',
        '@nestjs/core': 'latest',
        '@nestjs/jwt': 'latest',
        '@prisma/client': 'latest',
        stripe: 'latest'
      },
      devDependencies: {
        vitest: 'latest'
      }
    })
  );
  await writeFile(
    path.join(rootPath, 'src/users.controller.ts'),
    [
      'import { Body, Controller, Get, Post } from "@nestjs/common";',
      '@Controller("api/users")',
      'export class UsersController {',
      '  @Get()',
      '  list() { return []; }',
      '  @Post()',
      '  create(@Body() body: unknown) { return body; }',
      '}'
    ].join('\n')
  );
  await writeFile(
    path.join(rootPath, 'src/config.ts'),
    'export const databaseUrl = process.env.DATABASE_URL;\n'
  );
  await writeFile(path.join(rootPath, 'Dockerfile'), 'FROM node:20.10.0-bookworm-slim\n');
  await writeFile(path.join(rootPath, 'pnpm-lock.yaml'), 'lockfileVersion: "9.0"\n');
}

async function loadedSourceFixture(rootPath: string, source: SourceInputMetadata): Promise<LoadedSource> {
  const files = await collectSourceFiles(rootPath);

  return {
    source,
    rootPath,
    files,
    skippedFiles: [],
    totalSizeBytes: files.reduce((total, file) => total + file.sizeBytes, 0)
  };
}

async function collectSourceFiles(rootPath: string): Promise<SourceFile[]> {
  const files: SourceFile[] = [];

  async function visit(directoryPath: string): Promise<void> {
    const entries = await readdir(directoryPath, {
      withFileTypes: true
    });

    for (const entry of entries) {
      const absolutePath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const fileStat = await stat(absolutePath);
      files.push({
        path: path.relative(rootPath, absolutePath).replaceAll(path.sep, '/'),
        absolutePath,
        sizeBytes: fileStat.size,
        extension: path.extname(absolutePath)
      });
    }
  }

  await visit(rootPath);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}
