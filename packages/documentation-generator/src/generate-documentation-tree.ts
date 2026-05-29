import { AiProviderError, type AiProvider } from '@codebase-docs-ai/ai-orchestrator';
import { z } from 'zod';
import type {
  DocumentationPagePlan,
  DocumentationWarning,
  DocumentationPage,
  DocumentationTree,
  SourceReference,
  SystemMap
} from '@codebase-docs-ai/shared';
import { createDocumentationPlan } from './documentation-plan.js';

export interface GenerateDocumentationTreeInput {
  title: string;
  systemMap: SystemMap;
  aiProvider?: AiProvider;
}

export function generateDocumentationTree(input: GenerateDocumentationTreeInput): DocumentationTree {
  return generateDeterministicDocumentationTree(input);
}

export async function generateDocumentationTreeWithAi(
  input: GenerateDocumentationTreeInput
): Promise<DocumentationTree> {
  if (!input.aiProvider) {
    return generateDeterministicDocumentationTree(input);
  }

  const plan = createDocumentationPlan(input.systemMap);
  const pages = await Promise.all(
    plan.pages.map((pagePlan) => generateAiPage(input.aiProvider as AiProvider, pagePlan, input.systemMap))
  );

  return {
    title: input.title,
    summary: `Generated documentation for ${input.systemMap.sources.length} source input(s).`,
    pages,
    warnings: plan.warnings,
    sourceReferences: collectSystemReferences(input.systemMap),
    generatedAt: new Date().toISOString()
  };
}

function generateDeterministicDocumentationTree(input: GenerateDocumentationTreeInput): DocumentationTree {
  const plan = createDocumentationPlan(input.systemMap);
  const pages = plan.pages.map((pagePlan): DocumentationPage => {
    const markdown = renderPageMarkdown(pagePlan.key, pagePlan.title, input.systemMap);

    return {
      key: pagePlan.key,
      title: pagePlan.title,
      order: pagePlan.order,
      markdown,
      sourceReferences: collectPageReferences(pagePlan.key, input.systemMap),
      warnings: pagePlan.warnings
    };
  });

  return {
    title: input.title,
    summary: `Generated documentation for ${input.systemMap.sources.length} source input(s).`,
    pages,
    warnings: plan.warnings,
    sourceReferences: collectSystemReferences(input.systemMap),
    generatedAt: new Date().toISOString()
  };
}

async function generateAiPage(
  aiProvider: AiProvider,
  pagePlan: DocumentationPagePlan,
  systemMap: SystemMap
): Promise<DocumentationPage> {
  const deterministicMarkdown = renderPageMarkdown(pagePlan.key, pagePlan.title, systemMap);
  const aiPage = await aiProvider.generateObject<unknown>({
    systemPrompt: documentationPageSystemPrompt(),
    userPrompt: JSON.stringify(
      {
        page: {
          key: pagePlan.key,
          title: pagePlan.title,
          purpose: pagePlan.purpose,
          requiredEvidence: pagePlan.requiredEvidence
        },
        systemMap,
        deterministicDraft: deterministicMarkdown,
        styleGuide: {
          audience: 'software engineers maintaining the system',
          language: 'en',
          tone: 'clear, practical, source-aware',
          uncertaintyPhrase: 'The provided source inputs do not contain enough evidence to determine this.'
        }
      },
      null,
      2
    ),
    schemaName: 'DocumentationPage'
  });
  const parsed = aiDocumentationPageSchema.safeParse(aiPage);
  if (!parsed.success) {
    throw new AiProviderError(`AI page output is invalid for ${pagePlan.key}.`);
  }

  return {
    key: pagePlan.key,
    title: pagePlan.title,
    order: pagePlan.order,
    markdown: parsed.data.markdown,
    sourceReferences: normalizeSourceReferences(parsed.data.sourceReferences),
    warnings: mergeWarnings(pagePlan.warnings, parsed.data.warnings)
  };
}

