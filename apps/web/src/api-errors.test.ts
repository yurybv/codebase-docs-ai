import { describe, expect, it } from 'vitest';
import { formatApiErrorMessage, parseApiError } from './api-errors.js';

describe('parseApiError', () => {
  it('parses standardized API error envelopes', async () => {
    await expect(
      parseApiError(
        new Response(
          JSON.stringify({
            error: {
              code: 'RUN_START_NOT_ALLOWED',
              message: 'Documentation runs can only be started from the ready status.',
              details: {
                status: 'completed'
              }
            }
          })
        )
      )
    ).resolves.toEqual({
      code: 'RUN_START_NOT_ALLOWED',
      message: 'Documentation runs can only be started from the ready status.',
      details: {
        status: 'completed'
      }
    });
  });

  it('keeps legacy flat error parsing defensive', async () => {
    await expect(
      parseApiError(
        new Response(
          JSON.stringify({
            code: 'LEGACY_ERROR',
            message: 'Legacy failure.'
          })
        )
      )
    ).resolves.toEqual({
      code: 'LEGACY_ERROR',
      message: 'Legacy failure.'
    });
  });

  it('formats error codes for operator-facing messages', () => {
    expect(
      formatApiErrorMessage(
        {
          code: 'SOURCE_UPLOAD_INVALID',
          message: 'Too many source archives were uploaded in one request.'
        },
        'Request failed.'
      )
    ).toBe('SOURCE_UPLOAD_INVALID: Too many source archives were uploaded in one request.');
  });
});
