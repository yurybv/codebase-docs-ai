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