function documentationPageSystemPrompt(): string {
  return [
    'You generate developer-facing project documentation from structured code analysis.',
    'Use only the provided JSON evidence and deterministic draft.',
    'Do not invent services, deployments, APIs, credentials, or business facts.',
    'If evidence is incomplete, say that explicitly.',
    'Return JSON only with key, title, markdown, sourceReferences, and warnings.'
  ].join('\n');
}

function renderPageMarkdown(key: string, title: string, systemMap: SystemMap): string {
  switch (key) {
    case 'overview':
      return renderOverview(title, systemMap);
    case 'source-inventory':
      return renderSourceInventory(title, systemMap);
    case 'api-contracts':
      return renderApiContracts(title, systemMap);
    case 'environment':
      return renderEnvironment(title, systemMap);
    case 'risks':
      return renderRisks(title, systemMap);
    case 'source-references':
      return renderSourceReferences(title, systemMap);
    default:
      return renderGenericPage(title, systemMap);
  }
}

function renderOverview(title: string, systemMap: SystemMap): string {
  const sourceRows = systemMap.sources
    .map((repository) => `| ${repository.source.name} | ${repository.source.role} |`)
    .join('\n');

  return `${heading(title)}

## Summary

This documentation was generated from ${systemMap.sources.length} source input(s).

## Sources

| Source | Role |
| --- | --- |
${sourceRows || '| Not detected | unknown |'}
`;
}

function renderSourceInventory(title: string, systemMap: SystemMap): string {
  const sections = systemMap.sources.map((repository) => {
    const frameworks = repository.frameworks.map((framework) => framework.name).join(', ') || 'None detected';
    const scripts = repository.scripts.map((script) => `\`${script.name}\``).join(', ') || 'None detected';

    return `## ${repository.source.name}

- Role: ${repository.source.role}
- Package manager: ${repository.packageManager.name}
- Frameworks: ${frameworks}
- Scripts: ${scripts}`;
  });

  return `${heading(title)}

${sections.join('\n\n') || 'No sources were provided.'}
`;
}

function renderApiContracts(title: string, systemMap: SystemMap): string {
  const rows = systemMap.apiContracts
    .map((contract) => {
      const consumer = contract.consumer
        ? `${contract.consumer.sourceName}:${contract.consumer.path}`
        : 'None';
      const provider = contract.provider
        ? `${contract.provider.sourceName}:${contract.provider.path}`
        : 'None';
      return `| ${contract.method} | ${contract.path} | ${contract.status} | ${consumer} | ${provider} |`;
    })
    .join('\n');

  return `${heading(title)}

| Method | Path | Status | Consumer | Provider |
| --- | --- | --- | --- | --- |
${rows || '| N/A | N/A | No API contracts detected | N/A | N/A |'}
`;
}

function renderEnvironment(title: string, systemMap: SystemMap): string {
  const envRows = systemMap.sources
    .flatMap((repository) =>
      repository.environmentVariables.map(
        (envVar) => `| ${envVar.name} | ${repository.source.name} | ${repository.source.role} |`
      )
    )
    .join('\n');

  const linkRows = systemMap.environmentLinks
    .map((link) => `| ${link.name} | ${link.sources.join(', ')} |`)
    .join('\n');

  return `${heading(title)}

## Detected Variables

| Name | Source | Role |
| --- | --- | --- |
${envRows || '| None detected | N/A | N/A |'}

## Cross-Source Links

| Name | Sources |
| --- | --- |
${linkRows || '| None detected | N/A |'}
`;
}

function renderRisks(title: string, systemMap: SystemMap): string {
  const risks = systemMap.risks.map((risk) => `- ${risk.level.toUpperCase()}: ${risk.message}`);
  const unknowns = systemMap.unknowns.map((unknown) => `- ${unknown.message}`);

  return `${heading(title)}

## Risks

${risks.join('\n') || 'No system risks were detected from the provided evidence.'}

## Unknowns

${unknowns.join('\n') || 'No system unknowns were detected from the provided evidence.'}
`;
}

