export type SourceRole =
  | 'frontend'
  | 'backend'
  | 'shared'
  | 'infra'
  | 'mobile'
  | 'docs'
  | 'unknown';

export interface SourceDraft {
  id: string;
  name: string;
  role: SourceRole;
  file: File;
}

export interface SourceUploadMetadata {
  sources: Array<{
    fileField: string;
    name: string;
    role: SourceRole;
  }>;
}

export function buildSourceUploadMetadata(sources: SourceDraft[]): SourceUploadMetadata {
  return {
    sources: sources.map((source) => ({
      fileField: source.id,
      name: source.name,
      role: source.role
    }))
  };
}

export function inferSourceName(fileName: string): string {
  return fileName
    .replace(/\.(zip|tar|tar\.gz|tgz)$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();
}
