export const sourceRoles = [
  'frontend',
  'backend',
  'shared',
  'infra',
  'mobile',
  'docs',
  'unknown'
] as const;

export type SourceRole = (typeof sourceRoles)[number];

export type DocumentationOutputFormat = 'markdown-tree' | 'single-markdown' | 'json';

export const documentationRunStatuses = [
  'created',
  'uploading_sources',
  'ready',
  'running',
  'extracting_sources',
  'analyzing_sources',
  'building_system_map',
  'generating_documentation',
  'rendering_output',
  'completed',
  'failed',
  'cancelled',
  'expired'
] as const;

export type DocumentationRunStatus = (typeof documentationRunStatuses)[number];

export const defaultDocumentationRunListLimit = 50;
export const maxDocumentationRunListLimit = 100;

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

export interface SourceRelationship {
  kind: 'frontend-calls-backend' | 'shared-dependency' | 'environment-coupling';
  fromSource: string;
  toSource: string;
  confidence: 'low' | 'medium' | 'high';
  evidence: SourceReference[];
}

export interface ApiContract {
  method: string;
  path: string;
  consumer?: SourceReference;
  provider?: SourceReference;
  status: 'matched' | 'consumer-only' | 'provider-only';
}

export interface AuthFlow {
  kind: string;
  sources: string[];
  confidence: 'low' | 'medium' | 'high';
  evidence: SourceReference[];
}

export interface EnvironmentLink {
  name: string;
  sources: string[];
  sourceReferences: SourceReference[];
}

export interface IntegrationPoint {
  name: string;
  sources: string[];
  evidence: SourceReference[];
}

export interface SystemRisk {
  level: WarningLevel;
  message: string;
  sourceReferences?: SourceReference[];
}

export interface SystemUnknown {
  message: string;
  sourceReferences?: SourceReference[];
}

export interface SystemMap {
  sources: RepositoryMap[];
  relationships: SourceRelationship[];
  apiContracts: ApiContract[];
  authFlows: AuthFlow[];
  environmentLinks: EnvironmentLink[];
  integrations: IntegrationPoint[];
  risks: SystemRisk[];
  unknowns: SystemUnknown[];
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

export interface DocumentationPagePlan {
  key: string;
  title: string;
  order: number;
  purpose: string;
  requiredEvidence: string[];
  warnings: DocumentationWarning[];
}

export interface DocumentationPlan {
  pages: DocumentationPagePlan[];
  warnings: DocumentationWarning[];
}

export type RenderedDocumentationFormat = 'markdown-tree' | 'single-markdown' | 'json';

export interface RenderedDocumentationFile {
  path: string;
  content: string;
  mediaType: string;
}

export interface RenderedDocumentation {
  format: RenderedDocumentationFormat;
  files: RenderedDocumentationFile[];
}

export interface DocumentationRunOptions {
  outputFormats: DocumentationOutputFormat[];
  language: 'en';
  includeSourceReferences: boolean;
  includeWarnings: boolean;
}

export interface DocumentationRunProgress {
  currentStep: string;
  completedSteps: number;
  totalSteps: number;
}

export interface DocumentationRunError {
  message: string;
  code?: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
  suggestion?: string;
}

export interface ApiErrorResponse {
  error: ApiErrorPayload;
}

export interface DocumentationRun {
  id: string;
  name: string;
  status: DocumentationRunStatus;
  sources: SourceInputMetadata[];
  options: DocumentationRunOptions;
  renderedFormats?: DocumentationOutputFormat[];
  progress?: DocumentationRunProgress;
  error?: DocumentationRunError;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentationRunSourceSummary {
  id?: string;
  name: string;
  role: SourceRole;
}

export interface DocumentationRunSummary {
  id: string;
  name: string;
  status: DocumentationRunStatus;
  sources: DocumentationRunSourceSummary[];
  sourceCount: number;
  outputFormats: DocumentationOutputFormat[];
  renderedFormats?: DocumentationOutputFormat[];
  progress?: DocumentationRunProgress;
  error?: DocumentationRunError;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentationRunListResponse {
  runs: DocumentationRunSummary[];
}
