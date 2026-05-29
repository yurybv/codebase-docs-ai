import { describe, expect, it } from 'vitest';
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
});
