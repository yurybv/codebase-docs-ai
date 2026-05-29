import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const apiPort = 3300;
const webPort = 5174;
const apiBaseUrl = `http://localhost:${apiPort}`;
const webBaseUrl = `http://localhost:${webPort}`;

async function main(): Promise<void> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'codebase-docs-ai-e2e-'));
  const processes: ChildProcessWithoutNullStreams[] = [];

  try {
    await createFixtureArchives(tempRoot);
    processes.push(
      spawnProcess('pnpm', ['--filter', '@codebase-docs-ai/api', 'dev'], {
        API_PORT: String(apiPort),
        DOCS_AI_TMP_DIR: path.join(tempRoot, 'api-runs')
      })
    );
    processes.push(
      spawnProcess('pnpm', ['--filter', '@codebase-docs-ai/web', 'dev'], {
        WEB_PORT: String(webPort),
        VITE_WEB_API_BASE_URL: apiBaseUrl
      })
    );

    await waitForHttp(`${apiBaseUrl}/health`);
    await waitForHttp(webBaseUrl);
    await runApiLifecycle(tempRoot);
    await runCliApiMode(tempRoot);
    const webHtml = await fetchText(webBaseUrl);
    assert(webHtml.includes('root'), 'Web app root did not render.');

    console.log(
      JSON.stringify(
        {
          status: 'completed',
          apiBaseUrl,
          webBaseUrl
        },
        null,
        2
      )
    );
  } finally {
    for (const childProcess of processes) {
      childProcess.kill('SIGINT');
    }
    await rm(tempRoot, {
      recursive: true,
      force: true
    });
  }
}

async function runCliApiMode(tempRoot: string): Promise<void> {
  const outputPath = path.join(tempRoot, 'cli-api-output');
  await runCommand('pnpm', [
    '--filter',
    '@codebase-docs-ai/cli',
    'exec',
    'tsx',
    'src/main.ts',
    'generate',
    '--api-url',
    apiBaseUrl,
    '--source',
    `${path.join(tempRoot, 'frontend.tar')}:frontend`,
    '--source',
    `${path.join(tempRoot, 'backend.tar')}:backend`,
    '--output',
    outputPath,
    '--format',
    'single-markdown',
    '--name',
    'CLI API Smoke Documentation'
  ]);
  const markdown = await readFile(path.join(outputPath, 'PROJECT_DOCUMENTATION.md'), 'utf8');
  assert(markdown.includes('/api/users'), 'CLI API mode Markdown did not contain the matched API path.');
}

async function createFixtureArchives(tempRoot: string): Promise<void> {
  const frontendPath = path.join(tempRoot, 'frontend');
  const backendPath = path.join(tempRoot, 'backend');
  await mkdir(path.join(frontendPath, 'src'), {
    recursive: true
  });
  await mkdir(path.join(backendPath, 'src'), {
    recursive: true
  });
  await writeFile(
    path.join(frontendPath, 'package.json'),
    JSON.stringify({
      dependencies: {
        next: 'latest',
        react: 'latest'
      }
    })
  );
  await writeFile(path.join(frontendPath, 'src/app.tsx'), 'fetch("/api/users");\n');
  await writeFile(
    path.join(backendPath, 'package.json'),
    JSON.stringify({
      dependencies: {
        '@nestjs/common': 'latest'
      }
    })
  );
  await writeFile(
    path.join(backendPath, 'src/users.controller.ts'),
    'import { Controller, Get } from "@nestjs/common"; @Controller("api/users") export class UsersController { @Get() list() { return []; } }\n'
  );

  await runCommand('tar', ['-cf', path.join(tempRoot, 'frontend.tar'), '-C', frontendPath, '.']);
  await runCommand('tar', ['-cf', path.join(tempRoot, 'backend.tar'), '-C', backendPath, '.']);
}

async function runApiLifecycle(tempRoot: string): Promise<void> {
  const created = await fetchJson<{ runId: string }>(`${apiBaseUrl}/v1/documentation-runs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'E2E Smoke Documentation',
      options: {
        outputFormats: ['markdown-tree', 'single-markdown', 'json'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    })
  });
  const formData = new FormData();
  formData.append(
    'metadata',
    JSON.stringify({
      sources: [
        {
          fileField: 'frontend',
          name: 'Frontend',
          role: 'frontend'
        },
        {
          fileField: 'backend',
          name: 'Backend',
          role: 'backend'
        }
      ]
    })
  );
  formData.append('frontend', await archiveBlob(path.join(tempRoot, 'frontend.tar')), 'frontend.tar');
  formData.append('backend', await archiveBlob(path.join(tempRoot, 'backend.tar')), 'backend.tar');

  await fetchJson(`${apiBaseUrl}/v1/documentation-runs/${created.runId}/sources`, {
    method: 'POST',
    body: formData
  });
  await fetchJson(`${apiBaseUrl}/v1/documentation-runs/${created.runId}/start`, {
    method: 'POST'
  });
  const result = await fetchJson<{ documentation: { pages: Array<{ markdown: string }> } }>(
    `${apiBaseUrl}/v1/documentation-runs/${created.runId}/result`
  );
  assert(result.documentation.pages.length > 0, 'Documentation pages were not generated.');

  const markdown = await fetchText(
    `${apiBaseUrl}/v1/documentation-runs/${created.runId}/download?format=single-markdown`
  );
  assert(markdown.includes('/api/users'), 'Generated Markdown did not contain the matched API path.');
}

async function archiveBlob(filePath: string): Promise<Blob> {
  return new Blob([await readFile(filePath)], {
    type: 'application/x-tar'
  });
}

function spawnProcess(
  command: string,
  args: string[],
  env: Record<string, string>
): ChildProcessWithoutNullStreams {
  const childProcess = spawn(command, args, {
    env: {
      ...process.env,
      ...env
    },
    stdio: 'pipe'
  });
  childProcess.on('exit', (code, signal) => {
    if (signal === 'SIGINT' || code === 130) {
      return;
    }
    if (code && code !== 0) {
      console.error(`${command} ${args.join(' ')} exited with ${code}`);
    }
  });

  return childProcess;
}

async function waitForHttp(url: string): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20_000) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      await delay(250);
      continue;
    }
    await delay(250);
  }

  throw new Error(`Timed out waiting for ${url}.`);
}

async function fetchJson<TValue>(url: string, init?: RequestInit): Promise<TValue> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<TValue>;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed ${response.status}: ${await response.text()}`);
  }

  return response.text();
}

async function runCommand(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const childProcess = spawn(command, args, {
      stdio: 'pipe'
    });
    childProcess.on('error', reject);
    childProcess.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} failed with ${code}.`));
      }
    });
  });
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

await main();
