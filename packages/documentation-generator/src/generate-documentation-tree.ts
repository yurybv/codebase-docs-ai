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
    markdown: sanitizeGeneratedText(parsed.data.markdown),
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
    case 'system-architecture':
      return renderSystemArchitecture(title, systemMap);
    case 'source-inventory':
      return renderSourceInventory(title, systemMap);
    case 'frontend':
      return renderRolePage(title, systemMap, 'frontend');
    case 'backend':
      return renderRolePage(title, systemMap, 'backend');
    case 'api-contracts':
      return renderApiContracts(title, systemMap);
    case 'auth':
      return renderAuth(title, systemMap);
    case 'environment':
      return renderEnvironment(title, systemMap);
    case 'local-development':
      return renderLocalDevelopment(title, systemMap);
    case 'testing':
      return renderTesting(title, systemMap);
    case 'build-deployment':
      return renderBuildDeployment(title, systemMap);
    case 'external-integrations':
      return renderExternalIntegrations(title, systemMap);
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
    .map((repository) => `| ${formatText(repository.source.name)} | ${repository.source.role} |`)
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

function renderSystemArchitecture(title: string, systemMap: SystemMap): string {
  const relationshipRows = systemMap.relationships
    .map(
      (relationship) =>
        `| ${relationship.kind} | ${formatText(relationship.fromSource)} | ${formatText(relationship.toSource)} | ${relationship.confidence} | ${formatReferences(relationship.evidence)} |`
    )
    .join('\n');
  const sourceRows = systemMap.sources
    .map((repository) => {
      const frameworks = repository.frameworks.map((framework) => framework.name).join(', ') || 'None detected';
      return `| ${formatText(repository.source.name)} | ${repository.source.role} | ${frameworks} | ${repository.packageManager.name} |`;
    })
    .join('\n');

  return `${heading(title)}

## Source Roles

| Source | Role | Frameworks | Package manager |
| --- | --- | --- | --- |
${sourceRows || '| None detected | N/A | N/A | N/A |'}

## Detected Relationships

| Kind | From | To | Confidence | Evidence |
| --- | --- | --- | --- | --- |
${relationshipRows || '| None detected | N/A | N/A | N/A | N/A |'}
`;
}

function renderSourceInventory(title: string, systemMap: SystemMap): string {
  const sections = systemMap.sources.map((repository) => {
    const frameworks = repository.frameworks.map((framework) => framework.name).join(', ') || 'None detected';
    const scripts = repository.scripts.map((script) => `\`${script.name}\``).join(', ') || 'None detected';

    return `## ${formatText(repository.source.name)}

- Role: ${repository.source.role}
- Package manager: ${repository.packageManager.name}
- Frameworks: ${frameworks}
- Scripts: ${scripts}`;
  });

  return `${heading(title)}

${sections.join('\n\n') || 'No sources were provided.'}
`;
}

function renderRolePage(title: string, systemMap: SystemMap, role: 'frontend' | 'backend'): string {
  const repositories = systemMap.sources.filter((repository) => repository.source.role === role);
  const sections = repositories.map((repository) => {
    const frameworkRows = repository.frameworks
      .map((framework) => `| ${framework.name} | ${framework.category} | ${formatReferences(framework.evidence)} |`)
      .join('\n');
    const scriptRows = repository.scripts
      .map((script) => `| ${script.name} | \`${script.command}\` | ${formatReference(script.sourceReference)} |`)
      .join('\n');
    const routeRows = repository.routes
      .map((route) => `| ${route.kind} | ${route.path} | ${formatReference(route.sourceReference)} |`)
      .join('\n');
    const endpointRows = repository.apiEndpoints
      .map(
        (endpoint) =>
          `| ${endpoint.method} | ${endpoint.path} | ${endpoint.controller ?? 'N/A'} | ${formatReference(endpoint.sourceReference)} |`
      )
      .join('\n');
    const apiCallRows = repository.apiClientCalls
      .map((call) => `| ${call.method} | ${call.path} | ${formatReference(call.sourceReference)} |`)
      .join('\n');

    return `## ${formatText(repository.source.name)}

### Framework Evidence

| Framework | Category | Evidence |
| --- | --- | --- |
${frameworkRows || '| None detected | N/A | N/A |'}

### Scripts

| Script | Command | Evidence |
| --- | --- | --- |
${scriptRows || '| None detected | N/A | N/A |'}

${role === 'frontend' ? frontendSpecificContent(routeRows, apiCallRows) : backendSpecificContent(endpointRows)}
`;
  });

  return `${heading(title)}

${sections.join('\n\n') || `No ${role} source was provided or detected.`}
`;
}

