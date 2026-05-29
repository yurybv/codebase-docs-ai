import { mkdtemp, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import * as tar from 'tar';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadArchiveSource, loadFolderSource } from './load-source.js';
import { assertSafeRelativePath } from './path-safety.js';
import { UnsafeArchivePathError, UnsupportedArchiveError } from './source-loader-errors.js';

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

  it.each([
    {
      archiveName: 'backend.tar',
      gzip: false
    },
    {
      archiveName: 'backend.tar.gz',
      gzip: true
    },
    {
      archiveName: 'backend.tgz',
      gzip: true
    }
  ])('extracts $archiveName archive and builds file inventory', async ({ archiveName, gzip }) => {
    const archivePath = path.join(tempRoot, archiveName);
    await writeTarFixtureArchive(archivePath, gzip);

    const loaded = await loadArchiveSource({
      source: {
        name: 'Backend',
        role: 'backend'
      },
      archivePath,
      extractionRoot: path.join(tempRoot, `extract-${archiveName}`)
    });

    expect(loaded.rootPath).toContain('backend');
    expect(loaded.files.map((file) => file.path)).toEqual(['src/main.ts']);
  });

  it('rejects unsupported archive file names before creating an extraction directory', async () => {
    const archivePath = path.join(tempRoot, 'notes.txt');
    const extractionRoot = path.join(tempRoot, 'unsupported-extract');
    await writeFile(archivePath, 'not an archive');

    const loadPromise = loadArchiveSource({
      source: {
        name: 'Notes',
        role: 'docs'
      },
      archivePath,
      extractionRoot
    });

    await expect(loadPromise).rejects.toBeInstanceOf(UnsupportedArchiveError);
    await expect(loadPromise).rejects.toMatchObject({
      name: 'SourceLoaderError',
      code: 'UNSUPPORTED_ARCHIVE_TYPE',
      message: `Unsupported archive type: ${archivePath}`
    });
    await expect(stat(path.join(extractionRoot, 'notes'))).rejects.toMatchObject({
      code: 'ENOENT'
    });
  });

  it('rejects archives that exceed the file count limit', async () => {
    const archivePath = path.join(tempRoot, 'too-many-files.zip');
    writeZipArchive(archivePath, [
      {
        path: 'src/one.ts',
        content: 'export const one = true;'
      },
      {
        path: 'src/two.ts',
        content: 'export const two = true;'
      }
    ]);

    await expect(
      loadArchiveSource({
        source: {
          name: 'Backend',
          role: 'backend'
        },
        archivePath,
        extractionRoot: path.join(tempRoot, 'extract-too-many-files'),
        limits: {
          maxFiles: 1
        }
      })
    ).rejects.toMatchObject({
      name: 'SourceLoaderError',
      code: 'SOURCE_LIMIT_EXCEEDED',
      message: 'Archive exceeds file count limit of 1'
    });
  });

  it('rejects archive entries that exceed the per-file size limit', async () => {
    const archivePath = path.join(tempRoot, 'large-file.zip');
    writeZipArchive(archivePath, [
      {
        path: 'src/main.ts',
        content: 'export const main = true;'
      }
    ]);

    await expect(
      loadArchiveSource({
        source: {
          name: 'Backend',
          role: 'backend'
        },
        archivePath,
        extractionRoot: path.join(tempRoot, 'extract-large-file'),
        limits: {
          maxFileSizeBytes: 5
        }
      })
    ).rejects.toMatchObject({
      name: 'SourceLoaderError',
      code: 'SOURCE_LIMIT_EXCEEDED',
      message: 'Archive entry exceeds file size limit of 5 bytes'
    });
  });

  it('rejects archives that exceed the total size limit', async () => {
    const archivePath = path.join(tempRoot, 'large-total.zip');
    writeZipArchive(archivePath, [
      {
        path: 'src/one.ts',
        content: '1234'
      },
      {
        path: 'src/two.ts',
        content: '5678'
      }
    ]);

    await expect(
      loadArchiveSource({
        source: {
          name: 'Backend',
          role: 'backend'
        },
        archivePath,
        extractionRoot: path.join(tempRoot, 'extract-large-total'),
        limits: {
          maxFileSizeBytes: 10,
          maxTotalSizeBytes: 5
        }
      })
    ).rejects.toMatchObject({
      name: 'SourceLoaderError',
      code: 'SOURCE_LIMIT_EXCEEDED',
      message: 'Archive exceeds total size limit of 5 bytes'
    });
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

async function writeTarFixtureArchive(archivePath: string, gzip: boolean): Promise<void> {
  const sourceRoot = path.join(tempRoot, `fixture-${path.basename(archivePath)}`);
  await mkdir(path.join(sourceRoot, 'src'), {
    recursive: true
  });
  await writeFile(path.join(sourceRoot, 'src', 'main.ts'), 'export const main = true;');

  await tar.c(
    {
      cwd: sourceRoot,
      file: archivePath,
      gzip
    },
    ['src/main.ts']
  );
}

function writeZipArchive(
  archivePath: string,
  entries: Array<{
    path: string;
    content: string;
  }>
): void {
  const zip = new AdmZip();
  for (const entry of entries) {
    zip.addFile(entry.path, Buffer.from(entry.content));
  }
  zip.writeZip(archivePath);
}
