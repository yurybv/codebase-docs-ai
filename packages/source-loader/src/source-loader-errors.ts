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
    super(`Archive contains an unsafe path: ${path}`, 'UNSAFE_ARCHIVE_PATH');
  }
}

export class SourceLimitExceededError extends SourceLoaderError {
  constructor(message: string) {
    super(message, 'SOURCE_LIMIT_EXCEEDED');
  }
}

export class UnsupportedArchiveError extends SourceLoaderError {
  constructor(path: string) {
    super(`Unsupported archive type: ${path}`, 'UNSUPPORTED_ARCHIVE_TYPE');
  }
}
