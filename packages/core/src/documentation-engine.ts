import { readFile } from 'node:fs/promises';
import type { AiProvider } from '@codebase-docs-ai/ai-orchestrator';
import { generateDocumentationTreeWithAi } from '@codebase-docs-ai/documentation-generator';
import { renderJson, renderMarkdownTree, renderSingleMarkdown } from '@codebase-docs-ai/renderers';
import { analyzeRepository } from '@codebase-docs-ai/repo-analyzer';
import { filterLoadedSource, redactSecrets } from '@codebase-docs-ai/security';
import { analyzeSystem } from '@codebase-docs-ai/system-analyzer';
import type {
  DocumentationOutputFormat,
  DocumentationRunOptions,
  DocumentationTree,
  LoadedSource,
  RenderedDocumentation,
  RepositoryMap,
  SourceFile,
  SourceInputMetadata,
  SystemMap
} from '@codebase-docs-ai/shared';

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

export interface GenerateDocumentationInput {
  title: string;
  loadedSources: LoadedSource[];
  options: DocumentationRunOptions;
}

export interface GenerateDocumentationResult {
  repositoryMaps: RepositoryMap[];
  systemMap: SystemMap;
  documentationTree: DocumentationTree;
  rendered: Map<DocumentationOutputFormat, RenderedDocumentation>;
}

export interface DocumentationEngineConfig {
  aiProvider?: AiProvider;
}

export class DocumentationEngine {
  constructor(private readonly config: DocumentationEngineConfig = {}) {}

  createRunPlan(input: CreateDocumentationEngineRunInput): DocumentationEngineRunPlan {
    const uniqueRoles = [...new Set(input.sources.map((source) => source.role))];

    return {
      name: input.name,
      sourceCount: input.sources.length,
      sourceRoles: uniqueRoles,
      outputFormats: input.options.outputFormats
    };
  }

  async generateDocumentation(
    input: GenerateDocumentationInput
  ): Promise<GenerateDocumentationResult> {
    try {
      const repositoryMaps = await Promise.all(
        input.loadedSources.map((loadedSource) => {
          const filteredSource = filterLoadedSource(loadedSource);
          return analyzeRepository({
            source: loadedSource.source,
            rootPath: loadedSource.rootPath,
            files: filteredSource.includedFiles,
            readTextFile: readRedactedSourceFile
          });
        })
      );
      const systemMap = analyzeSystem({
        repositories: repositoryMaps
      });
      const documentationTree = await generateDocumentationTreeWithAi({
        title: input.title,
        systemMap,
        ...(this.config.aiProvider ? { aiProvider: this.config.aiProvider } : {})
      });

      return {
        repositoryMaps,
        systemMap,
        documentationTree,
        rendered: renderDocumentation(documentationTree, input.options.outputFormats)
      };
    } catch (error) {
      throw sanitizeCoreGenerationError(error);
    }
  }
}

async function readRedactedSourceFile(file: SourceFile): Promise<string> {
  const content = await readFile(file.absolutePath, 'utf8');
  return redactSecrets(content).text;
}

function sanitizeCoreGenerationError(error: unknown): Error {
  const message =
    error instanceof Error && error.message.length > 0
      ? sanitizePublicString(error.message, 'Documentation generation failed.')
      : 'Documentation generation failed.';

  return new Error(message);
}

function sanitizePublicString(value: string, fallback: string): string {
  const sanitized = value
    .replace(/\bsk-[A-Za-z0-9_-]{20,}\b/g, '[REDACTED_OPENAI_API_KEY]')
    .replace(/\.env(?:\.[A-Za-z0-9_-]+)?/g, '[REDACTED_DENIED_FILE]')
    .replace(/SHOULD_NOT_APPEAR/g, '[REDACTED_DENIED_VALUE]');

  return sanitized.length > 0 ? sanitized : fallback;
}

export function renderDocumentation(
  documentationTree: DocumentationTree,
  outputFormats: DocumentationOutputFormat[]
): Map<DocumentationOutputFormat, RenderedDocumentation> {
  const rendered = new Map<DocumentationOutputFormat, RenderedDocumentation>();

  for (const format of outputFormats) {
    if (format === 'markdown-tree') {
      rendered.set(format, renderMarkdownTree(documentationTree));
    }

    if (format === 'single-markdown') {
      rendered.set(format, renderSingleMarkdown(documentationTree));
    }

    if (format === 'json') {
      rendered.set(format, renderJson(documentationTree));
    }
  }

  return rendered;
}
