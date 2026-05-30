import type { RepositoryMap } from '@codebase-docs-ai/shared';
import { describe, expect, it } from 'vitest';
import { analyzeSystem } from './analyze-system.js';

describe('analyzeSystem', () => {
  it('matches frontend API calls to backend endpoints', () => {
    const systemMap = analyzeSystem({
      repositories: [
        repositoryMap({
          name: 'Frontend',
          role: 'frontend',
          apiClientCalls: [
            {
              method: 'GET',
              path: '/api/users/:id',
              sourceReference: {
                sourceName: 'Frontend',
                path: 'src/api.ts'
              }
            }
          ],
          environmentVariables: [
            {
              name: 'API_URL',
              sourceReferences: [
                {
                  sourceName: 'Frontend',
                  path: 'src/api.ts'
                }
              ]
            }
          ]
        }),
        repositoryMap({
          name: 'Backend',
          role: 'backend',
          dependencies: [
            {
              name: '@clerk/nextjs',
              version: 'latest',
              scope: 'dependencies',
              sourceReference: {
                sourceName: 'Backend',
                path: 'package.json'
              }
            },
            {
              name: '@aws-sdk/client-s3',
              version: 'latest',
              scope: 'dependencies',
              sourceReference: {
                sourceName: 'Backend',
                path: 'package.json'
              }
            }
          ],
          apiEndpoints: [
            {
              method: 'GET',
              path: '/users/:id',
              controller: 'users.controller',
              sourceReference: {
                sourceName: 'Backend',
                path: 'src/users.controller.ts'
              }
            }
          ],
          environmentVariables: [
            {
              name: 'API_URL',
              sourceReferences: [
                {
                  sourceName: 'Backend',
                  path: 'src/config.ts'
                }
              ]
            }
          ]
        })
      ]
    });

    expect(systemMap.apiContracts).toEqual([
      {
        method: 'GET',
        path: '/api/users/:id',
        consumer: {
          sourceName: 'Frontend',
          path: 'src/api.ts'
        },
        provider: {
          sourceName: 'Backend',
          path: 'src/users.controller.ts'
        },
        status: 'matched'
      }
    ]);
    expect(systemMap.relationships.map((relationship) => relationship.kind)).toEqual([
      'frontend-calls-backend',
      'environment-coupling'
    ]);
    expect(systemMap.environmentLinks.map((link) => link.name)).toEqual(['API_URL']);
    expect(systemMap.authFlows.map((flow) => flow.kind)).toEqual(['clerk']);
    expect(systemMap.integrations.map((integration) => integration.name)).toEqual([
      'AWS SDK',
      'Clerk'
    ]);
  });

  it('reports unmatched consumer and provider contracts', () => {
    const systemMap = analyzeSystem({
      repositories: [
        repositoryMap({
          name: 'Frontend',
          role: 'frontend',
          apiClientCalls: [
            {
              method: 'POST',
              path: '/api/orders',
              sourceReference: {
                sourceName: 'Frontend',
                path: 'src/orders.ts'
              }
            }
          ]
        }),
        repositoryMap({
          name: 'Backend',
          role: 'backend',
          apiEndpoints: [
            {
              method: 'GET',
              path: '/users',
              sourceReference: {
                sourceName: 'Backend',
                path: 'src/users.controller.ts'
              }
            }
          ]
        })
      ]
    });

    expect(systemMap.apiContracts.map((contract) => contract.status)).toEqual([
      'consumer-only',
      'provider-only'
    ]);
    expect(systemMap.risks.map((risk) => risk.level)).toEqual(['medium', 'low']);
  });

  it('sanitizes embedded secret-bearing repository evidence before correlation', () => {
    const rawOpenAiKey = `sk-${'s'.repeat(24)}`;
    const unsafeSourceName = `Frontend ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`;
    const unsafeBackendName = `Backend ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`;
    const unsafePath = `src/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR.ts`;
    const unsafeApiPath = `/api/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;
    const unsafeEnvName = `API_${rawOpenAiKey}_SHOULD_NOT_APPEAR`;

    const systemMap = analyzeSystem({
      repositories: [
        repositoryMap({
          name: unsafeSourceName,
          role: 'frontend',
          dependencies: [
            {
              name: 'stripe',
              version: rawOpenAiKey,
              scope: 'dependencies',
              sourceReference: {
                sourceName: unsafeSourceName,
                path: unsafePath
              }
            }
          ],
          apiClientCalls: [
            {
              method: 'GET',
              path: unsafeApiPath,
              sourceReference: {
                sourceName: unsafeSourceName,
                path: unsafePath
              }
            },
            {
              method: 'POST',
              path: `/missing/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`,
              sourceReference: {
                sourceName: unsafeSourceName,
                path: unsafePath
              }
            }
          ],
          environmentVariables: [
            {
              name: unsafeEnvName,
              sourceReferences: [
                {
                  sourceName: unsafeSourceName,
                  path: unsafePath
                }
              ]
            }
          ]
        }),
        repositoryMap({
          name: unsafeBackendName,
          role: 'backend',
          apiEndpoints: [
            {
              method: 'GET',
              path: unsafeApiPath.replace('/api/', '/'),
              sourceReference: {
                sourceName: unsafeBackendName,
                path: unsafePath
              }
            },
            {
              method: 'POST',
              path: `/orphan/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`,
              sourceReference: {
                sourceName: unsafeBackendName,
                path: unsafePath
              }
            }
          ],
          environmentVariables: [
            {
              name: unsafeEnvName,
              sourceReferences: [
                {
                  sourceName: unsafeBackendName,
                  path: unsafePath
                }
              ]
            }
          ]
        })
      ]
    });
    const payload = JSON.stringify(systemMap);

    expect(payload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(payload).toContain('[REDACTED_DENIED_FILE]');
    expect(payload).toContain('[REDACTED_DENIED_VALUE]');
    expect(systemMap.relationships.map((relationship) => relationship.kind)).toContain(
      'frontend-calls-backend'
    );
    expect(systemMap.relationships.map((relationship) => relationship.kind)).toContain(
      'environment-coupling'
    );
    expect(systemMap.integrations.map((integration) => integration.name)).toContain('Stripe');
    expect(systemMap.risks.map((risk) => risk.level)).toContain('medium');
    expect(payload).not.toContain(rawOpenAiKey);
    expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    expect(payload).not.toContain('.env');
  });
});

function repositoryMap(
  overrides: Partial<RepositoryMap> & { name: string; role: RepositoryMap['source']['role'] }
): RepositoryMap {
  return {
    source: {
      name: overrides.name,
      role: overrides.role
    },
    packageManager: {
      name: 'unknown',
      evidence: []
    },
    frameworks: [],
    scripts: [],
    dependencies: overrides.dependencies ?? [],
    routes: [],
    apiEndpoints: overrides.apiEndpoints ?? [],
    apiClientCalls: overrides.apiClientCalls ?? [],
    environmentVariables: overrides.environmentVariables ?? [],
    configFiles: [],
    risks: [],
    generatedAt: '2026-05-29T00:00:00.000Z'
  };
}
