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
      message: sanitizePublicString(response, defaultErrorMessage(statusCode))
    };
  }

  const responseRecord = response as Record<string, unknown>;
  const payload: ApiErrorPayload = {
    code: typeof responseRecord.code === 'string' ? responseRecord.code : defaultErrorCode(statusCode),
    message: normalizeMessage(responseRecord.message, defaultErrorMessage(statusCode))
  };

  if ('details' in responseRecord) {
    payload.details = sanitizePublicValue(responseRecord.details);
  }

  if (typeof responseRecord.suggestion === 'string') {
    payload.suggestion = sanitizePublicString(responseRecord.suggestion, defaultErrorMessage(statusCode));
  }

  return payload;
}

function normalizeMessage(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.length > 0) {
    return sanitizePublicString(value, fallback);
  }

  if (Array.isArray(value)) {
    const messages = value.filter((entry): entry is string => typeof entry === 'string');
    if (messages.length > 0) {
      return sanitizePublicString(messages.join('; '), fallback);
    }
  }

  return fallback;
}

function sanitizePublicValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizePublicString(value, '[REDACTED]');
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizePublicValue(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizePublicValue(entry)])
    );
  }

  return value;
}

function sanitizePublicString(value: string, fallback: string): string {
  const sanitized = value
    .replace(/\bsk-[A-Za-z0-9_-]{20,}\b/g, '[REDACTED_OPENAI_API_KEY]')
    .replace(/\.env(?:\.[A-Za-z0-9_-]+)?/g, '[REDACTED_DENIED_FILE]')
    .replace(/SHOULD_NOT_APPEAR/g, '[REDACTED_DENIED_VALUE]');

  return sanitized.length > 0 ? sanitized : fallback;
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
