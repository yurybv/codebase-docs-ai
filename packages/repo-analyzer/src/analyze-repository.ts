import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  ApiClientCallInfo,
  ApiEndpointInfo,
  ConfigFileInfo,
  DependencyInfo,
  FrameworkInfo,
  PackageManagerInfo,
  PackageScript,
  RepositoryMap,
  RepositoryRisk,
  RouteInfo,
  SourceFile,
  SourceInputMetadata,
  SourceReference
} from '@codebase-docs-ai/shared';

export interface AnalyzeRepositoryInput {
  source: SourceInputMetadata;
  rootPath: string;
  files: SourceFile[];
}

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

const httpMethodDecoratorMap = new Map<string, string>([
  ['Get', 'GET'],
  ['Post', 'POST'],
  ['Put', 'PUT'],
  ['Patch', 'PATCH'],
  ['Delete', 'DELETE'],
  ['Options', 'OPTIONS'],
  ['Head', 'HEAD']
]);

export async function analyzeRepository(input: AnalyzeRepositoryInput): Promise<RepositoryMap> {
  const packageJson = await readPackageJson(input.files);
  const dependencies = packageJson ? collectDependencies(packageJson) : [];
  const packageJsonReference = sourceReference(input.source.name, 'package.json');

  return {
    source: input.source,
    packageManager: detectPackageManager(input.source.name, input.files),
    frameworks: detectFrameworks(dependencies, input.source.name),
    scripts: packageJson?.scripts ? collectScripts(packageJson.scripts, packageJsonReference) : [],
    dependencies: dependencies.map((dependency) => ({
      ...dependency,
      sourceReference: packageJsonReference
    })),
    routes: detectRoutes(input.source.name, input.files),
    apiEndpoints: await detectApiEndpoints(input.source.name, input.files),
    apiClientCalls: await detectApiClientCalls(input.source.name, input.files),
    environmentVariables: await detectEnvironmentVariables(input.source.name, input.files),
    configFiles: detectConfigFiles(input.source.name, input.files),
    risks: collectRisks(packageJson, input.files),
    generatedAt: new Date().toISOString()
  };
}

async function readPackageJson(files: SourceFile[]): Promise<PackageJson | null> {
  const packageJsonFile = files.find((file) => file.path === 'package.json');
  if (!packageJsonFile) {
    return null;
  }

  const raw = await readFile(packageJsonFile.absolutePath, 'utf8');
  return JSON.parse(raw) as PackageJson;
}

function detectPackageManager(sourceName: string, files: SourceFile[]): PackageManagerInfo {
  const evidence = (fileName: string): SourceReference[] => [
    sourceReference(sourceName, fileName)
  ];

  if (hasFile(files, 'pnpm-lock.yaml')) {
    return {
      name: 'pnpm',
      evidence: evidence('pnpm-lock.yaml')
    };
  }

  if (hasFile(files, 'yarn.lock')) {
    return {
      name: 'yarn',
      evidence: evidence('yarn.lock')
    };
  }

  if (hasFile(files, 'package-lock.json')) {
    return {
      name: 'npm',
      evidence: evidence('package-lock.json')
    };
  }

  if (hasFile(files, 'bun.lockb') || hasFile(files, 'bun.lock')) {
    return {
      name: 'bun',
      evidence: evidence(hasFile(files, 'bun.lockb') ? 'bun.lockb' : 'bun.lock')
    };
  }

  return {
    name: 'unknown',
    evidence: []
  };
}

function collectDependencies(packageJson: PackageJson): DependencyInfo[] {
  const scopes: DependencyInfo['scope'][] = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies'
  ];

  return scopes.flatMap((scope) =>
    Object.entries(packageJson[scope] ?? {}).map(([name, version]) => ({
      name,
      version,
      scope,
      sourceReference: sourceReference('unknown', 'package.json')
    }))
  );
}

