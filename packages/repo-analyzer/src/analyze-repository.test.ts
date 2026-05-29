import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { SourceFile } from '@codebase-docs-ai/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { analyzeRepository } from './analyze-repository.js';

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), 'codebase-docs-ai-repo-analyzer-'));
});

afterEach(async () => {
  await rm(tempRoot, {
    recursive: true,
    force: true
  });
});

describe('analyzeRepository', () => {
  it('detects package metadata and Next.js routes', async () => {
    await writeFixtureFile(
      'package.json',
      JSON.stringify({
        scripts: {
          dev: 'next dev',
          build: 'next build'
        },
        dependencies: {
          next: '^15.0.0',
          react: '^18.0.0'
        },
        devDependencies: {
          typescript: '^5.0.0'
        }
      })
    );
    await writeFixtureFile('pnpm-lock.yaml', 'lockfileVersion: 9.0');
    await writeFixtureFile('app/users/[id]/page.tsx', 'export default function Page() {}');
    await writeFixtureFile('src/api.ts', 'fetch("/api/users");');

    const repositoryMap = await analyzeRepository({
      source: {
        name: 'Frontend',
        role: 'frontend'
      },
      rootPath: tempRoot,
      files: await fixtureFiles([
        'package.json',
        'pnpm-lock.yaml',
        'app/users/[id]/page.tsx',
        'src/api.ts'
      ])
    });

    expect(repositoryMap.packageManager.name).toBe('pnpm');
    expect(repositoryMap.frameworks.map((framework) => framework.name)).toEqual([
      'Next.js',
      'React',
      'TypeScript'
    ]);
    expect(repositoryMap.scripts.map((script) => script.name)).toEqual(['dev', 'build']);
    expect(repositoryMap.routes.map((route) => route.path)).toEqual(['/users/:id']);
    expect(repositoryMap.apiClientCalls.map((call) => call.path)).toEqual(['/api/users']);
  });

  it('detects NestJS controller endpoints and environment variables', async () => {
    await writeFixtureFile(
      'package.json',
      JSON.stringify({
        dependencies: {
          '@nestjs/core': '^10.0.0'
        }
      })
    );
    await writeFixtureFile(
      'src/users/users.controller.ts',
      `
        import { Controller, Get, Post } from '@nestjs/common';

        @Controller('users')
        export class UsersController {
          @Get(':id')
          getUser() {
            return process.env.DATABASE_URL;
          }

          @Post()
          createUser() {}
        }
      `
    );

    const repositoryMap = await analyzeRepository({
      source: {
        name: 'Backend',
        role: 'backend'
      },
      rootPath: tempRoot,
      files: await fixtureFiles(['package.json', 'src/users/users.controller.ts'])
    });

    expect(repositoryMap.frameworks.map((framework) => framework.name)).toEqual(['NestJS']);
    expect(repositoryMap.apiEndpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`)).toEqual([
      'GET /users/:id',
      'POST /users'
    ]);
    expect(repositoryMap.environmentVariables.map((envVar) => envVar.name)).toEqual([
      'DATABASE_URL'
    ]);
  });
});

async function writeFixtureFile(relativePath: string, content: string): Promise<void> {
  const absolutePath = path.join(tempRoot, relativePath);
  await mkdir(path.dirname(absolutePath), {
    recursive: true
  });
  await writeFile(absolutePath, content);
}

async function fixtureFiles(relativePaths: string[]): Promise<SourceFile[]> {
  return Promise.all(
    relativePaths.map(async (relativePath) => {
      const absolutePath = path.join(tempRoot, relativePath);
      const content = await import('node:fs/promises').then((fs) => fs.readFile(absolutePath));

      return {
        path: relativePath,
        absolutePath,
        sizeBytes: content.byteLength,
        extension: path.extname(relativePath)
      };
    })
  );
}
