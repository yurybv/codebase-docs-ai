import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  isSupportedArchiveFile,
  supportedArchiveAccept,
  supportedArchiveLabel,
  uploadConstraintsFromEnv,
  validateSelectedFiles
} from './upload-constraints.js';

describe('upload constraints', () => {
  it('rejects too many selected files', () => {
    const result = validateSelectedFiles(1, [file('one.zip', 10), file('two.zip', 10)], {
      maxFiles: 2,
      maxFileSizeBytes: 100
    });

    expect(result.errorMessage).toBe('Upload up to 2 source archive(s).');
    expect(result.acceptedFiles).toEqual([]);
  });

  it('rejects oversized files', () => {
    const result = validateSelectedFiles(0, [file('large.zip', 1025)], {
      maxFiles: 2,
      maxFileSizeBytes: 1024
    });

    expect(result.errorMessage).toBe('large.zip exceeds the 1 KB upload limit.');
  });

  it('rejects unsupported archive file names', () => {
    const result = validateSelectedFiles(0, [file('notes.txt', 10)], {
      maxFiles: 2,
      maxFileSizeBytes: 1024
    });

    expect(result.errorMessage).toBe('notes.txt is not a supported source archive.');
    expect(result.acceptedFiles).toEqual([]);
  });

  it('matches API-supported archive extensions', () => {
    expect(supportedArchiveAccept).toBe('.zip,.tar,.tar.gz,.tgz');
    expect(supportedArchiveLabel).toBe('Supports .zip, .tar, .tar.gz, .tgz');
    expect(isSupportedArchiveFile('frontend.zip')).toBe(true);
    expect(isSupportedArchiveFile('backend.TAR.GZ')).toBe(true);
    expect(isSupportedArchiveFile('docs.gz')).toBe(false);
  });

  it('formats bytes for UI labels', () => {
    expect(formatBytes(104857600)).toBe('100 MB');
  });

  it('parses env overrides', () => {
    expect(
      uploadConstraintsFromEnv({
        VITE_WEB_UPLOAD_MAX_FILES: '3',
        VITE_WEB_UPLOAD_MAX_FILE_SIZE_BYTES: '2048'
      })
    ).toEqual({
      maxFiles: 3,
      maxFileSizeBytes: 2048
    });
  });
});

function file(name: string, size: number): File {
  return new File([new Uint8Array(size)], name);
}
