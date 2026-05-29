import { describe, expect, it } from 'vitest';
import { LocalJsonProvider } from './local-json-provider.js';

describe('LocalJsonProvider', () => {
  it('returns resolver output as a typed object', async () => {
    const provider = new LocalJsonProvider(() => ({
      ok: true
    }));

    await expect(
      provider.generateObject<{ ok: boolean }>({
        systemPrompt: 'system',
        userPrompt: 'user',
        schemaName: 'TestSchema'
      })
    ).resolves.toEqual({
      ok: true
    });
  });
});
