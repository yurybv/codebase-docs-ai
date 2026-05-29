import type {
  ApiClientCallInfo,
  ApiContract,
  ApiEndpointInfo,
  AuthFlow,
  EnvironmentLink,
  IntegrationPoint,
  RepositoryMap,
  SourceReference,
  SourceRelationship,
  SystemMap,
  SystemRisk,
  SystemUnknown
} from '@codebase-docs-ai/shared';

export interface AnalyzeSystemInput {
  repositories: RepositoryMap[];
}

const knownIntegrationDependencies = new Map<string, string>([
  ['@prisma/client', 'Prisma'],
  ['prisma', 'Prisma'],
  ['stripe', 'Stripe'],
  ['@stripe/', 'Stripe'],
  ['@sentry/node', 'Sentry'],
  ['@sentry/react', 'Sentry'],
  ['@sentry/nextjs', 'Sentry'],
  ['axios', 'Axios'],
  ['next-auth', 'NextAuth'],
  ['passport', 'Passport'],
  ['@nestjs/passport', 'NestJS Passport'],
  ['jsonwebtoken', 'JWT'],
  ['@nestjs/jwt', 'NestJS JWT'],
  ['@auth/', 'Auth.js'],
  ['@clerk/', 'Clerk'],
  ['@auth0/', 'Auth0'],
  ['firebase', 'Firebase'],
  ['@supabase/', 'Supabase'],
  ['@aws-sdk/', 'AWS SDK'],
  ['aws-sdk', 'AWS SDK'],
  ['openai', 'OpenAI'],
  ['@sendgrid/', 'SendGrid'],
  ['nodemailer', 'Nodemailer'],
  ['twilio', 'Twilio'],
  ['redis', 'Redis'],
  ['ioredis', 'Redis'],
  ['bullmq', 'BullMQ'],
  ['kafkajs', 'Kafka']
]);

const knownAuthDependencies = new Map<string, string>([
  ['next-auth', 'next-auth'],
  ['passport', 'passport'],
  ['@nestjs/passport', 'passport'],
  ['jsonwebtoken', 'jwt'],
  ['@nestjs/jwt', 'jwt'],
  ['@auth/', 'auth.js'],
  ['@clerk/', 'clerk'],
  ['@auth0/', 'auth0'],
  ['firebase', 'firebase-auth'],
  ['@supabase/', 'supabase-auth']
]);

export function analyzeSystem(input: AnalyzeSystemInput): SystemMap {
  const apiContracts = buildApiContracts(input.repositories);
  const environmentLinks = buildEnvironmentLinks(input.repositories);

  return {
    sources: input.repositories,
    relationships: buildRelationships(input.repositories, apiContracts, environmentLinks),
    apiContracts,
    authFlows: detectAuthFlows(input.repositories),
    environmentLinks,
    integrations: detectIntegrations(input.repositories),
    risks: buildSystemRisks(apiContracts),
    unknowns: buildSystemUnknowns(input.repositories),
    generatedAt: new Date().toISOString()
  };
}

function buildApiContracts(repositories: RepositoryMap[]): ApiContract[] {
  const providers = repositories.flatMap((repository) =>
    repository.apiEndpoints.map((endpoint) => ({
      repository,
      endpoint
    }))
  );
  const consumers = repositories.flatMap((repository) =>
    repository.apiClientCalls.map((call) => ({
      repository,
      call
    }))
  );

  const contracts: ApiContract[] = consumers.map(({ call }) => {
    const provider = providers.find(({ endpoint }) => apiCallMatchesEndpoint(call, endpoint));
    const baseContract = {
      method: call.method,
      path: call.path,
      consumer: call.sourceReference
    };

    return provider
      ? {
          ...baseContract,
          provider: provider.endpoint.sourceReference,
          status: 'matched'
        }
      : {
          ...baseContract,
          status: 'consumer-only'
        };
  });

  const matchedProviderKeys = new Set(
    contracts
      .filter((contract) => contract.provider)
      .map((contract) => `${contract.provider?.sourceName}:${contract.provider?.path}`)
  );

  const providerOnlyContracts: ApiContract[] = providers
    .filter(
      ({ endpoint }) =>
        !matchedProviderKeys.has(
          `${endpoint.sourceReference.sourceName}:${endpoint.sourceReference.path}`
        )
    )
    .map(({ endpoint }) => ({
      method: endpoint.method,
      path: endpoint.path,
      provider: endpoint.sourceReference,
      status: 'provider-only'
    }));

  return [...contracts, ...providerOnlyContracts].sort((left, right) =>
    `${left.path}:${left.method}`.localeCompare(`${right.path}:${right.method}`)
  );
}

function apiCallMatchesEndpoint(call: ApiClientCallInfo, endpoint: ApiEndpointInfo): boolean {
  if (call.method !== 'UNKNOWN' && call.method !== endpoint.method) {
    return false;
  }

  return normalizeComparablePath(call.path) === normalizeComparablePath(endpoint.path);
}

function normalizeComparablePath(path: string): string {
  return path
    .replace(/^\/api\//, '/')
    .replace(/:[^/]+/g, ':param')
    .replace(/\[[^\]]+\]/g, ':param');
}

