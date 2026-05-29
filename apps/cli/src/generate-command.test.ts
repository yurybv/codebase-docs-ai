import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { describe, expect, it } from 'vitest';
import { runGenerateCommand } from './generate-command.js';

describe('runGenerateCommand', () => {
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
  await mkdir(sourceRoot);
  await writeFile(
    path.join(sourceRoot, 'package.json'),
    JSON.stringify({
      dependencies: {
        react: 'latest'
      }
    })
  );
  await writeFile(
    path.join(sourceRoot, 'api.ts'),
    `fetch("https://api.example.com/v1/${rawOpenAiKey}", { method: "POST" });\n`
  );
  await writeFile(path.join(sourceRoot, '.env'), 'IGNORED_ENV=process.env.SHOULD_NOT_APPEAR\n');
}
