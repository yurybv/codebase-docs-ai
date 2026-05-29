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