function frontendSpecificContent(routeRows: string, apiCallRows: string): string {
  return `### Routes

| Kind | Path | Evidence |
| --- | --- | --- |
${routeRows || '| None detected | N/A | N/A |'}

### API Calls

| Method | Path | Evidence |
| --- | --- | --- |
${apiCallRows || '| None detected | N/A | N/A |'}`;
}

function backendSpecificContent(endpointRows: string): string {
  return `### API Endpoints

| Method | Path | Controller | Evidence |
| --- | --- | --- | --- |
${endpointRows || '| None detected | N/A | N/A | N/A |'}`;
}

function renderApiContracts(title: string, systemMap: SystemMap): string {
  const rows = systemMap.apiContracts
    .map((contract) => {
      const consumer = contract.consumer ? formatReference(contract.consumer) : 'None';
      const provider = contract.provider ? formatReference(contract.provider) : 'None';
      return `| ${contract.method} | ${contract.path} | ${contract.status} | ${consumer} | ${provider} |`;
    })
    .join('\n');

  return `${heading(title)}

| Method | Path | Status | Consumer | Provider |
| --- | --- | --- | --- | --- |
${rows || '| N/A | N/A | No API contracts detected | N/A | N/A |'}
`;
}

function renderAuth(title: string, systemMap: SystemMap): string {
  const rows = systemMap.authFlows
    .map(
      (flow) =>
        `| ${flow.kind} | ${flow.sources.map(formatText).join(', ')} | ${flow.confidence} | ${formatReferences(flow.evidence)} |`
    )
    .join('\n');

  return `${heading(title)}

## Detected Auth Evidence

| Kind | Sources | Confidence | Evidence |
| --- | --- | --- | --- |
${rows || '| None detected | N/A | N/A | N/A |'}

## Notes

${rows ? 'Auth documentation is based on dependency and source evidence only. Review route guards, middleware, session handling, and permissions manually before relying on this section for security decisions.' : 'The provided source inputs do not contain enough evidence to determine authentication or authorization behavior.'}
`;
}