function detectFrameworks(dependencies: DependencyInfo[], sourceName: string): FrameworkInfo[] {
  const dependencyNames = new Set(dependencies.map((dependency) => dependency.name));
  const frameworkCandidates: Array<Omit<FrameworkInfo, 'evidence'> & { dependency: string }> = [
    {
      dependency: 'next',
      name: 'Next.js',
      category: 'fullstack'
    },
    {
      dependency: 'react',
      name: 'React',
      category: 'frontend'
    },
    {
      dependency: '@nestjs/core',
      name: 'NestJS',
      category: 'backend'
    },
    {
      dependency: 'express',
      name: 'Express',
      category: 'backend'
    },
    {
      dependency: 'vite',
      name: 'Vite',
      category: 'tooling'
    },
    {
      dependency: 'typescript',
      name: 'TypeScript',
      category: 'tooling'
    }
  ];

  return frameworkCandidates
    .filter((candidate) => dependencyNames.has(candidate.dependency))
    .map((candidate) => ({
      name: candidate.name,
      category: candidate.category,
      evidence: [sourceReference(sourceName, 'package.json')]
    }));
}

function collectScripts(
  scripts: Record<string, string>,
  sourceReference: SourceReference
): PackageScript[] {
  return Object.entries(scripts).map(([name, command]) => ({
    name,
    command,
    sourceReference
  }));
}

function detectRoutes(sourceName: string, files: SourceFile[]): RouteInfo[] {
  return files.flatMap((file) => {
    const routes: RouteInfo[] = [];

    if (file.path.startsWith('app/') && /\/page\.(tsx|ts|jsx|js)$/.test(file.path)) {
      routes.push({
        kind: 'next-app-route',
        path: normalizeNextAppRoute(file.path),
        sourceReference: sourceReference(sourceName, file.path)
      });
    }

    if (file.path.startsWith('pages/') && /\.(tsx|ts|jsx|js)$/.test(file.path)) {
      routes.push({
        kind: 'next-pages-route',
        path: normalizeNextPagesRoute(file.path),
        sourceReference: sourceReference(sourceName, file.path)
      });
    }

    return routes;
  });
}

async function detectApiEndpoints(
  sourceName: string,
  files: SourceFile[]
): Promise<ApiEndpointInfo[]> {
  const controllerFiles = files.filter((file) => file.path.endsWith('.controller.ts'));
  const endpoints: ApiEndpointInfo[] = [];

  for (const file of controllerFiles) {
    const content = await readFile(file.absolutePath, 'utf8');
    const controllerPrefix = extractDecoratorPath(content, 'Controller') ?? '';
    const controllerName = path.basename(file.path, '.ts');

    for (const [decorator, method] of httpMethodDecoratorMap) {
      const pattern = new RegExp(`@${decorator}\\(([^)]*)\\)`, 'g');
      for (const match of content.matchAll(pattern)) {
        const endpointPath = joinRouteParts(controllerPrefix, parseDecoratorArgument(match[1] ?? ''));
        endpoints.push({
          method,
          path: endpointPath,
          controller: controllerName,
          sourceReference: sourceReference(sourceName, file.path)
        });
      }
    }
  }

  return endpoints;
}

