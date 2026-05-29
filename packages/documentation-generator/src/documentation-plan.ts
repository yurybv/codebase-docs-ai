import type { DocumentationPagePlan, DocumentationPlan, SystemMap } from '@codebase-docs-ai/shared';

const defaultPageDefinitions: Array<Omit<DocumentationPagePlan, 'warnings'>> = [
  {
    key: 'overview',
    title: '01. Overview',
    order: 1,
    purpose: 'Explain the system and where developers should start.',
    requiredEvidence: ['package.json', 'README.md']
  },
  {
    key: 'system-architecture',
    title: '02. System Architecture',
    order: 2,
    purpose: 'Explain source roles and relationships.',
    requiredEvidence: ['RepositoryMap', 'SystemMap']
  },
  {
    key: 'source-inventory',
    title: '03. Source Inventory',
    order: 3,
    purpose: 'List uploaded sources and detected frameworks.',
    requiredEvidence: ['RepositoryMap']
  },
  {
    key: 'frontend',
    title: '04. Frontend',
    order: 4,
    purpose: 'Document frontend routes, scripts, and API calls.',
    requiredEvidence: ['frontend source']
  },
  {
    key: 'backend',
    title: '05. Backend',
    order: 5,
    purpose: 'Document backend endpoints, scripts, and runtime shape.',
    requiredEvidence: ['backend source']
  },
  {
    key: 'api-contracts',
    title: '06. API Contracts',
    order: 6,
    purpose: 'Document matched and unmatched API contracts.',
    requiredEvidence: ['apiContracts']
  },
  {
    key: 'auth',
    title: '07. Authentication and Authorization',
    order: 7,
    purpose: 'Document auth evidence and unknowns.',
    requiredEvidence: ['authFlows']
  },
  {
    key: 'environment',
    title: '08. Environment Variables',
    order: 8,
    purpose: 'Document detected environment variables and cross-source links.',
    requiredEvidence: ['environmentVariables']
  },
  {
    key: 'local-development',
    title: '09. Local Development',
    order: 9,
    purpose: 'Document detected install/start/test commands.',
    requiredEvidence: ['package scripts']
  },
  {
    key: 'testing',
    title: '10. Testing',
    order: 10,
    purpose: 'Document detected test commands and gaps.',
    requiredEvidence: ['package scripts']
  },
  {
    key: 'build-deployment',
    title: '11. Build and Deployment',
    order: 11,
    purpose: 'Document build scripts and deployment-related config.',
    requiredEvidence: ['scripts', 'configFiles']
  },
  {
    key: 'external-integrations',
    title: '12. External Integrations',
    order: 12,
    purpose: 'Document detected external integration dependencies.',
    requiredEvidence: ['integrations']
  },
  {
    key: 'risks',
    title: '13. Risks and Unknowns',
    order: 13,
    purpose: 'Document analysis warnings and unknowns.',
    requiredEvidence: ['risks', 'unknowns']
  },
  {
    key: 'source-references',
    title: '14. Source References',
    order: 14,
    purpose: 'List source evidence used by generated documentation.',
    requiredEvidence: ['sourceReferences']
  }
];

export function createDocumentationPlan(systemMap: SystemMap): DocumentationPlan {
  const warnings = systemMap.risks.map((risk) => ({
    level: risk.level,
    message: risk.message,
    ...(risk.sourceReferences ? { sourceReferences: risk.sourceReferences } : {})
  }));

  return {
    pages: defaultPageDefinitions.map((definition) => ({
      ...definition,
      warnings: []
    })),
    warnings
  };
}
