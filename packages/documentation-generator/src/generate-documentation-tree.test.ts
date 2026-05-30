import { LocalJsonProvider } from '@codebase-docs-ai/ai-orchestrator';
import type { SystemMap } from '@codebase-docs-ai/shared';
import { describe, expect, it } from 'vitest';
import { createDocumentationPlan } from './documentation-plan.js';
import {
  generateDocumentationTree,
  generateDocumentationTreeWithAi
} from './generate-documentation-tree.js';

describe('createDocumentationPlan', () => {
  it('creates the default documentation page set', () => {
    const plan = createDocumentationPlan(systemMapFixture());

    expect(plan.pages).toHaveLength(14);
    expect(plan.pages[0]?.title).toBe('01. Overview');
    expect(plan.pages.at(-1)?.title).toBe('14. Source References');
  });

  it('can generate pages through an AI provider with schema validation', async () => {
    const provider = new LocalJsonProvider((input) => ({
      key: 'overview',
      title: '01. Overview',
      markdown: `# AI Page\n\nGenerated from ${input.schemaName}.`,
      sourceReferences: [
        {
          sourceName: 'Frontend',
          path: 'package.json'
        }
      ],
      warnings: []
    }));
    const documentationTree = await generateDocumentationTreeWithAi({
      title: 'Customer Portal Documentation',
      systemMap: systemMapFixture(),
      aiProvider: provider
    });

    expect(documentationTree.pages).toHaveLength(14);
    expect(documentationTree.pages[0]?.markdown).toContain('Generated from DocumentationPage');
    expect(documentationTree.pages[0]?.sourceReferences).toContainEqual({
      sourceName: 'Frontend',
      path: 'package.json'
    });
  });

  it('keeps validation errors sanitized when AI output contains raw secret-bearing content', async () => {
    const rawOpenAiKey = `sk-${'a'.repeat(25)}`;
    const provider = new LocalJsonProvider(() => ({
      key: rawOpenAiKey,
      markdown: `# Unsafe\n\nGenerated from .env SHOULD_NOT_APPEAR.`,
      sourceReferences: [
        {
          sourceName: 'Frontend',
          path: `.env/${rawOpenAiKey}/SHOULD_NOT_APPEAR.ts`
        }
      ],
      warnings: [
        {
          level: 'medium',
          message: `Unsafe warning ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`
        }
      ]
    }));

    try {
      await generateDocumentationTreeWithAi({
        title: 'Customer Portal Documentation',
        systemMap: systemMapFixture(),
        aiProvider: provider
      });
      throw new Error('Expected AI page validation to fail.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain('AI page output is invalid');
      expect(message).not.toContain(rawOpenAiKey);
      expect(message).not.toContain('SHOULD_NOT_APPEAR');
      expect(message).not.toContain('.env');
    }
  });

  it('sanitizes accepted AI page output before building the documentation tree', async () => {
    const rawOpenAiKey = `sk-${'b'.repeat(25)}`;
    const provider = new LocalJsonProvider(() => ({
      key: 'overview',
      title: '01. Overview',
      markdown: `# Safe Shape\n\nGenerated from ${rawOpenAiKey} in .env SHOULD_NOT_APPEAR.`,
      sourceReferences: [
        {
          sourceName: `Frontend ${rawOpenAiKey}`,
          path: `.env/${rawOpenAiKey}/SHOULD_NOT_APPEAR.ts`
        }
      ],
      warnings: [
        {
          level: 'medium',
          message: `Unsafe warning ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
          sourceReferences: [
            {
              sourceName: 'Frontend',
              path: `.env/${rawOpenAiKey}/SHOULD_NOT_APPEAR.ts`
            }
          ]
        }
      ]
    }));

    const documentationTree = await generateDocumentationTreeWithAi({
      title: 'Customer Portal Documentation',
      systemMap: systemMapFixture(),
      aiProvider: provider
    });
    const payload = JSON.stringify(documentationTree);

    expect(payload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(payload).toContain('[REDACTED_DENIED_FILE]');
    expect(payload).toContain('[REDACTED_DENIED_VALUE]');
    expect(payload).not.toContain(rawOpenAiKey);
    expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    expect(payload).not.toContain('.env');
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
    expect(documentationTree.pages.find((page) => page.key === 'system-architecture')?.markdown).toContain(
      '| frontend-calls-backend | Frontend | Backend | high |'
    );
    expect(documentationTree.pages.find((page) => page.key === 'frontend')?.markdown).toContain(
      '| next-app-route | /users |'
    );
    expect(documentationTree.pages.find((page) => page.key === 'backend')?.markdown).toContain(
      '| GET | /api/users | users.controller |'
    );
    expect(documentationTree.pages.find((page) => page.key === 'auth')?.markdown).toContain(
      '| jwt | Frontend, Backend | medium |'
    );
    expect(documentationTree.pages.find((page) => page.key === 'local-development')?.markdown).toContain(
      '| dev | `next dev` |'
    );
    expect(documentationTree.pages.find((page) => page.key === 'testing')?.markdown).toContain(
      '| test | `vitest run` |'
    );
    expect(documentationTree.pages.find((page) => page.key === 'build-deployment')?.markdown).toContain(
      '| docker | Backend:Dockerfile |'
    );
    expect(documentationTree.pages.find((page) => page.key === 'external-integrations')?.markdown).toContain(
      '| Stripe | Backend |'
    );
    expect(documentationTree.sourceReferences).toContainEqual({
      sourceName: 'Frontend',
      path: 'src/api.ts'
    });
  });

  it('sanitizes source metadata and references in deterministic documentation output', () => {
    const rawOpenAiKey = `sk-${'c'.repeat(25)}`;
    const systemMap = systemMapFixture();
    const unsafeSourceName = `Frontend ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`;
    const unsafeReferencePath = `.env/${rawOpenAiKey}/SHOULD_NOT_APPEAR.ts`;
    systemMap.sources[0] = {
      ...systemMap.sources[0],
      source: {
        name: unsafeSourceName,
        role: 'frontend'
      },
      packageManager: {
        ...systemMap.sources[0].packageManager,
        evidence: [
          {
            sourceName: unsafeSourceName,
            path: unsafeReferencePath
          }
        ]
      }
    };
    systemMap.relationships[0] = {
      ...systemMap.relationships[0],
      fromSource: unsafeSourceName,
      evidence: [
        {
          sourceName: unsafeSourceName,
          path: unsafeReferencePath
        }
      ]
    };
    systemMap.authFlows[0] = {
      ...systemMap.authFlows[0],
      sources: [unsafeSourceName],
      evidence: [
        {
          sourceName: unsafeSourceName,
          path: unsafeReferencePath
        }
      ]
    };
    systemMap.environmentLinks = [
      {
        name: `API_${rawOpenAiKey}_SHOULD_NOT_APPEAR`,
        sources: [unsafeSourceName]
      }
    ];
    systemMap.integrations[0] = {
      ...systemMap.integrations[0],
      sources: [unsafeSourceName],
      evidence: [
        {
          sourceName: unsafeSourceName,
          path: unsafeReferencePath
        }
      ]
    };

    const documentationTree = generateDocumentationTree({
      title: 'Customer Portal Documentation',
      systemMap
    });
    const payload = JSON.stringify(documentationTree);

    expect(payload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(payload).toContain('[REDACTED_DENIED_FILE]');
    expect(payload).toContain('[REDACTED_DENIED_VALUE]');
    expect(payload).not.toContain(rawOpenAiKey);
    expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    expect(payload).not.toContain('.env');
  });

  it('sanitizes analyzer text fields in deterministic documentation output', () => {
    const rawOpenAiKey = `sk-${'d'.repeat(25)}`;
    const unsafeText = `${rawOpenAiKey} .env SHOULD_NOT_APPEAR`;
    const systemMap = systemMapFixture();

    systemMap.sources[0] = {
      ...systemMap.sources[0],
      frameworks: [
        {
          ...systemMap.sources[0].frameworks[0],
          name: `Next ${unsafeText}`
        }
      ],
      scripts: [
        {
          ...systemMap.sources[0].scripts[0],
          name: `dev ${unsafeText}`,
          command: `next dev --token ${unsafeText}`
        },
        ...systemMap.sources[0].scripts.slice(1)
      ],
      routes: [
        {
          ...systemMap.sources[0].routes[0],
          path: `/users/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`
        }
      ],
      apiClientCalls: [
        {
          ...systemMap.sources[0].apiClientCalls[0],
          method: `GET ${unsafeText}`,
          path: `/api/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`
        }
      ],
      configFiles: [
        {
          ...systemMap.sources[0].configFiles[0],
          kind: `next ${unsafeText}`
        }
      ]
    };
    systemMap.sources[1] = {
      ...systemMap.sources[1],
      dependencies: [
        {
          ...systemMap.sources[1].dependencies[0],
          name: `stripe ${unsafeText}`
        }
      ],
      apiEndpoints: [
        {
          ...systemMap.sources[1].apiEndpoints[0],
          method: `POST ${unsafeText}`,
          path: `/api/backend/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`,
          controller: `users ${unsafeText}`
        }
      ],
      configFiles: [
        {
          ...systemMap.sources[1].configFiles[0],
          kind: `docker ${unsafeText}`
        }
      ]
    };
    systemMap.apiContracts[0] = {
      ...systemMap.apiContracts[0],
      method: `PATCH ${unsafeText}`,
      path: `/api/contracts/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`
    };
    systemMap.integrations[0] = {
      ...systemMap.integrations[0],
      name: `Stripe ${unsafeText}`
    };
    systemMap.risks = [
      {
        level: 'high',
        message: `Risk includes ${unsafeText}`
      }
    ];
    systemMap.unknowns = [
      {
        message: `Unknown includes ${unsafeText}`
      }
    ];

    const documentationTree = generateDocumentationTree({
      title: 'Customer Portal Documentation',
      systemMap
    });
    const payload = JSON.stringify(documentationTree);

    expect(payload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(payload).toContain('[REDACTED_DENIED_FILE]');
    expect(payload).toContain('[REDACTED_DENIED_VALUE]');
    expect(payload).not.toContain(rawOpenAiKey);
    expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    expect(payload).not.toContain('.env');
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
          },
          {
            name: 'test',
            command: 'vitest run',
            sourceReference: {
              sourceName: 'Frontend',
              path: 'package.json'
            }
          }
        ],
        dependencies: [
          {
            name: 'next',
            version: 'latest',
            scope: 'dependencies',
            sourceReference: {
              sourceName: 'Frontend',
              path: 'package.json'
            }
          }
        ],
        routes: [
          {
            kind: 'next-app-route',
            path: '/users',
            sourceReference: {
              sourceName: 'Frontend',
              path: 'app/users/page.tsx'
            }
          }
        ],
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
        configFiles: [
          {
            kind: 'next',
            sourceReference: {
              sourceName: 'Frontend',
              path: 'next.config.ts'
            }
          }
        ],
        risks: [],
        generatedAt: '2026-05-29T00:00:00.000Z'
      },
      {
        source: {
          name: 'Backend',
          role: 'backend'
        },
        packageManager: {
          name: 'pnpm',
          evidence: [
            {
              sourceName: 'Backend',
              path: 'pnpm-lock.yaml'
            }
          ]
        },
        frameworks: [
          {
            name: 'NestJS',
            category: 'backend',
            evidence: [
              {
                sourceName: 'Backend',
                path: 'package.json'
              }
            ]
          }
        ],
        scripts: [
          {
            name: 'start',
            command: 'nest start',
            sourceReference: {
              sourceName: 'Backend',
              path: 'package.json'
            }
          },
          {
            name: 'build',
            command: 'nest build',
            sourceReference: {
              sourceName: 'Backend',
              path: 'package.json'
            }
          }
        ],
        dependencies: [
          {
            name: 'stripe',
            version: 'latest',
            scope: 'dependencies',
            sourceReference: {
              sourceName: 'Backend',
              path: 'package.json'
            }
          }
        ],
        routes: [],
        apiEndpoints: [
          {
            method: 'GET',
            path: '/api/users',
            controller: 'users.controller',
            sourceReference: {
              sourceName: 'Backend',
              path: 'src/users.controller.ts'
            }
          }
        ],
        apiClientCalls: [],
        environmentVariables: [
          {
            name: 'DATABASE_URL',
            sourceReferences: [
              {
                sourceName: 'Backend',
                path: 'src/config.ts'
              }
            ]
          }
        ],
        configFiles: [
          {
            kind: 'docker',
            sourceReference: {
              sourceName: 'Backend',
              path: 'Dockerfile'
            }
          }
        ],
        risks: [],
        generatedAt: '2026-05-29T00:00:00.000Z'
      }
    ],
    relationships: [
      {
        kind: 'frontend-calls-backend',
        fromSource: 'Frontend',
        toSource: 'Backend',
        confidence: 'high',
        evidence: [
          {
            sourceName: 'Frontend',
            path: 'src/api.ts'
          },
          {
            sourceName: 'Backend',
            path: 'src/users.controller.ts'
          }
        ]
      }
    ],
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
    authFlows: [
      {
        kind: 'jwt',
        sources: ['Frontend', 'Backend'],
        confidence: 'medium',
        evidence: [
          {
            sourceName: 'Backend',
            path: 'package.json'
          }
        ]
      }
    ],
    environmentLinks: [],
    integrations: [
      {
        name: 'Stripe',
        sources: ['Backend'],
        evidence: [
          {
            sourceName: 'Backend',
            path: 'package.json'
          }
        ]
      }
    ],
    risks: [],
    unknowns: [],
    generatedAt: '2026-05-29T00:00:00.000Z'
  };
}
