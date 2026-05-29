import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runGenerateCommand } from './generate-command.js';

describe('runGenerateCommand', () => {
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
