import { describe, expect, it } from 'vitest';
import { redactSecrets } from './redact-secrets.js';

describe('redactSecrets', () => {
  it('redacts secret-like assignment values', () => {
    const result = redactSecrets('AI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz');

    expect(result.text).toContain('AI_API_KEY=[REDACTED_SECRET]');
    expect(result.text).not.toContain('sk-abcdefghijklmnopqrstuvwxyz');
    expect(result.redactions.some((redaction) => redaction.kind === 'assignment_secret')).toBe(
      true
    );
  });

  it('redacts database URLs', () => {
    const result = redactSecrets(
      'DATABASE_URL=postgresql://user:password@example.com:5432/app'
    );

    expect(result.text).not.toContain('password@example.com');
    expect(result.redactions.some((redaction) => redaction.kind === 'database_url')).toBe(true);
  });

  it('redacts private key blocks', () => {
    const result = redactSecrets(`-----BEGIN PRIVATE KEY-----
abc
-----END PRIVATE KEY-----`);

    expect(result.text).toBe('[REDACTED_PRIVATE_KEY]');
    expect(result.redactions).toEqual([
      {
        kind: 'private_key',
        count: 1
      }
    ]);
  });
});
