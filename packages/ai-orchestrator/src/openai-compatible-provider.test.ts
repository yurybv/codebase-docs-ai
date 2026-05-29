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
