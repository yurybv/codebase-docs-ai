import { describe, expect, it } from 'vitest';
import { CliError, formatCliError } from './cli-error.js';
import { parseCliOutputFormat, parseCliSourceInput, parseGenerateOptions } from './cli-options.js';

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
});
