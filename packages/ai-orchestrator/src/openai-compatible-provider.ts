import { z } from 'zod';
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
    const response = await this.fetchClient(`${this.baseUrl}/chat/completions`, {
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

    if (!response.ok) {
      throw new AiProviderError(`AI provider request failed with status ${response.status}.`);
    }

    const parsedResponse = chatCompletionResponseSchema.safeParse(await response.json());
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
  if (!apiKey || !model) {
    return undefined;
  }

  const config: OpenAiCompatibleProviderConfig = {
    apiKey,
    model
  };
  if (env.DOCS_AI_OPENAI_BASE_URL) {
    config.baseUrl = env.DOCS_AI_OPENAI_BASE_URL;
  }
  if (env.DOCS_AI_OPENAI_TEMPERATURE) {
    config.temperature = Number.parseFloat(env.DOCS_AI_OPENAI_TEMPERATURE);
  }

  return new OpenAiCompatibleProvider(config);
}

function parseJsonContent<TOutput>(content: string): TOutput {
  try {
    return JSON.parse(content) as TOutput;
  } catch {
    throw new AiProviderError('AI provider response content was not valid JSON.');
  }
}
