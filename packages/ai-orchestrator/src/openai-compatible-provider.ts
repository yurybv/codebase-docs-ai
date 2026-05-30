import { z } from 'zod';
import { sanitizePublicText } from '@codebase-docs-ai/security';
import type { AiProvider, GenerateObjectInput } from './ai-provider.js';
import { AiProviderError } from './ai-provider.js';

export interface OpenAiCompatibleProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  temperature?: number;
}

const chatCompletionResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string().nullable()
      })
    })
  )
});

export class OpenAiCompatibleProvider implements AiProvider {
  readonly name = 'openai-compatible';

  private readonly baseUrl: string;
  private readonly fetchClient: typeof fetch;
  private readonly temperature: number;

  constructor(private readonly config: OpenAiCompatibleProviderConfig) {
    this.baseUrl = (config.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.fetchClient = config.fetch ?? fetch;
    this.temperature = config.temperature ?? 0.2;
  }

  async generateObject<TOutput>(input: GenerateObjectInput): Promise<TOutput> {
    let response: Response;
    try {
      response = await this.fetchClient(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: this.temperature,
          response_format: {
            type: 'json_object'
          },
          messages: [
            {
              role: 'system',
              content: `${input.systemPrompt}\n\nReturn only valid JSON for schema ${input.schemaName}.`
            },
            {
              role: 'user',
              content: input.userPrompt
            }
          ]
        })
      });
    } catch (error) {
      throw new AiProviderError(
        `AI provider request failed: ${sanitizeProviderErrorMessage(error)}`
      );
    }

    if (!response.ok) {
      throw new AiProviderError(`AI provider request failed with status ${response.status}.`);
    }

    let responseBody: unknown;
    try {
      responseBody = await response.json();
    } catch (error) {
      throw new AiProviderError(
        `AI provider response could not be parsed: ${sanitizeProviderErrorMessage(error)}`
      );
    }

    const parsedResponse = chatCompletionResponseSchema.safeParse(responseBody);
    if (!parsedResponse.success) {
      throw new AiProviderError('AI provider response did not match the expected chat completion shape.');
    }

    const content = parsedResponse.data.choices[0]?.message.content;
    if (!content) {
      throw new AiProviderError('AI provider response did not contain JSON content.');
    }

    return parseJsonContent<TOutput>(content);
  }
}

export function createOpenAiCompatibleProviderFromEnv(
  env: Record<string, string | undefined> = process.env
): OpenAiCompatibleProvider | undefined {
  const apiKey = env.DOCS_AI_OPENAI_API_KEY ?? env.OPENAI_API_KEY;
  const model = env.DOCS_AI_OPENAI_MODEL ?? env.OPENAI_MODEL;
  const baseUrl = env.DOCS_AI_OPENAI_BASE_URL;
  const temperature = env.DOCS_AI_OPENAI_TEMPERATURE;

  if (!apiKey && !model && !baseUrl && !temperature) {
    return undefined;
  }

  if (!apiKey) {
    throw new OpenAiCompatibleProviderConfigurationError(
      'DOCS_AI_OPENAI_API_KEY or OPENAI_API_KEY is required when AI provider configuration is present.'
    );
  }

  if (!model) {
    throw new OpenAiCompatibleProviderConfigurationError(
      'DOCS_AI_OPENAI_MODEL or OPENAI_MODEL is required when AI provider configuration is present.'
    );
  }

  const config: OpenAiCompatibleProviderConfig = {
    apiKey,
    model
  };
  if (baseUrl) {
    assertValidBaseUrl(baseUrl);
    config.baseUrl = baseUrl;
  }
  if (temperature) {
    config.temperature = parseTemperature(temperature);
  }

  return new OpenAiCompatibleProvider(config);
}

export class OpenAiCompatibleProviderConfigurationError extends AiProviderError {
  constructor(message: string) {
    super(message);
    this.name = 'OpenAiCompatibleProviderConfigurationError';
  }
}

function parseJsonContent<TOutput>(content: string): TOutput {
  try {
    return JSON.parse(content) as TOutput;
  } catch {
    throw new AiProviderError('AI provider response content was not valid JSON.');
  }
}

function assertValidBaseUrl(baseUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new OpenAiCompatibleProviderConfigurationError(
      'DOCS_AI_OPENAI_BASE_URL must be a valid URL.'
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new OpenAiCompatibleProviderConfigurationError(
      'DOCS_AI_OPENAI_BASE_URL must use http or https.'
    );
  }
}

function parseTemperature(value: string): number {
  const temperature = Number.parseFloat(value);
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    throw new OpenAiCompatibleProviderConfigurationError(
      'DOCS_AI_OPENAI_TEMPERATURE must be a number between 0 and 2.'
    );
  }

  return temperature;
}

function sanitizeProviderErrorMessage(error: unknown): string {
  const message = error instanceof Error && error.message.length > 0 ? error.message : 'Request failed.';
  return sanitizePublicText(message, { fallback: 'Request failed.' });
}
