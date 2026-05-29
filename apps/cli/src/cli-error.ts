export interface CliFailureResult {
  status: 'failed';
  exitCode: number;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class CliError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly exitCode = 2,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'CliError';
  }
}

export function formatCliError(error: unknown): CliFailureResult {
  if (error instanceof CliError) {
    return {
      status: 'failed',
      exitCode: error.exitCode,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {})
      }
    };
  }

  if (isSdkClientError(error)) {
    return {
      status: 'failed',
      exitCode: 1,
      error: {
        code: error.code ?? 'API_REQUEST_FAILED',
        message: error.message,
        details: {
          status: error.status,
          ...(error.details ? { apiDetails: error.details } : {})
        }
      }
    };
  }

  return {
    status: 'failed',
    exitCode: 1,
    error: {
      code: 'CLI_UNEXPECTED_ERROR',
      message: error instanceof Error ? error.message : 'Unknown CLI error.'
    }
  };
}

function isSdkClientError(
  error: unknown
): error is { name: string; message: string; status: number; code?: string; details?: unknown } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: unknown }).name === 'CodebaseDocsAIClientError' &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  );
}
