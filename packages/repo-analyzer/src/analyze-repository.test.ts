import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { SourceFile } from '@codebase-docs-ai/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
          react: '^18.0.0',
          fastify: '^5.0.0'
        },
        devDependencies: {
          typescript: '^5.0.0',
          vite: '^6.0.0'
        }
      })
    );
    await writeFixtureFile('pnpm-lock.yaml', 'lockfileVersion: 9.0');
    await writeFixtureFile('app/users/[id]/page.tsx', 'export default function Page() {}');
    await writeFixtureFile('src/api.ts', 'fetch("/api/users", { method: "POST" });');
    await writeFixtureFile('vite.config.ts', 'export default {};');
    await writeFixtureFile('playwright.config.ts', 'export default {};');

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
        'src/api.ts',
        'vite.config.ts',
        'playwright.config.ts'
      ])
    });

    expect(repositoryMap.packageManager.name).toBe('pnpm');
    expect(repositoryMap.frameworks.map((framework) => framework.name)).toEqual([
      'Next.js',
      'React',
      'Fastify',
      'Vite',
      'TypeScript'
    ]);
    expect(repositoryMap.scripts.map((script) => script.name)).toEqual(['dev', 'build']);
    expect(repositoryMap.routes.map((route) => route.path)).toEqual(['/users/:id']);
    expect(repositoryMap.apiClientCalls.map((call) => `${call.method} ${call.path}`)).toEqual([
      'POST /api/users'
    ]);
    expect(repositoryMap.configFiles.map((configFile) => configFile.kind)).toEqual([
      'vite',
      'playwright'
    ]);
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

  it('uses injected text readers for content-backed analysis', async () => {
    const rawOpenAiKey = `sk-${'r'.repeat(24)}`;
    await writeFixtureFile(
      'package.json',
      JSON.stringify({
        scripts: {
          [`raw-${rawOpenAiKey}`]: `next dev --token ${rawOpenAiKey}`
        },
        dependencies: {
          [`next-${rawOpenAiKey}`]: '^15.0.0'
        }
      })
    );
    await writeFixtureFile(
      'src/users.controller.ts',
      `
          import { Controller, Get } from '@nestjs/common';

          @Controller('raw-${rawOpenAiKey}')
          export class UsersController {
            @Get('${rawOpenAiKey}')
            getUser() {
              return process.env.RAW_DISK_ENV;
            }
        }
      `
    );
    await writeFixtureFile(
      'src/client.ts',
      `
        fetch("/raw-disk-path", { method: "DELETE" });
        axios.get("/raw-disk-axios");
        console.log(process.env.RAW_CLIENT_ENV);
      `
    );

    const files = await fixtureFiles(['package.json', 'src/users.controller.ts', 'src/client.ts']);
    const injectedContentByPath = new Map<string, string>([
      [
        'package.json',
        JSON.stringify({
          scripts: {
            'start-prefix_[REDACTED_OPENAI_API_KEY]': 'node dist/main.js --token prefix_[REDACTED_OPENAI_API_KEY]'
          },
          dependencies: {
            '@nestjs/core': '^10.0.0',
            axios: '^1.0.0',
            'axios-prefix_[REDACTED_OPENAI_API_KEY]': '^1.0.0'
          }
        })
      ],
      [
        'src/users.controller.ts',
        `
          import { Controller, Get } from '@nestjs/common';

          @Controller('users')
          export class UsersController {
            @Get(':id')
            getUser() {
              return process.env.SAFE_ENV;
            }
          }
        `
      ],
      [
        'src/client.ts',
        `
          fetch("/api/prefix_[REDACTED_OPENAI_API_KEY]", { method: "POST" });
          axios.patch("/api/profile");
          console.log(import.meta.env.PUBLIC_API_URL);
        `
      ]
    ]);
    const readTextFile = vi.fn(async (file: SourceFile) => {
      const content = injectedContentByPath.get(file.path);

      if (!content) {
        throw new Error(`Unexpected file read: ${file.path}`);
      }

      return content;
    });

    const repositoryMap = await analyzeRepository({
      source: {
        name: 'Injected',
        role: 'backend'
      },
      rootPath: tempRoot,
      files,
      readTextFile
    });

    expect(repositoryMap.frameworks.map((framework) => framework.name)).toEqual(['NestJS']);
    expect(repositoryMap.scripts.map((script) => script.name)).toEqual([
      'start-prefix_[REDACTED_OPENAI_API_KEY]'
    ]);
    expect(repositoryMap.apiEndpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`)).toEqual([
      'GET /users/:id'
    ]);
    expect(repositoryMap.apiClientCalls.map((call) => `${call.method} ${call.path}`)).toEqual([
      'POST /api/prefix_[REDACTED_OPENAI_API_KEY]',
      'PATCH /api/profile'
    ]);
    expect(repositoryMap.dependencies.map((dependency) => dependency.name)).toContain(
      'axios-prefix_[REDACTED_OPENAI_API_KEY]'
    );
    expect(repositoryMap.environmentVariables.map((envVar) => envVar.name)).toEqual([
      'PUBLIC_API_URL',
      'SAFE_ENV'
    ]);
    expect(JSON.stringify(repositoryMap)).toContain('prefix_[REDACTED_OPENAI_API_KEY]');
    expect(JSON.stringify(repositoryMap)).not.toContain(rawOpenAiKey);
    expect(JSON.stringify(repositoryMap)).not.toContain('RAW_');
    expect(JSON.stringify(repositoryMap)).not.toContain('/raw-disk');
    expect(readTextFile).toHaveBeenCalled();
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
