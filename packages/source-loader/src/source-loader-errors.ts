import { sanitizePublicText } from '@codebase-docs-ai/security';

export class SourceLoaderError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = 'SourceLoaderError';
  }
}

export class UnsafeArchivePathError extends SourceLoaderError {
  constructor(path: string) {
    super(
      `Archive contains an unsafe path: ${sanitizeSourceLoaderMessage(path)}`,
      'UNSAFE_ARCHIVE_PATH'
    );
  }
}

export class SourceLimitExceededError extends SourceLoaderError {
  constructor(message: string) {
    super(sanitizeSourceLoaderMessage(message), 'SOURCE_LIMIT_EXCEEDED');
  }
}

export class UnsupportedArchiveError extends SourceLoaderError {
  constructor(path: string) {
    super(
      `Unsupported archive type: ${sanitizeSourceLoaderMessage(path)}`,
      'UNSUPPORTED_ARCHIVE_TYPE'
    );
  }
}

function sanitizeSourceLoaderMessage(value: string): string {
  return sanitizePublicText(value);
}
