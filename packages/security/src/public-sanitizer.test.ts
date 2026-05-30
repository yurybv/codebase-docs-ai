import { describe, expect, it } from 'vitest';
import { sanitizePublicText } from './public-sanitizer.js';

describe('sanitizePublicText', () => {
  it('redacts public secret-bearing text consistently', () => {
    const rawOpenAiKey = `sk-${'p'.repeat(24)}`;
    const result = sanitizePublicText(`Failure for prefix_${rawOpenAiKey} in .env SHOULD_NOT_APPEAR.`);

    expect(result).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(result).toContain('[REDACTED_DENIED_FILE]');
    expect(result).toContain('[REDACTED_DENIED_VALUE]');
    expect(result).not.toContain(rawOpenAiKey);
    expect(result).not.toContain('.env');
    expect(result).not.toContain('SHOULD_NOT_APPEAR');
  });

  it('uses a fallback for blank public text', () => {
    expect(sanitizePublicText('', { fallback: 'Request failed.' })).toBe('Request failed.');
  });
});
