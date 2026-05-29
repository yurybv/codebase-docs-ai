import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { createApiErrorResponse } from './api-exception.filter.js';

describe('createApiErrorResponse', () => {
  it('wraps structured HTTP exceptions in the public error envelope', () => {
    expect(
      createApiErrorResponse(
        new BadRequestException({
          code: 'INVALID_SOURCE_METADATA',
          message: 'Source upload metadata is invalid.',
          details: {
            fieldErrors: {
              sources: ['Required']
            }
          }
        })
      )
    ).toEqual({
      statusCode: 400,
      body: {
        error: {
          code: 'INVALID_SOURCE_METADATA',
          message: 'Source upload metadata is invalid.',
          details: {
            fieldErrors: {
              sources: ['Required']
            }
          }
        }
      }
    });
  });

  it('normalizes default NestJS exception bodies', () => {
    expect(createApiErrorResponse(new NotFoundException('Missing run'))).toEqual({
      statusCode: 404,
      body: {
        error: {
          code: 'NOT_FOUND',
          message: 'Missing run'
        }
      }
    });
  });

  it('hides unhandled exception details', () => {
    expect(createApiErrorResponse(new Error('database password leaked'))).toEqual({
      statusCode: 500,
      body: {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error.'
        }
      }
    });
  });

  it('sanitizes secret-bearing HTTP exception envelopes', () => {
    const rawOpenAiKey = `sk-${'t'.repeat(24)}`;
    const response = createApiErrorResponse(
      new BadRequestException({
        code: 'INVALID_SOURCE_METADATA',
        message: `Invalid source ${rawOpenAiKey} from .env SHOULD_NOT_APPEAR.`,
        details: {
          fieldErrors: {
            sources: [`Remove ${rawOpenAiKey} from .env SHOULD_NOT_APPEAR.`]
          }
        },
        suggestion: `Upload a safe archive without ${rawOpenAiKey} or .env SHOULD_NOT_APPEAR.`
      })
    );
    const payload = JSON.stringify(response.body);

    expect(response.statusCode).toBe(400);
    expect(payload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(payload).toContain('[REDACTED_DENIED_FILE]');
    expect(payload).toContain('[REDACTED_DENIED_VALUE]');
    expect(payload).not.toContain(rawOpenAiKey);
    expect(payload).not.toContain('.env');
    expect(payload).not.toContain('SHOULD_NOT_APPEAR');
  });

  it('preserves explicit internal HTTP exception messages', () => {
    expect(createApiErrorResponse(new InternalServerErrorException('Generation failed.'))).toEqual({
      statusCode: 500,
      body: {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Generation failed.'
        }
      }
    });
  });
});
