import { describe, expect, it } from 'vitest';
import type { LoadedSource } from '@codebase-docs-ai/shared';
import { decideSourceFile, filterLoadedSource } from './file-filter.js';

const baseFile = {
  absolutePath: '/tmp/source/file.ts',
  sizeBytes: 100,
  extension: '.ts'
};

describe('decideSourceFile', () => {
  it('skips denylisted env files', () => {
    const decision = decideSourceFile({
      ...baseFile,
      path: '.env'
    });

    expect(decision.include).toBe(false);
    expect(decision.reason).toBe('denylisted_path');
  });

  it('skips generated paths', () => {
    const decision = decideSourceFile({
      ...baseFile,
      path: 'node_modules/react/index.js',
      extension: '.js'
    });

    expect(decision.include).toBe(false);
    expect(decision.reason).toBe('generated_path');
  });

  it('skips binary extensions', () => {
    const decision = decideSourceFile({
      ...baseFile,
      path: 'public/logo.png',
      extension: '.png'
    });

    expect(decision.include).toBe(false);
    expect(decision.reason).toBe('binary_extension');
  });

  it.each([
    {
      path: 'archives/frontend.zip',
      extension: '.zip'
    },
    {
      path: 'archives/backend.tar',
      extension: '.tar'
    },
    {
      path: 'archives/shared.tar.gz',
      extension: '.gz'
    },
    {
      path: 'archives/infra.tgz',
      extension: '.tgz'
    }
  ])('skips nested source archive file $path', ({ path, extension }) => {
    const decision = decideSourceFile({
      ...baseFile,
      path,
      extension
    });

    expect(decision.include).toBe(false);
    expect(decision.reason).toBe('binary_extension');
  });

  it('skips files above the prompt file size limit', () => {
    const decision = decideSourceFile(
      {
        ...baseFile,
        path: 'src/large.ts',
        sizeBytes: 11
      },
      {
        maxPromptFileSizeBytes: 10
      }
    );

    expect(decision.include).toBe(false);
    expect(decision.reason).toBe('file_size_limit_exceeded');
  });
});

describe('filterLoadedSource', () => {
  it('returns included and skipped files separately', () => {
    const source: LoadedSource = {
      source: {
        name: 'Frontend',
        role: 'frontend'
      },
      rootPath: '/tmp/source',
      totalSizeBytes: 200,
      skippedFiles: [],
      files: [
        {
          ...baseFile,
          path: 'src/main.ts'
        },
        {
          ...baseFile,
          path: '.env'
        }
      ]
    };

    const filtered = filterLoadedSource(source);

    expect(filtered.includedFiles.map((file) => file.path)).toEqual(['src/main.ts']);
    expect(filtered.skippedFiles.map((decision) => decision.reason)).toEqual(['denylisted_path']);
  });
});
