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

  it('sanitizes storage paths and denied source evidence in public error envelopes', async () => {
    const rawOpenAiKey = `sk-${'z'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/prefix_${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR/documentation-tree.json`;

    const error = await parseApiError(
      new Response(
        JSON.stringify({
          error: {
            code: 'DOCUMENTATION_RESULT_ARTIFACT_MISSING',
            message: `Documentation result artifact is missing at ${rawStoragePath}.`,
            details: {
              path: rawStoragePath,
              staleContent: `# SHOULD_NOT_APPEAR ${rawOpenAiKey}`
            }
          }
        })
      )
    );

    const formatted = formatApiErrorMessage(error, 'Request failed.');
    const serialized = JSON.stringify(error);

    expect(formatted).toContain('DOCUMENTATION_RESULT_ARTIFACT_MISSING');
    expect(formatted).toContain('[REDACTED_STORAGE_PATH]');
    expect(serialized).toContain('[REDACTED_STORAGE_PATH]');
    expect(serialized).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(serialized).toContain('[REDACTED_DENIED_VALUE]');
    expect(serialized).not.toContain(rawStoragePath);
    expect(serialized).not.toContain(rawOpenAiKey);
    expect(serialized).not.toContain('.env');
    expect(serialized).not.toContain('SHOULD_NOT_APPEAR');
  });
});