function buildEnvironmentLinks(repositories: RepositoryMap[]): EnvironmentLink[] {
  const referencesByName = new Map<string, SourceReference[]>();

  for (const repository of repositories) {
    for (const envVar of repository.environmentVariables) {
      const current = referencesByName.get(envVar.name) ?? [];
      referencesByName.set(envVar.name, [...current, ...envVar.sourceReferences]);
    }
  }

  return [...referencesByName.entries()]
    .map(([name, sourceReferences]) => ({
      name,
      sourceReferences: dedupeReferences(sourceReferences),
      sources: [...new Set(sourceReferences.map((reference) => reference.sourceName))]
    }))
    .filter((link) => link.sources.length > 1)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function buildRelationships(
  repositories: RepositoryMap[],
  apiContracts: ApiContract[],
  environmentLinks: EnvironmentLink[]
): SourceRelationship[] {
  const relationships: SourceRelationship[] = [];

  for (const contract of apiContracts.filter((apiContract) => apiContract.status === 'matched')) {
    if (!contract.consumer || !contract.provider) {
      continue;
    }

    relationships.push({
      kind: 'frontend-calls-backend',
      fromSource: contract.consumer.sourceName,
      toSource: contract.provider.sourceName,
      confidence: 'high',
      evidence: [contract.consumer, contract.provider]
    });
  }

  for (const environmentLink of environmentLinks) {
    const [firstSource, secondSource] = environmentLink.sources;
    if (!firstSource || !secondSource) {
      continue;
    }

    relationships.push({
      kind: 'environment-coupling',
      fromSource: firstSource,
      toSource: secondSource,
      confidence: 'medium',
      evidence: environmentLink.sourceReferences
    });
  }

  for (const repository of repositories) {
    for (const dependency of repository.dependencies) {
      const provider = repositories.find(
        (candidate) =>
          candidate.source.name !== repository.source.name &&
          candidate.source.role === 'shared' &&
          dependency.name.includes(candidate.source.name.toLowerCase())
      );

      if (!provider) {
        continue;
      }

      relationships.push({
        kind: 'shared-dependency',
        fromSource: repository.source.name,
        toSource: provider.source.name,
        confidence: 'medium',
        evidence: [dependency.sourceReference]
      });
    }
  }

  return dedupeRelationships(relationships);
}

function detectAuthFlows(repositories: RepositoryMap[]): AuthFlow[] {
  const evidenceByKind = new Map<string, SourceReference[]>();

  for (const repository of repositories) {
    for (const dependency of repository.dependencies) {
      const authKind = resolveKnownDependencyName(dependency.name, knownAuthDependencies);
      if (!authKind) {
        continue;
      }

      const current = evidenceByKind.get(authKind) ?? [];
      evidenceByKind.set(authKind, [...current, dependency.sourceReference]);
    }
  }

  return [...evidenceByKind.entries()]
    .map(([kind, evidence]) => ({
      kind,
      sources: [...new Set(evidence.map((sourceReference) => sourceReference.sourceName))],
      confidence: 'medium' as const,
      evidence: dedupeReferences(evidence)
    }))
    .sort((left, right) => left.kind.localeCompare(right.kind));
}

function detectIntegrations(repositories: RepositoryMap[]): IntegrationPoint[] {
  const evidenceByIntegration = new Map<string, SourceReference[]>();

  for (const repository of repositories) {
    for (const dependency of repository.dependencies) {
      const integrationName = resolveKnownDependencyName(dependency.name, knownIntegrationDependencies);
      if (!integrationName) {
        continue;
      }

      const current = evidenceByIntegration.get(integrationName) ?? [];
      evidenceByIntegration.set(integrationName, [...current, dependency.sourceReference]);
    }
  }

  return [...evidenceByIntegration.entries()]
    .map(([name, evidence]) => ({
      name,
      evidence: dedupeReferences(evidence),
      sources: [...new Set(evidence.map((sourceReference) => sourceReference.sourceName))]
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function resolveKnownDependencyName(
  dependencyName: string,
  knownDependencies: Map<string, string>
): string | undefined {
  for (const [candidate, label] of knownDependencies.entries()) {
    if (candidate.endsWith('/')) {
      if (dependencyName.startsWith(candidate)) {
        return label;
      }
      continue;
    }

    if (dependencyName === candidate) {
      return label;
    }
  }

  return undefined;
}

function buildSystemRisks(apiContracts: ApiContract[]): SystemRisk[] {
  const risks: SystemRisk[] = [];
  const consumerOnly = apiContracts.filter((contract) => contract.status === 'consumer-only');
  const providerOnly = apiContracts.filter((contract) => contract.status === 'provider-only');

  if (consumerOnly.length > 0) {
    risks.push({
      level: 'medium',
      message: `${consumerOnly.length} frontend API call(s) did not match detected backend endpoints.`,
      sourceReferences: consumerOnly.flatMap((contract) => contract.consumer ?? [])
    });
  }

  if (providerOnly.length > 0) {
    risks.push({
      level: 'low',
      message: `${providerOnly.length} backend endpoint(s) were not matched to detected frontend calls.`,
      sourceReferences: providerOnly.flatMap((contract) => contract.provider ?? [])
    });
  }

  return risks;
}

function buildSystemUnknowns(repositories: RepositoryMap[]): SystemUnknown[] {
  const unknowns: SystemUnknown[] = [];

  if (!repositories.some((repository) => repository.source.role === 'frontend')) {
    unknowns.push({
      message: 'No source input was marked as frontend.'
    });
  }

  if (!repositories.some((repository) => repository.source.role === 'backend')) {
    unknowns.push({
      message: 'No source input was marked as backend.'
    });
  }

  return unknowns;
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

function dedupeRelationships(relationships: SourceRelationship[]): SourceRelationship[] {
  const keys = new Set<string>();
  const deduped: SourceRelationship[] = [];

  for (const relationship of relationships) {
    const key = `${relationship.kind}:${relationship.fromSource}:${relationship.toSource}`;
    if (keys.has(key)) {
      continue;
    }

    keys.add(key);
    deduped.push(relationship);
  }

  return deduped;
}