function renderEnvironment(title: string, systemMap: SystemMap): string {
  const envRows = systemMap.sources
    .flatMap((repository) =>
      repository.environmentVariables.map(
        (envVar) => `| ${formatText(envVar.name)} | ${formatText(repository.source.name)} | ${repository.source.role} |`
      )
    )
    .join('\n');

  const linkRows = systemMap.environmentLinks
    .map((link) => `| ${formatText(link.name)} | ${link.sources.map(formatText).join(', ')} |`)
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

function renderLocalDevelopment(title: string, systemMap: SystemMap): string {
  const sections = systemMap.sources.map((repository) => {
    const installCommand = installCommandForPackageManager(repository.packageManager.name);
    const startScripts = scriptsMatching(repository, ['dev', 'start', 'serve']);
    const setupRows = startScripts
      .map((script) => `| ${script.name} | \`${script.command}\` | ${formatReference(script.sourceReference)} |`)
      .join('\n');

    return `## ${formatText(repository.source.name)}

- Package manager: ${repository.packageManager.name}
- Suggested install command: \`${installCommand}\`

| Start script | Command | Evidence |
| --- | --- | --- |
${setupRows || '| None detected | N/A | N/A |'}`;
  });

  return `${heading(title)}

${sections.join('\n\n') || 'No source scripts were detected.'}
`;
}

function renderTesting(title: string, systemMap: SystemMap): string {
  const sections = systemMap.sources.map((repository) => {
    const testScripts = scriptsMatching(repository, ['test', 'unit', 'integration', 'e2e', 'spec']);
    const rows = testScripts
      .map((script) => `| ${script.name} | \`${script.command}\` | ${formatReference(script.sourceReference)} |`)
      .join('\n');

    return `## ${formatText(repository.source.name)}

| Test script | Command | Evidence |
| --- | --- | --- |
${rows || '| None detected | N/A | N/A |'}`;
  });

  return `${heading(title)}

${sections.join('\n\n') || 'No source scripts were detected.'}

## Gaps

${systemMap.sources.some((repository) => scriptsMatching(repository, ['test', 'unit', 'integration', 'e2e', 'spec']).length === 0) ? 'At least one source does not expose an obvious test script in package metadata.' : 'Detected sources expose test-related scripts.'}
`;
}

function renderBuildDeployment(title: string, systemMap: SystemMap): string {
  const sections = systemMap.sources.map((repository) => {
    const buildScripts = scriptsMatching(repository, ['build', 'compile', 'deploy', 'docker']);
    const scriptRows = buildScripts
      .map((script) => `| ${script.name} | \`${script.command}\` | ${formatReference(script.sourceReference)} |`)
      .join('\n');
    const configRows = repository.configFiles
      .map((configFile) => `| ${configFile.kind} | ${formatReference(configFile.sourceReference)} |`)
      .join('\n');

    return `## ${formatText(repository.source.name)}

### Build And Deployment Scripts

| Script | Command | Evidence |
| --- | --- | --- |
${scriptRows || '| None detected | N/A | N/A |'}

### Deployment-Relevant Config

| Kind | Evidence |
| --- | --- |
${configRows || '| None detected | N/A |'}`;
  });

  return `${heading(title)}

${sections.join('\n\n') || 'No build or deployment evidence was detected.'}
`;
}

function renderExternalIntegrations(title: string, systemMap: SystemMap): string {
  const integrationRows = systemMap.integrations
    .map(
      (integration) =>
        `| ${formatText(integration.name)} | ${integration.sources.map(formatText).join(', ')} | ${formatReferences(integration.evidence)} |`
    )
    .join('\n');
  const dependencyRows = systemMap.sources
    .flatMap((repository) =>
      repository.dependencies
        .filter((dependency) => likelyIntegrationDependency(dependency.name))
        .map(
          (dependency) =>
            `| ${formatText(dependency.name)} | ${formatText(repository.source.name)} | ${dependency.scope} | ${formatReference(dependency.sourceReference)} |`
        )
    )
    .join('\n');

  return `${heading(title)}

## Detected Integrations

| Integration | Sources | Evidence |
| --- | --- | --- |
${integrationRows || '| None detected | N/A | N/A |'}

## Integration-Like Dependencies

| Dependency | Source | Scope | Evidence |
| --- | --- | --- | --- |
${dependencyRows || '| None detected | N/A | N/A | N/A |'}
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
    .map((reference) => `- ${formatReference(reference)}`)
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

function installCommandForPackageManager(packageManager: string): string {
  switch (packageManager) {
    case 'pnpm':
      return 'pnpm install';
    case 'yarn':
      return 'yarn install';
    case 'bun':
      return 'bun install';
    case 'npm':
      return 'npm install';
    default:
      return 'Install dependencies with the package manager used by the source.';
  }
}

function scriptsMatching(
  repository: SystemMap['sources'][number],
  keywords: string[]
): SystemMap['sources'][number]['scripts'] {
  return repository.scripts.filter((script) =>
    keywords.some((keyword) => script.name.toLowerCase().includes(keyword))
  );
}

function likelyIntegrationDependency(dependencyName: string): boolean {
  return [
    'stripe',
    'sentry',
    'firebase',
    'aws-sdk',
    '@aws-sdk/',
    'twilio',
    'sendgrid',
    'mailgun',
    'prisma',
    'mongoose',
    'typeorm',
    'redis',
    'bull',
    'amqp',
    'kafka',
    'openai',
    '@octokit/'
  ].some((candidate) => dependencyName.includes(candidate));
}

function formatReference(sourceReference: SourceReference): string {
  return `${formatText(sourceReference.sourceName)}:${formatText(sourceReference.path)}`;
}

function formatReferences(sourceReferences: SourceReference[]): string {
  return sourceReferences.map(formatReference).join(', ') || 'N/A';
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

  if (key === 'system-architecture') {
    return dedupeReferences([
      ...collectSystemReferences(systemMap),
      ...systemMap.relationships.flatMap((relationship) => relationship.evidence)
    ]);
  }

  if (key === 'frontend' || key === 'backend') {
    const role = key;
    return dedupeReferences(
      systemMap.sources
        .filter((repository) => repository.source.role === role)
        .flatMap((repository) => [
          ...repository.frameworks.flatMap((framework) => framework.evidence),
          ...repository.scripts.map((script) => script.sourceReference),
          ...repository.routes.map((route) => route.sourceReference),
          ...repository.apiEndpoints.map((endpoint) => endpoint.sourceReference),
          ...repository.apiClientCalls.map((call) => call.sourceReference)
        ])
    );
  }

  if (key === 'auth') {
    return dedupeReferences(systemMap.authFlows.flatMap((flow) => flow.evidence));
  }

  if (key === 'local-development' || key === 'testing' || key === 'build-deployment') {
    return dedupeReferences(
      systemMap.sources.flatMap((repository) => [
        ...repository.scripts.map((script) => script.sourceReference),
        ...repository.configFiles.map((configFile) => configFile.sourceReference)
      ])
    );
  }

  if (key === 'external-integrations') {
    return dedupeReferences([
      ...systemMap.integrations.flatMap((integration) => integration.evidence),
      ...systemMap.sources.flatMap((repository) =>
        repository.dependencies
          .filter((dependency) => likelyIntegrationDependency(dependency.name))
          .map((dependency) => dependency.sourceReference)
      )
    ]);
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
    const sanitizedReference = {
      ...sourceReference,
      sourceName: formatText(sourceReference.sourceName),
      path: formatText(sourceReference.path)
    };
    const key = `${sanitizedReference.sourceName}:${sanitizedReference.path}`;
    if (keys.has(key)) {
      continue;
    }

    keys.add(key);
    deduped.push(sanitizedReference);
  }

  return deduped;
}

function isSourceReference(value: SourceReference | undefined): value is SourceReference {
  return Boolean(value);
}

function heading(title: string): string {
  return `# ${title}`;
}

function formatText(value: string): string {
  return sanitizeGeneratedText(value);
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
    sourceName: sanitizeGeneratedText(sourceReference.sourceName),
    path: sanitizeGeneratedText(sourceReference.path),
    ...(sourceReference.line ? { line: sourceReference.line } : {})
  }));
}

function mergeWarnings(
  planWarnings: DocumentationWarning[],
  aiWarnings: ParsedDocumentationWarning[]
): DocumentationWarning[] {
  return [...planWarnings, ...aiWarnings].map((warning) => ({
    level: warning.level,
    message: sanitizeGeneratedText(warning.message),
    ...(warning.sourceReferences ? { sourceReferences: normalizeSourceReferences(warning.sourceReferences) } : {})
  }));
}

function sanitizeGeneratedText(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, '[REDACTED_OPENAI_API_KEY]')
    .replace(/\.env(?:\.[A-Za-z0-9_-]+)?/g, '[REDACTED_DENIED_FILE]')
    .replace(/SHOULD_NOT_APPEAR/g, '[REDACTED_DENIED_VALUE]');
}
