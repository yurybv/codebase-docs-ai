import type { LoadedSource, SourceFile } from '@codebase-docs-ai/shared';

export type SecurityFileDecisionReason =
  | 'included'
  | 'denylisted_path'
  | 'generated_path'
  | 'binary_extension'
  | 'file_size_limit_exceeded';

export interface SecurityFileDecision {
  file: SourceFile;
  include: boolean;
  reason: SecurityFileDecisionReason;
}

export interface SecurityFilterOptions {
  denylistPatterns: string[];
  generatedPatterns: string[];
  binaryExtensions: string[];
  maxPromptFileSizeBytes: number;
}

export interface SecurityFilteredSource {
  source: LoadedSource['source'];
  includedFiles: SourceFile[];
  skippedFiles: SecurityFileDecision[];
}

export interface SecretRedaction {
  kind: string;
  count: number;
}

export interface SecretRedactionResult {
  text: string;
  redactions: SecretRedaction[];
}
