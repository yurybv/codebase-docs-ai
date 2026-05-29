import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadArchiveSource, loadFolderSource } from './load-source.js';
import { assertSafeRelativePath } from './path-safety.js';
import { UnsafeArchivePathError } from './source-loader-errors.js';

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), 'codebase-docs-ai-source-loader-'));
});

afterEach(async () => {
  await rm(tempRoot, {
    recursive: true,
    force: true
  });
});

describe('loadFolderSource', () => {
  it('builds a sorted file inventory from a local folder', async () => {
    const sourcePath = path.join(tempRoot, 'frontend');
    await mkdir(path.join(sourcePath, 'src'), {
      recursive: true
    });
    await writeFile(path.join(sourcePath, 'package.json'), '{"name":"frontend"}');
    await writeFile(path.join(sourcePath, 'src', 'main.ts'), 'console.log("hello");');

    const loaded = await loadFolderSource({
      source: {
        name: 'Frontend',
        role: 'frontend'
      },
      folderPath: sourcePath
    });

    expect(loaded.files.map((file) => file.path)).toEqual(['package.json', 'src/main.ts']);
    expect(loaded.totalSizeBytes).toBeGreaterThan(0);
  });
});

describe('loadArchiveSource', () => {
  it('extracts a zip archive and builds file inventory', async () => {
    const archivePath = path.join(tempRoot, 'backend.zip');
    const zip = new AdmZip();
    zip.addFile('src/main.ts', Buffer.from('export const main = true;'));
    zip.writeZip(archivePath);

    const loaded = await loadArchiveSource({
      source: {
        name: 'Backend',
        role: 'backend'
      },
      archivePath,
      extractionRoot: path.join(tempRoot, 'extract')
    });

    expect(loaded.rootPath).toContain('backend');
    expect(loaded.files.map((file) => file.path)).toEqual(['src/main.ts']);
  });

  it('rejects unsafe relative paths before extraction', () => {
    expect(() => assertSafeRelativePath('../escape.ts')).toThrow(UnsafeArchivePathError);
    expect(() => assertSafeRelativePath('/absolute.ts')).toThrow(UnsafeArchivePathError);
  });

  it('allows directory entries with trailing slashes', () => {
    expect(assertSafeRelativePath('src/')).toBe('src');
    expect(assertSafeRelativePath('src/controllers/')).toBe('src/controllers');
  });
});
