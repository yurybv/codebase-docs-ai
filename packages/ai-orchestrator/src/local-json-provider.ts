import type { AiProvider, GenerateObjectInput } from './ai-provider.js';

export type LocalJsonResolver = (input: GenerateObjectInput) => unknown;

export class LocalJsonProvider implements AiProvider {
  readonly name = 'local-json';

  constructor(private readonly resolve: LocalJsonResolver) {}

  async generateObject<TOutput>(input: GenerateObjectInput): Promise<TOutput> {
    return this.resolve(input) as TOutput;
  }
}
