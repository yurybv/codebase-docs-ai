import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runGenerateCommand } from './generate-command.js';

describe('runGenerateCommand', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes sanitized local generation output', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'codebase-docs-ai-cli-test-'));
    const sourceRoot = path.join(tempRoot, 'source');
    const outputRoot = path.join(tempRoot, 'out');
    const rawOpenAiKey = `sk-${'d'.repeat(24)}`;

    try {
      await writeSanitizationSourceFixture(sourceRoot, rawOpenAiKey);

      const result = await runGenerateCommand({
        source: [`${sourceRoot}:frontend`],
        output: outputRoot,
        format: 'single-markdown',
        name: 'CLI Sanitized Documentation'
      });

      expect(result.status).toBe('completed');
      expect(result.files).toEqual([path.join(outputRoot, 'PROJECT_DOCUMENTATION.md')]);

      const markdown = await readFile(path.join(outputRoot, 'PROJECT_DOCUMENTATION.md'), 'utf8');
      expect(markdown).toContain('[REDACTED_OPENAI_API_KEY]');
      expect(markdown).toContain('prefix_[REDACTED_OPENAI_API_KEY]');
      expect(markdown).toContain('[REDACTED_DENIED_FILE]');
      expect(markdown).toContain('[REDACTED_DENIED_VALUE]');
      expect(markdown).not.toContain(rawOpenAiKey);
      expect(markdown).not.toContain('SHOULD_NOT_APPEAR');
      expect(markdown).not.toContain('.env');
    } finally {
      await rm(tempRoot, {
        recursive: true,
        force: true
      });
    }
  });

  it('writes sanitized local markdown-tree output', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'codebase-docs-ai-cli-test-'));
    const sourceRoot = path.join(tempRoot, 'source');
    const outputRoot = path.join(tempRoot, 'out');
    const rawOpenAiKey = `sk-${'q'.repeat(24)}`;

    try {
      await writeSanitizationSourceFixture(sourceRoot, rawOpenAiKey);

      const result = await runGenerateCommand({
        source: [`${sourceRoot}:frontend`],
        output: outputRoot,
        format: 'markdown-tree',
        name: 'CLI Sanitized Markdown Tree Documentation'
      });

      expect(result.status).toBe('completed');
      expect(result.files.length).toBeGreaterThan(1);
      expect(result.files.every((filePath) => filePath.startsWith(outputRoot))).toBe(true);

      const markdownTree = (await Promise.all(result.files.map((filePath) => readFile(filePath, 'utf8')))).join(
        '\n'
      );
      expect(markdownTree).toContain('[REDACTED_OPENAI_API_KEY]');
      expect(markdownTree).toContain('prefix_[REDACTED_OPENAI_API_KEY]');
      expect(markdownTree).toContain('[REDACTED_DENIED_FILE]');
      expect(markdownTree).toContain('[REDACTED_DENIED_VALUE]');
      expect(markdownTree).not.toContain(rawOpenAiKey);
      expect(markdownTree).not.toContain('SHOULD_NOT_APPEAR');
      expect(markdownTree).not.toContain('.env');
    } finally {
      await rm(tempRoot, {
        recursive: true,
        force: true
      });
    }
  });

  it('writes sanitized packaged markdown output', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'codebase-docs-ai-cli-test-'));
    const sourceRoot = path.join(tempRoot, 'source');
    const outputRoot = path.join(tempRoot, 'out');
    const rawOpenAiKey = `sk-${'e'.repeat(24)}`;

    try {
      await writeSanitizationSourceFixture(sourceRoot, rawOpenAiKey);

      const result = await runGenerateCommand({
        source: [`${sourceRoot}:frontend`],
        output: outputRoot,
        format: 'zip',
        name: 'CLI Sanitized Zip Documentation'
      });

      const zipPath = path.join(outputRoot, 'documentation.zip');
      expect(result.status).toBe('completed');
      expect(result.files).toEqual([zipPath]);

      const zip = new AdmZip(await readFile(zipPath));
      const zipContent = zip
        .getEntries()
        .filter((entry) => !entry.isDirectory)
        .map((entry) => entry.getData().toString('utf8'))
        .join('\n');
      expect(zipContent).toContain('[REDACTED_OPENAI_API_KEY]');
      expect(zipContent).toContain('prefix_[REDACTED_OPENAI_API_KEY]');
      expect(zipContent).toContain('[REDACTED_DENIED_FILE]');
      expect(zipContent).toContain('[REDACTED_DENIED_VALUE]');
      expect(zipContent).not.toContain(rawOpenAiKey);
      expect(zipContent).not.toContain('SHOULD_NOT_APPEAR');
      expect(zipContent).not.toContain('.env');
    } finally {
      await rm(tempRoot, {
        recursive: true,
        force: true
      });
    }
  });

  it('writes sanitized JSON output', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'codebase-docs-ai-cli-test-'));
    const sourceRoot = path.join(tempRoot, 'source');
    const outputRoot = path.join(tempRoot, 'out');
    const rawOpenAiKey = `sk-${'f'.repeat(24)}`;

    try {
      await writeSanitizationSourceFixture(sourceRoot, rawOpenAiKey);

      const result = await runGenerateCommand({
        source: [`${sourceRoot}:frontend`],
        output: outputRoot,
        format: 'json',
        name: 'CLI Sanitized JSON Documentation'
      });

      const jsonPath = path.join(outputRoot, 'documentation-tree.json');
      expect(result.status).toBe('completed');
      expect(result.files).toEqual([jsonPath]);

      const json = await readFile(jsonPath, 'utf8');
      expect(JSON.parse(json)).toMatchObject({
        title: 'CLI Sanitized JSON Documentation'
      });
      expect(json).toContain('[REDACTED_OPENAI_API_KEY]');
      expect(json).toContain('prefix_[REDACTED_OPENAI_API_KEY]');
      expect(json).toContain('[REDACTED_DENIED_FILE]');
      expect(json).toContain('[REDACTED_DENIED_VALUE]');
      expect(json).not.toContain(rawOpenAiKey);
      expect(json).not.toContain('SHOULD_NOT_APPEAR');
      expect(json).not.toContain('.env');
    } finally {
      await rm(tempRoot, {
        recursive: true,
        force: true
      });
    }
  });

  it('writes sanitized API-mode download output', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'codebase-docs-ai-cli-test-'));
    const sourcePath = path.join(tempRoot, 'frontend.zip');
    const outputRoot = path.join(tempRoot, 'out');
    const rawOpenAiKey = `sk-${'r'.repeat(24)}`;
    const sanitizedMarkdown = [
      '# 06. API Contracts',
      '',
      '| POST | /v1/prefix_[REDACTED_OPENAI_API_KEY]/[REDACTED_DENIED_FILE]/[REDACTED_DENIED_VALUE] | unmatched |'
    ].join('\n');
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ runId: 'run_123', status: 'created' }))
      .mockResolvedValueOnce(jsonResponse({ runId: 'run_123', status: 'ready', sources: [] }))
      .mockResolvedValueOnce(jsonResponse({ runId: 'run_123', status: 'running' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'run_123', status: 'completed' }))
      .mockResolvedValueOnce(
        jsonResponse({
          runId: 'run_123',
          status: 'completed',
          renderedFormats: ['single-markdown'],
          documentation: {
            title: 'CLI API Sanitized Documentation',
            summary: 'Generated',
            pages: [],
            warnings: [],
            sourceReferences: [],
            generatedAt: '2026-05-29T00:00:00.000Z'
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(sanitizedMarkdown, {
          status: 200,
          headers: {
            'content-disposition': 'attachment; filename="PROJECT_DOCUMENTATION.md"',
            'content-type': 'text/markdown'
          }
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    try {
      await writeSanitizationArchiveFixture(sourcePath, rawOpenAiKey);

      const result = await runGenerateCommand({
        source: [`${sourcePath}:frontend`],
        output: outputRoot,
        format: 'single-markdown',
        name: 'CLI API Sanitized Documentation',
        apiUrl: 'http://localhost:3000'
      });

      const markdownPath = path.join(outputRoot, 'PROJECT_DOCUMENTATION.md');
      expect(result.status).toBe('completed');
      expect(result.files).toEqual([markdownPath]);

      const markdown = await readFile(markdownPath, 'utf8');
      expect(markdown).toContain('[REDACTED_OPENAI_API_KEY]');
      expect(markdown).toContain('prefix_[REDACTED_OPENAI_API_KEY]');
      expect(markdown).toContain('[REDACTED_DENIED_FILE]');
      expect(markdown).toContain('[REDACTED_DENIED_VALUE]');
      expect(markdown).not.toContain(rawOpenAiKey);
      expect(markdown).not.toContain('SHOULD_NOT_APPEAR');
      expect(markdown).not.toContain('.env');
    } finally {
      await rm(tempRoot, {
        recursive: true,
        force: true
      });
    }
  });

  it('rejects unsupported API mode archive file names before upload', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'codebase-docs-ai-cli-test-'));
    const sourcePath = path.join(tempRoot, 'notes.txt');
    await writeFile(sourcePath, 'not an archive');

    try {
      await expect(
        runGenerateCommand({
          source: [`${sourcePath}:docs`],
          output: path.join(tempRoot, 'out'),
          format: 'single-markdown',
          name: 'Docs',
          apiUrl: 'http://127.0.0.1:1'
        })
      ).rejects.toMatchObject({
        name: 'CliError',
        code: 'CLI_API_SOURCE_ARCHIVE_UNSUPPORTED',
        exitCode: 2,
        message: 'Unsupported source archive type: notes.txt.',
        details: {
          suggestion: 'Use one of the supported API mode archive types: .zip, .tar, .tar.gz, .tgz.',
          supportedExtensions: ['.zip', '.tar', '.tar.gz', '.tgz']
        }
      });
    } finally {
      await rm(tempRoot, {
        recursive: true,
        force: true
      });
    }
  });
});

