import { mkdtemp, mkdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import * as tar from 'tar';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadArchiveSource, loadFolderSource } from './load-source.js';
import { assertSafeRelativePath } from './path-safety.js';
import {
  SourceLimitExceededError,
  UnsafeArchivePathError,
  UnsupportedArchiveError
} from './source-loader-errors.js';

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

  it('rejects folders that exceed the file count limit', async () => {
    const sourcePath = path.join(tempRoot, 'too-many-files');
    await mkdir(path.join(sourcePath, 'src'), {
      recursive: true
    });
    await writeFile(path.join(sourcePath, 'src', 'one.ts'), 'export const one = true;');
    await writeFile(path.join(sourcePath, 'src', 'two.ts'), 'export const two = true;');

    await expect(
      loadFolderSource({
        source: {
          name: 'Frontend',
          role: 'frontend'
        },
        folderPath: sourcePath,
        limits: {
          maxFiles: 1
        }
      })
    ).rejects.toMatchObject({
      name: 'SourceLoaderError',
      code: 'SOURCE_LIMIT_EXCEEDED',
      message: 'Source exceeds file count limit of 1'
    });
  });

  it('skips folder files that exceed the per-file size limit', async () => {
    const sourcePath = path.join(tempRoot, 'large-file');
    await mkdir(path.join(sourcePath, 'src'), {
      recursive: true
    });
    await writeFile(path.join(sourcePath, 'src', 'main.ts'), 'export const main = true;');

    const loaded = await loadFolderSource({
      source: {
        name: 'Frontend',
        role: 'frontend'
      },
      folderPath: sourcePath,
      limits: {
        maxFileSizeBytes: 5
      }
    });

    expect(loaded.files).toEqual([]);
    expect(loaded.skippedFiles).toEqual([
      {
        path: 'src/main.ts',
        reason: 'file_size_limit_exceeded'
      }
    ]);
  });

  it('rejects folders that exceed the total size limit', async () => {
    const sourcePath = path.join(tempRoot, 'large-total');
    await mkdir(path.join(sourcePath, 'src'), {
      recursive: true
    });
    await writeFile(path.join(sourcePath, 'src', 'one.ts'), '1234');
    await writeFile(path.join(sourcePath, 'src', 'two.ts'), '5678');

    await expect(
      loadFolderSource({
        source: {
          name: 'Frontend',
          role: 'frontend'
        },
        folderPath: sourcePath,
        limits: {
          maxFileSizeBytes: 10,
          maxTotalSizeBytes: 5
        }
      })
    ).rejects.toMatchObject({
      name: 'SourceLoaderError',
      code: 'SOURCE_LIMIT_EXCEEDED',
      message: 'Source exceeds total size limit of 5 bytes'
    });
  });

  it('skips symbolic links in folder inputs as non-regular files', async () => {
    const sourcePath = path.join(tempRoot, 'folder-with-link');
    await mkdir(path.join(sourcePath, 'src'), {
      recursive: true
    });
    await writeFile(path.join(sourcePath, 'src', 'target.ts'), 'export const target = true;');
    await symlink('target.ts', path.join(sourcePath, 'src', 'link.ts'));

    const loaded = await loadFolderSource({
      source: {
        name: 'Frontend',
        role: 'frontend'
      },
      folderPath: sourcePath
    });

    expect(loaded.files.map((file) => file.path)).toEqual(['src/target.ts']);
    expect(loaded.skippedFiles).toEqual([
      {
        path: 'src/link.ts',
        reason: 'not_regular_file'
      }
    ]);
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

  it('rejects tar archives that contain symbolic links', async () => {
    const archivePath = path.join(tempRoot, 'symlink.tar');
    await writeTarLinkFixtureArchive(archivePath, 'symbolic');

    await expect(
      loadArchiveSource({
        source: {
          name: 'Backend',
          role: 'backend'
        },
        archivePath,
        extractionRoot: path.join(tempRoot, 'extract-symlink')
      })
    ).rejects.toMatchObject({
      name: 'SourceLoaderError',
      code: 'SOURCE_LIMIT_EXCEEDED',
      message: 'Archive contains unsupported link: link.txt'
    });
  });

  it('rejects tar archives that contain hard links', async () => {
    const archivePath = path.join(tempRoot, 'hardlink.tar');
    await writeTarLinkFixtureArchive(archivePath, 'hard');

    await expect(
      loadArchiveSource({
        source: {
          name: 'Backend',
          role: 'backend'
        },
        archivePath,
        extractionRoot: path.join(tempRoot, 'extract-hardlink')
      })
    ).rejects.toMatchObject({
      name: 'SourceLoaderError',
      code: 'SOURCE_LIMIT_EXCEEDED',
      message: 'Archive contains unsupported link: link.txt'
    });
  });

  it('rejects zip archives that contain symbolic links', async () => {
    const archivePath = path.join(tempRoot, 'symlink.zip');
    writeZipSymlinkArchive(archivePath);

    const loadPromise = loadArchiveSource({
      source: {
        name: 'Backend',
        role: 'backend'
      },
      archivePath,
      extractionRoot: path.join(tempRoot, 'extract-zip-symlink')
    });

    await expect(loadPromise).rejects.toBeInstanceOf(SourceLimitExceededError);
    await expect(loadPromise).rejects.toMatchObject({
      name: 'SourceLoaderError',
      code: 'SOURCE_LIMIT_EXCEEDED',
      message: 'Archive contains unsupported symlink: link.txt'
    });
  });

  it('sanitizes secret-bearing unsafe archive path errors', async () => {
    const rawOpenAiKey = `sk-${'x'.repeat(24)}`;
    const embeddedOpenAiKey = `prefix_${rawOpenAiKey}`;
    const archivePath = path.join(tempRoot, 'unsafe-secret-path.tar');
    await writeTarUnsafePathArchive(
      archivePath,
      `../${embeddedOpenAiKey}/.env/SHOULD_NOT_APPEAR.ts`
    );

    try {
      await loadArchiveSource({
        source: {
          name: 'Backend',
          role: 'backend'
        },
        archivePath,
        extractionRoot: path.join(tempRoot, 'extract-unsafe-secret-path')
      });
      throw new Error('Expected archive loading to fail.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(error).toBeInstanceOf(UnsafeArchivePathError);
      expect(message).toContain('[REDACTED_OPENAI_API_KEY]');
      expect(message).toContain('[REDACTED_DENIED_FILE]');
      expect(message).toContain('[REDACTED_DENIED_VALUE]');
      expect(message).not.toContain(rawOpenAiKey);
      expect(message).not.toContain('.env');
      expect(message).not.toContain('SHOULD_NOT_APPEAR');
    }
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

async function writeTarLinkFixtureArchive(
  archivePath: string,
  linkKind: 'symbolic' | 'hard'
): Promise<void> {
  const targetContent = Buffer.from('target');
  await writeFile(
    archivePath,
    Buffer.concat([
      createTarHeader({
        name: 'target.txt',
        size: targetContent.byteLength,
        typeFlag: '0'
      }),
      padTarData(targetContent),
      createTarHeader({
        name: 'link.txt',
        size: 0,
        typeFlag: linkKind === 'symbolic' ? '2' : '1',
        linkName: 'target.txt'
      }),
      Buffer.alloc(1024)
    ])
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

function writeZipSymlinkArchive(archivePath: string): void {
  const zip = new AdmZip();
  const entry = zip.addFile('link.txt', Buffer.from('target.txt'));
  entry.attr = 0o120777 * 0x10000;
  zip.writeZip(archivePath);
}

async function writeTarUnsafePathArchive(archivePath: string, entryPath: string): Promise<void> {
  const content = Buffer.from('export const ignored = true;');
  await writeFile(
    archivePath,
    Buffer.concat([
      createTarHeader({
        name: entryPath,
        size: content.byteLength,
        typeFlag: '0'
      }),
      padTarData(content),
      Buffer.alloc(1024)
    ])
  );
}

function createTarHeader(input: {
  name: string;
  size: number;
  typeFlag: '0' | '1' | '2';
  linkName?: string;
}): Buffer {
  const header = Buffer.alloc(512, 0);
  header.write(input.name, 0, 100, 'ascii');
  writeTarOctal(header, 100, 8, 0o644);
  writeTarOctal(header, 108, 8, 0);
  writeTarOctal(header, 116, 8, 0);
  writeTarOctal(header, 124, 12, input.size);
  writeTarOctal(header, 136, 12, 0);
  header.fill(' ', 148, 156);
  header.write(input.typeFlag, 156, 1, 'ascii');
  if (input.linkName) {
    header.write(input.linkName, 157, 100, 'ascii');
  }
  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');

  let checksum = 0;
  for (const byte of header) {
    checksum += byte;
  }
  header.write(checksum.toString(8).padStart(6, '0'), 148, 6, 'ascii');
  header[154] = 0;
  header[155] = 0x20;
  return header;
}

function writeTarOctal(buffer: Buffer, offset: number, length: number, value: number): void {
  buffer.write(value.toString(8).padStart(length - 1, '0'), offset, length - 1, 'ascii');
  buffer[offset + length - 1] = 0;
}

function padTarData(data: Buffer): Buffer {
  const paddingLength = (512 - (data.byteLength % 512)) % 512;
  return Buffer.concat([data, Buffer.alloc(paddingLength)]);
}
