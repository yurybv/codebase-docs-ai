import path from 'node:path';
import { UnsafeArchivePathError } from './source-loader-errors.js';

export function assertSafeRelativePath(inputPath: string): string {
  const normalized = inputPath.replaceAll('\\', '/').replace(/\/+$/, '');

  if (!normalized || normalized.startsWith('/') || path.isAbsolute(normalized)) {
    throw new UnsafeArchivePathError(inputPath);
  }

  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '..' || segment === '')) {
    throw new UnsafeArchivePathError(inputPath);
  }

  return normalized;
}

export function assertPathInsideRoot(rootPath: string, targetPath: string): void {
  const relativePath = path.relative(rootPath, targetPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new UnsafeArchivePathError(targetPath);
  }
}

export function toPortablePath(inputPath: string): string {
  return inputPath.split(path.sep).join('/');
}