async function writeSanitizationSourceFixture(
  sourceRoot: string,
  rawOpenAiKey: string
): Promise<void> {
  const embeddedOpenAiKey = `prefix_${rawOpenAiKey}`;
  await mkdir(sourceRoot);
  await writeFile(
    path.join(sourceRoot, 'package.json'),
    JSON.stringify({
      scripts: {
        [`dev-${embeddedOpenAiKey}`]: `vite --token ${embeddedOpenAiKey}`
      },
      dependencies: {
        react: 'latest',
        [`react-${embeddedOpenAiKey}`]: 'latest'
      }
    })
  );
  await writeFile(
    path.join(sourceRoot, 'api.ts'),
    `fetch("https://api.example.com/v1/${embeddedOpenAiKey}/.env/SHOULD_NOT_APPEAR", { method: "POST" });\n`
  );
  await writeFile(path.join(sourceRoot, '.env'), 'IGNORED_ENV=process.env.SHOULD_NOT_APPEAR\n');
}

async function writeSanitizationArchiveFixture(
  archivePath: string,
  rawOpenAiKey: string
): Promise<void> {
  const embeddedOpenAiKey = `prefix_${rawOpenAiKey}`;
  const archive = new AdmZip();
  archive.addFile(
    'package.json',
    Buffer.from(
      JSON.stringify({
        scripts: {
          [`dev-${embeddedOpenAiKey}`]: `vite --token ${embeddedOpenAiKey}`
        },
        dependencies: {
          react: 'latest',
          [`react-${embeddedOpenAiKey}`]: 'latest'
        }
      })
    )
  );
  archive.addFile(
    'api.ts',
    Buffer.from(
      `fetch("https://api.example.com/v1/${embeddedOpenAiKey}/.env/SHOULD_NOT_APPEAR", { method: "POST" });\n`
    )
  );
  archive.addFile('.env', Buffer.from('IGNORED_ENV=process.env.SHOULD_NOT_APPEAR\n'));
  await writeFile(archivePath, archive.toBuffer());
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'content-type': 'application/json'
    }
  });
}