async function detectApiClientCalls(
  sourceName: string,
  files: SourceFile[]
): Promise<ApiClientCallInfo[]> {
  const sourceFiles = files.filter((file) => /\.(ts|tsx|js|jsx)$/.test(file.path));
  const calls: ApiClientCallInfo[] = [];

  for (const file of sourceFiles) {
    const content = await readFile(file.absolutePath, 'utf8');
    const fetchPattern = /fetch\(\s*['"`]([^'"`]+)['"`]/g;
    const axiosPattern = /axios\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;

    for (const match of content.matchAll(fetchPattern)) {
      calls.push({
        method: 'UNKNOWN',
        path: normalizeApiPath(match[1] ?? ''),
        sourceReference: sourceReference(sourceName, file.path)
      });
    }

    for (const match of content.matchAll(axiosPattern)) {
      calls.push({
        method: (match[1] ?? 'UNKNOWN').toUpperCase(),
        path: normalizeApiPath(match[2] ?? ''),
        sourceReference: sourceReference(sourceName, file.path)
      });
    }
  }

  return calls;
}

async function detectEnvironmentVariables(
  sourceName: string,
  files: SourceFile[]
): Promise<RepositoryMap['environmentVariables']> {
  const sourceFiles = files.filter((file) => /\.(ts|tsx|js|jsx|json|yml|yaml)$/.test(file.path));
  const referencesByName = new Map<string, SourceReference[]>();

  for (const file of sourceFiles) {
    const content = await readFile(file.absolutePath, 'utf8');
    const patterns = [
      /process\.env\.([A-Z0-9_]+)/g,
      /import\.meta\.env\.([A-Z0-9_]+)/g
    ];

    for (const pattern of patterns) {
      for (const match of content.matchAll(pattern)) {
        const name = match[1];
        if (!name) {
          continue;
        }

        const existingReferences = referencesByName.get(name) ?? [];
        referencesByName.set(name, [...existingReferences, sourceReference(sourceName, file.path)]);
      }
    }
  }

  return [...referencesByName.entries()]
    .map(([name, sourceReferences]) => ({
      name,
      sourceReferences: dedupeSourceReferences(sourceReferences)
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function detectConfigFiles(sourceName: string, files: SourceFile[]): ConfigFileInfo[] {
  const configMatchers: Array<{ kind: string; test: (file: SourceFile) => boolean }> = [
    {
      kind: 'typescript',
      test: (file) => file.path === 'tsconfig.json'
    },
    {
      kind: 'next',
      test: (file) => /^next\.config\.(js|mjs|ts)$/.test(file.path)
    },
    {
      kind: 'nest',
      test: (file) => file.path === 'nest-cli.json'
    },
    {
      kind: 'docker',
      test: (file) => file.path === 'Dockerfile' || file.path === 'docker-compose.yml'
    },
    {
      kind: 'github-actions',
      test: (file) => file.path.startsWith('.github/workflows/')
    },
    {
      kind: 'prisma',
      test: (file) => file.path === 'prisma/schema.prisma'
    }
  ];

  return files.flatMap((file) =>
    configMatchers
      .filter((matcher) => matcher.test(file))
      .map((matcher) => ({
        kind: matcher.kind,
        sourceReference: sourceReference(sourceName, file.path)
      }))
  );
}

function collectRisks(packageJson: PackageJson | null, files: SourceFile[]): RepositoryRisk[] {
  const risks: RepositoryRisk[] = [];

  if (!packageJson) {
    risks.push({
      level: 'medium',
      message: 'No package.json file was detected, so Node.js project metadata is incomplete.'
    });
  }

  if (!files.some((file) => file.path.toLowerCase().startsWith('readme'))) {
    risks.push({
      level: 'low',
      message: 'No README file was detected in the source input.'
    });
  }

  return risks;
}

function hasFile(files: SourceFile[], path: string): boolean {
  return files.some((file) => file.path === path);
}

function sourceReference(sourceName: string, filePath: string): SourceReference {
  return {
    sourceName,
    path: filePath
  };
}

function normalizeNextAppRoute(filePath: string): string {
  const withoutPage = filePath.replace(/^app\//, '').replace(/\/page\.(tsx|ts|jsx|js)$/, '');
  return normalizeRoutePath(withoutPage);
}

function normalizeNextPagesRoute(filePath: string): string {
  const withoutPages = filePath
    .replace(/^pages\//, '')
    .replace(/\.(tsx|ts|jsx|js)$/, '')
    .replace(/^index$/, '');
  return normalizeRoutePath(withoutPages);
}

function normalizeRoutePath(routePath: string): string {
  if (!routePath) {
    return '/';
  }

  return `/${routePath.replace(/\/index$/, '').replace(/\[(.+?)\]/g, ':$1')}`;
}

function extractDecoratorPath(content: string, decoratorName: string): string | null {
  const pattern = new RegExp(`@${decoratorName}\\(([^)]*)\\)`);
  const match = content.match(pattern);
  return match ? parseDecoratorArgument(match[1] ?? '') : null;
}

function parseDecoratorArgument(argument: string): string {
  const trimmed = argument.trim();
  const match = trimmed.match(/^['"`](.*)['"`]$/);
  return match?.[1] ?? '';
}

function joinRouteParts(prefix: string, routePath: string): string {
  return normalizeApiPath([prefix, routePath].filter(Boolean).join('/'));
}

function normalizeApiPath(apiPath: string): string {
  if (!apiPath) {
    return '/';
  }

  const parsed = apiPath.replace(/^https?:\/\/[^/]+/, '');
  return parsed.startsWith('/') ? parsed : `/${parsed}`;
}

function dedupeSourceReferences(sourceReferences: SourceReference[]): SourceReference[] {
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