function renderSourceReferences(title: string, systemMap: SystemMap): string {
  const references = collectSystemReferences(systemMap)
    .map((reference) => `- ${reference.sourceName}: ${reference.path}`)
    .join('\n');

  return `${heading(title)}

${references || 'No source references were detected.'}
`;
}

function renderGenericPage(title: string, systemMap: SystemMap): string {
  return `${heading(title)}

The provided source inputs contain ${systemMap.sources.length} repository map(s). This page will be expanded as the documentation generator becomes more specialized.
`;
}

function collectPageReferences(key: string, systemMap: SystemMap): SourceReference[] {
  if (key === 'api-contracts') {
    return dedupeReferences(
      systemMap.apiContracts.flatMap((contract) =>
        [contract.consumer, contract.provider].filter(isSourceReference)
      )
    );
  }

  if (key === 'environment') {
    return dedupeReferences(
      systemMap.sources.flatMap((repository) =>
        repository.environmentVariables.flatMap((envVar) => envVar.sourceReferences)
      )
    );
  }

  return collectSystemReferences(systemMap);
}

function collectSystemReferences(systemMap: SystemMap): SourceReference[] {
  return dedupeReferences(
    systemMap.sources.flatMap((repository) => [
      ...repository.packageManager.evidence,
      ...repository.frameworks.flatMap((framework) => framework.evidence),
      ...repository.scripts.map((script) => script.sourceReference),
      ...repository.dependencies.map((dependency) => dependency.sourceReference),
      ...repository.routes.map((route) => route.sourceReference),
      ...repository.apiEndpoints.map((endpoint) => endpoint.sourceReference),
      ...repository.apiClientCalls.map((call) => call.sourceReference),
      ...repository.environmentVariables.flatMap((envVar) => envVar.sourceReferences),
      ...repository.configFiles.map((configFile) => configFile.sourceReference)
    ])
  );
}

function dedupeReferences(sourceReferences: SourceReference[]): SourceReference[] {
  const keys = new Set<string>();
  const deduped: SourceReference[] = [];

  for (const sourceReference of sourceReferences) {
    const key = `${sourceReference.sourceName}:${sourceReference.path}`;
    if (keys.has(key)) {
      continue;
    }

    keys.add(key);
    deduped.push(sourceReference);
  }

  return deduped;
}

function isSourceReference(value: SourceReference | undefined): value is SourceReference {
  return Boolean(value);
}

function heading(title: string): string {
  return `# ${title}`;
}

const sourceReferenceSchema = z.object({
  sourceName: z.string().min(1),
  path: z.string().min(1),
  line: z.number().int().positive().optional()
});

const documentationWarningSchema = z.object({
  level: z.enum(['low', 'medium', 'high']),
  message: z.string().min(1),
  sourceReferences: z.array(sourceReferenceSchema).optional()
});

const aiDocumentationPageSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  markdown: z.string().min(1),
  sourceReferences: z.array(sourceReferenceSchema).default([]),
  warnings: z.array(documentationWarningSchema).default([])
});

type ParsedSourceReference = z.infer<typeof sourceReferenceSchema>;
type ParsedDocumentationWarning = z.infer<typeof documentationWarningSchema>;

function normalizeSourceReferences(sourceReferences: ParsedSourceReference[]): SourceReference[] {
  return sourceReferences.map((sourceReference) => ({
    sourceName: sourceReference.sourceName,
    path: sourceReference.path,
    ...(sourceReference.line ? { line: sourceReference.line } : {})
  }));
}

function mergeWarnings(
  planWarnings: DocumentationWarning[],
  aiWarnings: ParsedDocumentationWarning[]
): DocumentationWarning[] {
  return [...planWarnings, ...aiWarnings].map((warning) => ({
    level: warning.level,
    message: warning.message,
    ...(warning.sourceReferences ? { sourceReferences: normalizeSourceReferences(warning.sourceReferences) } : {})
  }));
}
