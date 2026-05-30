import { describe, expect, it } from 'vitest';
import { sanitizePublicErrorText, sanitizePublicErrorValue } from './public-error-sanitizer.js';

describe('sanitizePublicErrorText', () => {
  it('redacts raw secrets, denied source evidence, and storage paths in public errors', () => {
    const rawOpenAiKey = `sk-${'w'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/prefix_${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR/documentation-tree.json`;

    const result = sanitizePublicErrorText(
      `Artifact was missing at ${rawStoragePath}; denied value SHOULD_NOT_APPEAR was stale.`
    );

    expect(result).toContain('[REDACTED_STORAGE_PATH]');
    expect(result).toContain('[REDACTED_DENIED_VALUE]');
    expect(result).not.toContain(rawStoragePath);
    expect(result).not.toContain(rawOpenAiKey);
    expect(result).not.toContain('.env');
    expect(result).not.toContain('SHOULD_NOT_APPEAR');
  });

  it('sanitizes nested public error details', () => {
    const rawOpenAiKey = `sk-${'x'.repeat(24)}`;

    expect(
      sanitizePublicErrorValue({
        artifactPath: `/Users/operator/runs/${rawOpenAiKey}/.env`,
        nested: ['SHOULD_NOT_APPEAR']
      })
    ).toEqual({
      artifactPath: '[REDACTED_STORAGE_PATH]',
      nested: ['[REDACTED_DENIED_VALUE]']
    });
  });
});
