import { describe, expect, it } from 'vitest';
import { DocumentationEngine } from './documentation-engine.js';

describe('DocumentationEngine', () => {
  it('creates a run plan from source metadata', () => {
    const engine = new DocumentationEngine();
    const plan = engine.createRunPlan({
      name: 'Customer Portal',
      sources: [
        {
          name: 'Frontend',
          role: 'frontend'
        },
        {
          name: 'Backend',
          role: 'backend'
        }
      ],
      options: {
        outputFormats: ['markdown-tree', 'json'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });

    expect(plan).toEqual({
      name: 'Customer Portal',
      sourceCount: 2,
      sourceRoles: ['frontend', 'backend'],
      outputFormats: ['markdown-tree', 'json']
    });
  });
});
