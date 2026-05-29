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
  return value
    .replace(/\bsk-[A-Za-z0-9_-]{20,}\b/g, '[REDACTED_OPENAI_API_KEY]')
    .replace(/\.env(?:\.[A-Za-z0-9_-]+)?/g, '[REDACTED_DENIED_FILE]')
    .replace(/SHOULD_NOT_APPEAR/g, '[REDACTED_DENIED_VALUE]');
}
