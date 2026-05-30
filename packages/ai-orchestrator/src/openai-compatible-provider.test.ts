import { describe, expect, it, vi } from 'vitest';
import {
  createOpenAiCompatibleProviderFromEnv,
  OpenAiCompatibleProvider,
  OpenAiCompatibleProviderConfigurationError
} from './openai-compatible-provider.js';

describe('OpenAiCompatibleProvider', () => {
  it('calls a chat completions compatible endpoint and parses JSON content', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  ok: true
                })
              }
            }
          ]
        }),
        {
          status: 200
        }
      )
    );
    const provider = new OpenAiCompatibleProvider({
      apiKey: 'test-key',
      model: 'test-model',
      baseUrl: 'https://example.test/v1/',
      fetch: fetchMock
    });

    await expect(
      provider.generateObject<{ ok: boolean }>({
        systemPrompt: 'system',
        userPrompt: 'user',
        schemaName: 'TestSchema'
      })
    ).resolves.toEqual({
      ok: true
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/v1/chat/completions',
      expect.objectContaining({
        method: 'POST'
      })
    );
  });

  it('sanitizes secret-bearing provider transport errors', async () => {
    const rawOpenAiKey = `sk-${'z'.repeat(24)}`;
    const embeddedOpenAiKey = `prefix_${rawOpenAiKey}`;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(
        new Error(`Provider transport failed for ${embeddedOpenAiKey} from .env SHOULD_NOT_APPEAR.`)
      );
    const provider = new OpenAiCompatibleProvider({
      apiKey: 'test-key',
      model: 'test-model',
      baseUrl: 'https://example.test/v1/',
      fetch: fetchMock
    });

    try {
      await provider.generateObject<{ ok: boolean }>({
        systemPrompt: 'system',
        userPrompt: 'user',
        schemaName: 'TestSchema'
      });
      throw new Error('Expected provider request to fail.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain('[REDACTED_OPENAI_API_KEY]');
      expect(message).toContain('[REDACTED_DENIED_FILE]');
      expect(message).toContain('[REDACTED_DENIED_VALUE]');
      expect(message).not.toContain(rawOpenAiKey);
      expect(message).not.toContain('SHOULD_NOT_APPEAR');
      expect(message).not.toContain('.env');
    }
  });

  it('creates a provider only when key and model are configured', () => {
    expect(createOpenAiCompatibleProviderFromEnv({})).toBeUndefined();
    expect(
      createOpenAiCompatibleProviderFromEnv({
        DOCS_AI_OPENAI_API_KEY: 'test-key',
        DOCS_AI_OPENAI_MODEL: 'test-model'
      })
    ).toBeInstanceOf(OpenAiCompatibleProvider);
  });

  it('fails fast when provider configuration is partial', () => {
    expect(() =>
      createOpenAiCompatibleProviderFromEnv({
        DOCS_AI_OPENAI_API_KEY: 'test-key'
      })
    ).toThrow(OpenAiCompatibleProviderConfigurationError);
    expect(() =>
      createOpenAiCompatibleProviderFromEnv({
        DOCS_AI_OPENAI_MODEL: 'test-model'
      })
    ).toThrow(OpenAiCompatibleProviderConfigurationError);
  });

  it('validates optional provider configuration values', () => {
    expect(() =>
      createOpenAiCompatibleProviderFromEnv({
        DOCS_AI_OPENAI_API_KEY: 'test-key',
        DOCS_AI_OPENAI_MODEL: 'test-model',
        DOCS_AI_OPENAI_BASE_URL: 'file:///tmp/provider'
      })
    ).toThrow('DOCS_AI_OPENAI_BASE_URL must use http or https.');
    expect(() =>
      createOpenAiCompatibleProviderFromEnv({
        DOCS_AI_OPENAI_API_KEY: 'test-key',
        DOCS_AI_OPENAI_MODEL: 'test-model',
        DOCS_AI_OPENAI_TEMPERATURE: 'high'
      })
    ).toThrow('DOCS_AI_OPENAI_TEMPERATURE must be a number between 0 and 2.');
  });
});
