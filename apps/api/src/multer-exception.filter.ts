import { Catch, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { ApiErrorResponse } from '@codebase-docs-ai/shared';
import type { Response } from 'express';

@Catch()
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    if (!isMulterError(exception)) {
      throw exception;
    }

    const response = host.switchToHttp().getResponse<Response>();
    const body: ApiErrorResponse = {
      error: {
        code: 'SOURCE_UPLOAD_INVALID',
        message: uploadErrorMessage(exception.code)
      }
    };
    response.status(HttpStatus.BAD_REQUEST).json(body);
  }
}

function isMulterError(exception: unknown): exception is { name: string; code: string } {
  return (
    typeof exception === 'object' &&
    exception !== null &&
    'name' in exception &&
    'code' in exception &&
    (exception as { name: unknown }).name === 'MulterError' &&
    typeof (exception as { code: unknown }).code === 'string'
  );
}

function uploadErrorMessage(code: string): string {
  if (code === 'LIMIT_FILE_SIZE') {
    return 'Uploaded source archive exceeds the configured file size limit.';
  }

  if (code === 'LIMIT_FILE_COUNT') {
    return 'Too many source archives were uploaded in one request.';
  }

  return 'Source upload request is invalid.';
}
