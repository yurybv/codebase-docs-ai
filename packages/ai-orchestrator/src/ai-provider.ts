export interface GenerateObjectInput {
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
}

export interface AiProvider {
  name: string;
  generateObject<TOutput>(input: GenerateObjectInput): Promise<TOutput>;
}

export class AiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiProviderError';
  }
}
