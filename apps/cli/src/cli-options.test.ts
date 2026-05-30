import { describe, expect, it } from 'vitest';
import { CliError, formatCliError } from './cli-error.js';
import {
  parseCliOutputFormat,
  parseCliSourceInput,
  parseGenerateOptions,
  parseListRunsOptions
} from './cli-options.js';

describe('CLI option parsing', () => {
  it('parses source path and role', () => {
    expect(parseCliSourceInput('/tmp/frontend.zip:frontend')).toEqual({
      inputPath: '/tmp/frontend.zip',
      metadata: {
        name: 'frontend',
        role: 'frontend'
      }
    });
  });

  it('rejects unsupported source roles', () => {
    expect(() => parseCliSourceInput('/tmp/app.zip:invalid')).toThrow('Unsupported source role');
  });

  it('supports zip as a CLI-only output format', () => {
    expect(parseCliOutputFormat('zip')).toBe('zip');
  });

  it('requires at least one source', () => {
    expect(() => parseGenerateOptions({ source: [] })).toThrow('At least one --source');
  });

  it('parses API mode URL when provided', () => {
    expect(
      parseGenerateOptions({
        source: ['/tmp/frontend.zip:frontend'],
        apiUrl: 'http://localhost:3000'
      }).apiUrl
    ).toBe('http://localhost:3000');
  });

  it('rejects unsupported API URL protocols', () => {
    expect(() =>
      parseGenerateOptions({
        source: ['/tmp/frontend.zip:frontend'],
        apiUrl: 'file:///tmp/api'
      })
    ).toThrow('API URL must use http or https.');
  });

  it('requires an API URL for listing remote runs', () => {
    expect(() => parseListRunsOptions({})).toThrow(
      'API URL is required for listing remote documentation runs.'
    );
  });

  it('parses API mode URL for remote run listing', () => {
    expect(parseListRunsOptions({ apiUrl: 'https://docs.example.test' })).toEqual({
      apiUrl: 'https://docs.example.test'
    });
  });

  it('parses run listing limits', () => {
    expect(parseListRunsOptions({ apiUrl: 'https://docs.example.test', limit: '25' })).toEqual({
      apiUrl: 'https://docs.example.test',
      limit: 25
    });
  });

  it('parses run listing status filters', () => {
    expect(
      parseListRunsOptions({
        apiUrl: 'https://docs.example.test',
        limit: '25',
        status: 'completed',
        role: 'backend',
        name: 'backend search',
        format: 'json',
        minSources: '1',
        maxSources: '2',
        sort: 'updatedAt:asc',
        createdAfter: '2026-05-29T23:59:30.000Z',
        createdBefore: '2026-05-30T00:01:00.000Z',
        updatedAfter: '2026-05-30T00:00:30.000Z',
        updatedBefore: '2026-05-30T00:01:30.000Z',
        cursor: 'eyJ1cGRhdGVkQXQiOiIyMDI2LTA1LTMwVDAwOjAxOjAwLjAwMFoiLCJpZCI6InJ1bl8xMjMifQ'
      })
    ).toEqual({
      apiUrl: 'https://docs.example.test',
      limit: 25,
      status: 'completed',
      role: 'backend',
      name: 'backend search',
      format: 'json',
      minSources: 1,
      maxSources: 2,
      sort: 'updatedAt:asc',
      createdAfter: '2026-05-29T23:59:30.000Z',
      createdBefore: '2026-05-30T00:01:00.000Z',
      updatedAfter: '2026-05-30T00:00:30.000Z',
      updatedBefore: '2026-05-30T00:01:30.000Z',
      cursor: 'eyJ1cGRhdGVkQXQiOiIyMDI2LTA1LTMwVDAwOjAxOjAwLjAwMFoiLCJpZCI6InJ1bl8xMjMifQ'
    });
  });

  it('rejects invalid run listing limits without echoing raw values', () => {
    const rawOpenAiKey = `sk-${'y'.repeat(24)}`;
    const rawLimit = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;

    try {
      parseListRunsOptions({
        apiUrl: 'https://docs.example.test',
        limit: rawLimit
      });
      throw new Error('Expected parseListRunsOptions to reject invalid limit.');
    } catch (error) {
      const failure = formatCliError(error);
      const payload = JSON.stringify(failure);
      expect(failure).toEqual({
        status: 'failed',
        exitCode: 2,
        error: {
          code: 'CLI_RUN_LIST_LIMIT_INVALID',
          message: 'Run list limit must be an integer between 1 and 100.',
          details: {
            min: 1,
            max: 100
          }
        }
      });
      expect(payload).not.toContain(rawOpenAiKey);
      expect(payload).not.toContain('/private/tmp');
      expect(payload).not.toContain('.env');
      expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    }
  });

  it('rejects invalid run listing status filters without echoing raw values', () => {
    const rawOpenAiKey = `sk-${'z'.repeat(24)}`;
    const rawStatus = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;

    try {
      parseListRunsOptions({
        apiUrl: 'https://docs.example.test',
        status: rawStatus
      });
      throw new Error('Expected parseListRunsOptions to reject invalid status.');
    } catch (error) {
      const failure = formatCliError(error);
      const payload = JSON.stringify(failure);
      expect(failure).toMatchObject({
        status: 'failed',
        exitCode: 2,
        error: {
          code: 'CLI_RUN_LIST_STATUS_INVALID',
          message: 'Run list status must be a supported documentation run status.',
          details: {
            allowedStatuses: expect.arrayContaining(['created', 'completed', 'failed'])
          }
        }
      });
      expect(payload).not.toContain(rawOpenAiKey);
      expect(payload).not.toContain('/private/tmp');
      expect(payload).not.toContain('.env');
      expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    }
  });

  it('rejects invalid run listing source role filters without echoing raw values', () => {
    const rawOpenAiKey = `sk-${'a'.repeat(24)}`;
    const rawRole = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;

    try {
      parseListRunsOptions({
        apiUrl: 'https://docs.example.test',
        role: rawRole
      });
      throw new Error('Expected parseListRunsOptions to reject invalid role.');
    } catch (error) {
      const failure = formatCliError(error);
      const payload = JSON.stringify(failure);
      expect(failure).toMatchObject({
        status: 'failed',
        exitCode: 2,
        error: {
          code: 'CLI_RUN_LIST_SOURCE_ROLE_INVALID',
          message: 'Run list source role must be a supported source role.',
          details: {
            allowedRoles: expect.arrayContaining(['frontend', 'backend', 'unknown'])
          }
        }
      });
      expect(payload).not.toContain(rawOpenAiKey);
      expect(payload).not.toContain('/private/tmp');
      expect(payload).not.toContain('.env');
      expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    }
  });

  it('rejects invalid run listing cursors without echoing raw values', () => {
    const rawOpenAiKey = `sk-${'b'.repeat(24)}`;
    const rawCursor = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;

    try {
      parseListRunsOptions({
        apiUrl: 'https://docs.example.test',
        cursor: rawCursor.repeat(20)
      });
      throw new Error('Expected parseListRunsOptions to reject invalid cursor.');
    } catch (error) {
      const failure = formatCliError(error);
      const payload = JSON.stringify(failure);
      expect(failure).toMatchObject({
        status: 'failed',
        exitCode: 2,
        error: {
          code: 'CLI_RUN_LIST_CURSOR_INVALID',
          message: 'Run list cursor is invalid.'
        }
      });
      expect(payload).not.toContain(rawCursor);
      expect(payload).not.toContain(rawOpenAiKey);
      expect(payload).not.toContain('/private/tmp');
      expect(payload).not.toContain('.env');
      expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    }
  });

  it('rejects invalid run listing name filters without echoing raw values', () => {
    const rawOpenAiKey = `sk-${'d'.repeat(24)}`;
    const rawName = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;

    for (const invalidName of ['   ', rawName.repeat(5)]) {
      try {
        parseListRunsOptions({
          apiUrl: 'https://docs.example.test',
          name: invalidName
        });
        throw new Error('Expected parseListRunsOptions to reject invalid name.');
      } catch (error) {
        const failure = formatCliError(error);
        const payload = JSON.stringify(failure);
        expect(failure).toEqual({
          status: 'failed',
          exitCode: 2,
          error: {
            code: 'CLI_RUN_LIST_NAME_INVALID',
            message: 'Run list name filter must be between 1 and 200 characters.'
          }
        });
        expect(payload).not.toContain(rawName);
        expect(payload).not.toContain(rawOpenAiKey);
        expect(payload).not.toContain('/private/tmp');
        expect(payload).not.toContain('.env');
        expect(payload).not.toContain('SHOULD_NOT_APPEAR');
      }
    }
  });

  it('rejects invalid run listing format filters without echoing raw values', () => {
    const rawOpenAiKey = `sk-${'e'.repeat(24)}`;
    const rawFormat = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;

    try {
      parseListRunsOptions({
        apiUrl: 'https://docs.example.test',
        format: rawFormat
      });
      throw new Error('Expected parseListRunsOptions to reject invalid format.');
    } catch (error) {
      const failure = formatCliError(error);
      const payload = JSON.stringify(failure);
      expect(failure).toMatchObject({
        status: 'failed',
        exitCode: 2,
        error: {
          code: 'CLI_RUN_LIST_FORMAT_INVALID',
          message: 'Run list format must be a supported documentation output format.',
          details: {
            allowedFormats: expect.arrayContaining(['markdown-tree', 'single-markdown', 'json'])
          }
        }
      });
      expect(payload).not.toContain(rawFormat);
      expect(payload).not.toContain(rawOpenAiKey);
      expect(payload).not.toContain('/private/tmp');
      expect(payload).not.toContain('.env');
      expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    }
  });

  it('rejects invalid run listing source count filters without echoing raw values', () => {
    const rawOpenAiKey = `sk-${'f'.repeat(24)}`;
    const rawSourceCount = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;

    for (const options of [
      { minSources: rawSourceCount },
      { maxSources: rawSourceCount },
      { minSources: '2', maxSources: '1' }
    ]) {
      try {
        parseListRunsOptions({
          apiUrl: 'https://docs.example.test',
          ...options
        });
        throw new Error('Expected parseListRunsOptions to reject invalid source count.');
      } catch (error) {
        const failure = formatCliError(error);
        const payload = JSON.stringify(failure);
        expect(failure).toEqual({
          status: 'failed',
          exitCode: 2,
          error: {
            code: 'CLI_RUN_LIST_SOURCE_COUNT_INVALID',
            message:
              'Run list source count filters must be non-negative integers, and minSources must not exceed maxSources.',
            details: {
              min: 0
            }
          }
        });
        expect(payload).not.toContain(rawSourceCount);
        expect(payload).not.toContain(rawOpenAiKey);
        expect(payload).not.toContain('/private/tmp');
        expect(payload).not.toContain('.env');
        expect(payload).not.toContain('SHOULD_NOT_APPEAR');
      }
    }
  });

  it('rejects invalid run listing sort filters without echoing raw values', () => {
    const rawOpenAiKey = `sk-${'h'.repeat(24)}`;
    const rawSort = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;

    try {
      parseListRunsOptions({
        apiUrl: 'https://docs.example.test',
        sort: rawSort
      });
      throw new Error('Expected parseListRunsOptions to reject invalid sort.');
    } catch (error) {
      const failure = formatCliError(error);
      const payload = JSON.stringify(failure);
      expect(failure).toEqual({
        status: 'failed',
        exitCode: 2,
        error: {
          code: 'CLI_RUN_LIST_SORT_INVALID',
          message: 'Run list sort must be a supported sort option.',
          details: {
            allowedSorts: ['updatedAt:desc', 'updatedAt:asc']
          }
        }
      });
      expect(payload).not.toContain(rawSort);
      expect(payload).not.toContain(rawOpenAiKey);
      expect(payload).not.toContain('/private/tmp');
      expect(payload).not.toContain('.env');
      expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    }
  });

  it('rejects invalid run listing updated-at filters without echoing raw values', () => {
    const rawOpenAiKey = `sk-${'c'.repeat(24)}`;
    const rawTimestamp = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;

    for (const [field, code, message] of [
      [
        'updatedAfter',
        'CLI_RUN_LIST_UPDATED_AFTER_INVALID',
        'Run list updatedAfter must be a valid ISO timestamp.'
      ],
      [
        'updatedBefore',
        'CLI_RUN_LIST_UPDATED_BEFORE_INVALID',
        'Run list updatedBefore must be a valid ISO timestamp.'
      ]
    ] as const) {
      try {
        parseListRunsOptions({
          apiUrl: 'https://docs.example.test',
          [field]: rawTimestamp
        });
        throw new Error(`Expected parseListRunsOptions to reject invalid ${field}.`);
      } catch (error) {
        const failure = formatCliError(error);
        const payload = JSON.stringify(failure);
        expect(failure).toEqual({
          status: 'failed',
          exitCode: 2,
          error: {
            code,
            message
          }
        });
        expect(payload).not.toContain(rawTimestamp);
        expect(payload).not.toContain(rawOpenAiKey);
        expect(payload).not.toContain('/private/tmp');
        expect(payload).not.toContain('.env');
        expect(payload).not.toContain('SHOULD_NOT_APPEAR');
      }
    }
  });

  it('rejects invalid run listing created-at filters without echoing raw values', () => {
    const rawOpenAiKey = `sk-${'g'.repeat(24)}`;
    const rawTimestamp = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;

    for (const [field, code, message] of [
      [
        'createdAfter',
        'CLI_RUN_LIST_CREATED_AFTER_INVALID',
        'Run list createdAfter must be a valid ISO timestamp.'
      ],
      [
        'createdBefore',
        'CLI_RUN_LIST_CREATED_BEFORE_INVALID',
        'Run list createdBefore must be a valid ISO timestamp.'
      ]
    ] as const) {
      try {
        parseListRunsOptions({
          apiUrl: 'https://docs.example.test',
          [field]: rawTimestamp
        });
        throw new Error(`Expected parseListRunsOptions to reject invalid ${field}.`);
      } catch (error) {
        const failure = formatCliError(error);
        const payload = JSON.stringify(failure);
        expect(failure).toEqual({
          status: 'failed',
          exitCode: 2,
          error: {
            code,
            message
          }
        });
        expect(payload).not.toContain(rawTimestamp);
        expect(payload).not.toContain(rawOpenAiKey);
        expect(payload).not.toContain('/private/tmp');
        expect(payload).not.toContain('.env');
        expect(payload).not.toContain('SHOULD_NOT_APPEAR');
      }
    }
  });

  it('formats typed CLI failures with stable codes and exit codes', () => {
    expect(formatCliError(new CliError('CLI_SOURCE_REQUIRED', 'Missing source.'))).toEqual({
      status: 'failed',
      exitCode: 2,
      error: {
        code: 'CLI_SOURCE_REQUIRED',
        message: 'Missing source.'
      }
    });
  });

  it('formats API failures without raw secret-bearing error content', () => {
    const rawOpenAiKey = `sk-${'w'.repeat(24)}`;
    const embeddedOpenAiKey = `prefix_${rawOpenAiKey}`;
    const failure = formatCliError({
      name: 'CodebaseDocsAIClientError',
      status: 400,
      code: 'SOURCE_UPLOAD_INVALID',
      message: `Upload failed for ${embeddedOpenAiKey} from .env SHOULD_NOT_APPEAR.`,
      details: {
        fieldErrors: {
          sources: [`Remove ${embeddedOpenAiKey} from .env SHOULD_NOT_APPEAR.`]
        }
      }
    });
    const payload = JSON.stringify(failure);

    expect(failure.exitCode).toBe(1);
    expect(payload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(payload).toContain('[REDACTED_DENIED_FILE]');
    expect(payload).toContain('[REDACTED_DENIED_VALUE]');
    expect(payload).not.toContain(rawOpenAiKey);
    expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    expect(payload).not.toContain('.env');
  });

  it('formats API failures without raw run storage paths', () => {
    const rawOpenAiKey = `sk-${'x'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/prefix_${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR/documentation-tree.json`;
    const failure = formatCliError({
      name: 'CodebaseDocsAIClientError',
      status: 400,
      code: 'DOCUMENTATION_RESULT_ARTIFACT_MISSING',
      message: `Documentation result artifact is unavailable at ${rawStoragePath}.`,
      details: {
        path: rawStoragePath
      }
    });
    const payload = JSON.stringify(failure);

    expect(failure.error.code).toBe('DOCUMENTATION_RESULT_ARTIFACT_MISSING');
    expect(payload).toContain('[REDACTED_STORAGE_PATH]');
    expect(payload).not.toContain(rawStoragePath);
    expect(payload).not.toContain('/private/tmp');
    expect(payload).not.toContain(rawOpenAiKey);
    expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    expect(payload).not.toContain('.env');
  });
});
