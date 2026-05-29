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
