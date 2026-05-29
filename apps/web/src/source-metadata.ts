import { stripSupportedSourceArchiveExtension } from '@codebase-docs-ai/shared';
import type { SourceRole } from '@codebase-docs-ai/shared';

export type { SourceRole } from '@codebase-docs-ai/shared';

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
  return stripSupportedSourceArchiveExtension(fileName).replace(/[-_]+/g, ' ').trim();
}
