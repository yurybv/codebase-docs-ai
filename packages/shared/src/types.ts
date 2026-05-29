export type SourceRole =
  | 'frontend'
  | 'backend'
  | 'shared'
  | 'infra'
  | 'mobile'
  | 'docs'
  | 'unknown';

export type DocumentationOutputFormat = 'markdown-tree' | 'single-markdown' | 'json';

export type DocumentationRunStatus =
  | 'created'
  | 'uploading_sources'
  | 'ready'
  | 'running'
  | 'extracting_sources'
  | 'analyzing_sources'
  | 'building_system_map'
  | 'generating_documentation'
  | 'rendering_output'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired';

export type WarningLevel = 'low' | 'medium' | 'high';

export interface SourceInputMetadata {
  id?: string;
  name: string;
  role: SourceRole;
  metadata?: Record<string, unknown>;
}

export interface SourceLoadLimits {
  maxFiles: number;
  maxFileSizeBytes: number;
  maxTotalSizeBytes: number;
}

export interface SourceFile {
  path: string;
  absolutePath: string;
  sizeBytes: number;
  extension: string;
}

export interface SkippedSourceFile {
  path: string;
  reason: string;
}

export interface LoadedSource {
  source: SourceInputMetadata;
  rootPath: string;
  files: SourceFile[];
  skippedFiles: SkippedSourceFile[];
  totalSizeBytes: number;
}

export type PackageManagerName = 'pnpm' | 'npm' | 'yarn' | 'bun' | 'unknown';

export interface PackageManagerInfo {
  name: PackageManagerName;
  evidence: SourceReference[];
}

export interface FrameworkInfo {
  name: string;
  category: 'frontend' | 'backend' | 'fullstack' | 'runtime' | 'tooling';
  evidence: SourceReference[];
}

export interface PackageScript {
  name: string;
  command: string;
  sourceReference: SourceReference;
}

export interface DependencyInfo {
  name: string;
  version: string;
  scope: 'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies';
  sourceReference: SourceReference;
}

export interface RouteInfo {
  kind: 'next-app-route' | 'next-pages-route';
  path: string;
  sourceReference: SourceReference;
}

export interface ApiEndpointInfo {
  method: string;
  path: string;
  controller?: string;
  sourceReference: SourceReference;
}

export interface ApiClientCallInfo {
  method: string;
  path: string;
  sourceReference: SourceReference;
}

export interface EnvironmentVariableInfo {
  name: string;
  sourceReferences: SourceReference[];
}

export interface ConfigFileInfo {
  kind: string;
  sourceReference: SourceReference;
}

export interface RepositoryRisk {
  level: WarningLevel;
  message: string;
  sourceReferences?: SourceReference[];
}

export interface RepositoryMap {
  source: SourceInputMetadata;
  packageManager: PackageManagerInfo;
  frameworks: FrameworkInfo[];
  scripts: PackageScript[];
  dependencies: DependencyInfo[];
  routes: RouteInfo[];
  apiEndpoints: ApiEndpointInfo[];
  apiClientCalls: ApiClientCallInfo[];
  environmentVariables: EnvironmentVariableInfo[];
  configFiles: ConfigFileInfo[];
  risks: RepositoryRisk[];
  generatedAt: string;
}

export interface SourceReference {
  sourceName: string;
  path: string;
  line?: number;
}

export interface DocumentationWarning {
  level: WarningLevel;
  message: string;
  sourceReferences?: SourceReference[];
}

export interface DocumentationPage {
  key: string;
  title: string;
  order: number;
  markdown: string;
  sourceReferences: SourceReference[];
  warnings: DocumentationWarning[];
}

export interface DocumentationTree {
  title: string;
  summary: string;
  pages: DocumentationPage[];
  warnings: DocumentationWarning[];
  sourceReferences: SourceReference[];
  generatedAt: string;
}

export interface DocumentationRunOptions {
  outputFormats: DocumentationOutputFormat[];
  language: 'en';
  includeSourceReferences: boolean;
  includeWarnings: boolean;
}

export interface DocumentationRun {
  id: string;
  name: string;
  status: DocumentationRunStatus;
  sources: SourceInputMetadata[];
  options: DocumentationRunOptions;
  createdAt: string;
  updatedAt: string;
}
