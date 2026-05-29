import type { SystemMap } from '@codebase-docs-ai/shared';
import { describe, expect, it } from 'vitest';
import { createDocumentationPlan } from './documentation-plan.js';
import { generateDocumentationTree } from './generate-documentation-tree.js';

describe('createDocumentationPlan', () => {
  it('creates the default documentation page set', () => {
    const plan = createDocumentationPlan(systemMapFixture());

    expect(plan.pages).toHaveLength(14);
    expect(plan.pages[0]?.title).toBe('01. Overview');
    expect(plan.pages.at(-1)?.title).toBe('14. Source References');
  });
});

describe('generateDocumentationTree', () => {
  it('generates markdown pages from a system map', () => {
    const documentationTree = generateDocumentationTree({
      title: 'Customer Portal Documentation',
      systemMap: systemMapFixture()
    });

    expect(documentationTree.title).toBe('Customer Portal Documentation');
    expect(documentationTree.pages).toHaveLength(14);
    expect(documentationTree.pages.find((page) => page.key === 'api-contracts')?.markdown).toContain(
      '| GET | /api/users | matched |'
    );
    expect(documentationTree.sourceReferences).toContainEqual({
      sourceName: 'Frontend',
      path: 'src/api.ts'
    });
  });
});

function systemMapFixture(): SystemMap {
  return {
    sources: [
      {
        source: {
          name: 'Frontend',
          role: 'frontend'
        },
        packageManager: {
          name: 'pnpm',
          evidence: [
            {
              sourceName: 'Frontend',
              path: 'pnpm-lock.yaml'
            }
          ]
        },
        frameworks: [
          {
            name: 'Next.js',
            category: 'fullstack',
            evidence: [
              {
                sourceName: 'Frontend',
                path: 'package.json'
              }
            ]
          }
        ],
        scripts: [
          {
            name: 'dev',
            command: 'next dev',
            sourceReference: {
              sourceName: 'Frontend',
              path: 'package.json'
            }
          }
        ],
        dependencies: [],
        routes: [],
        apiEndpoints: [],
        apiClientCalls: [
          {
            method: 'GET',
            path: '/api/users',
            sourceReference: {
              sourceName: 'Frontend',
              path: 'src/api.ts'
            }
          }
        ],
        environmentVariables: [],
        configFiles: [],
        risks: [],
        generatedAt: '2026-05-29T00:00:00.000Z'
      }
    ],
    relationships: [],
    apiContracts: [
      {
        method: 'GET',
        path: '/api/users',
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
    ],
    authFlows: [],
    environmentLinks: [],
    integrations: [],
    risks: [],
    unknowns: [],
    generatedAt: '2026-05-29T00:00:00.000Z'
  };
}
