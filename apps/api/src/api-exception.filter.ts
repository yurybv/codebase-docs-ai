import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { ApiErrorPayload, ApiErrorResponse } from '@codebase-docs-ai/shared';
import type { Response } from 'express';

interface NormalizedApiErrorResponse {
  statusCode: number;
  body: ApiErrorResponse;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const normalized = createApiErrorResponse(exception);
    response.status(normalized.statusCode).json(normalized.body);
  }
}

export function createApiErrorResponse(exception: unknown): NormalizedApiErrorResponse {
  if (!(exception instanceof HttpException)) {
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error.'
        }
      }
    };
  }

  const statusCode = exception.getStatus();
  return {
    statusCode,
    body: {
      error: normalizeHttpExceptionResponse(exception.getResponse(), statusCode)
    }
  };
}

function normalizeHttpExceptionResponse(response: string | object, statusCode: number): ApiErrorPayload {
  if (typeof response === 'string') {
    return {
      code: defaultErrorCode(statusCode),
      message: response
    };
  }

  const responseRecord = response as Record<string, unknown>;
  const payload: ApiErrorPayload = {
    code: typeof responseRecord.code === 'string' ? responseRecord.code : defaultErrorCode(statusCode),
    message: normalizeMessage(responseRecord.message, defaultErrorMessage(statusCode))
  };

  if ('details' in responseRecord) {
    payload.details = responseRecord.details;
  }

  if (typeof responseRecord.suggestion === 'string') {
    payload.suggestion = responseRecord.suggestion;
  }

  return payload;
}

function normalizeMessage(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  if (Array.isArray(value)) {
    const messages = value.filter((entry): entry is string => typeof entry === 'string');
    if (messages.length > 0) {
      return messages.join('; ');
    }
  }

  return fallback;
}

function defaultErrorCode(statusCode: number): string {
  switch (statusCode) {
    case HttpStatus.BAD_REQUEST:
      return 'BAD_REQUEST';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.PAYLOAD_TOO_LARGE:
      return 'PAYLOAD_TOO_LARGE';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    default:
      return statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'HTTP_ERROR';
  }
}

function defaultErrorMessage(statusCode: number): string {
  switch (statusCode) {
    case HttpStatus.BAD_REQUEST:
      return 'Bad request.';
    case HttpStatus.NOT_FOUND:
      return 'Resource was not found.';
    case HttpStatus.PAYLOAD_TOO_LARGE:
      return 'Request payload is too large.';
    case HttpStatus.UNAUTHORIZED:
      return 'Authentication is required.';
    case HttpStatus.FORBIDDEN:
      return 'Access is forbidden.';
    default:
      return statusCode >= 500 ? 'Internal server error.' : 'Request failed.';
  }
}
