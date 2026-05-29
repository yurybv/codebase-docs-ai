import type { DocumentationRunOptions, SourceInputMetadata } from '@codebase-docs-ai/shared';

export interface CreateDocumentationEngineRunInput {
  name: string;
  sources: SourceInputMetadata[];
  options: DocumentationRunOptions;
}

export interface DocumentationEngineRunPlan {
  name: string;
  sourceCount: number;
  sourceRoles: string[];
  outputFormats: string[];
}

export class DocumentationEngine {
  createRunPlan(input: CreateDocumentationEngineRunInput): DocumentationEngineRunPlan {
    const uniqueRoles = [...new Set(input.sources.map((source) => source.role))];

    return {
      name: input.name,
      sourceCount: input.sources.length,
      sourceRoles: uniqueRoles,
      outputFormats: input.options.outputFormats
    };
  }
}
