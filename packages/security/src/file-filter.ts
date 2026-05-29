import { minimatch } from 'minimatch';
import type { LoadedSource, SourceFile } from '@codebase-docs-ai/shared';
import type {
  SecurityFileDecision,
  SecurityFileDecisionReason,
  SecurityFilteredSource,
  SecurityFilterOptions
} from './security-types.js';

export const defaultSecurityFilterOptions: SecurityFilterOptions = {
  denylistPatterns: [
    '.env',
    '.env.*',
    '**/.env',
    '**/.env.*',
    '*.pem',
    '**/*.pem',
    '*.key',
    '**/*.key',
    '*.p12',
    '**/*.p12',
    '*.pfx',
    '**/*.pfx',
    '**/id_rsa',
    '**/id_ed25519',
    '**/secrets.*',
    '**/credentials.*'
  ],
  generatedPatterns: [
    'node_modules/**',
    '**/node_modules/**',
    'dist/**',
    '**/dist/**',
    'build/**',
    '**/build/**',
    '.next/**',
    '**/.next/**',
    'coverage/**',
    '**/coverage/**',
    '.cache/**',
    '**/.cache/**',
    '.git/**',
    '**/.git/**'
  ],
  binaryExtensions: [
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.pdf',
    '.zip',
    '.tar',
    '.gz',
    '.tgz',
    '.p12',
    '.pfx'
  ],
  maxPromptFileSizeBytes: 128 * 1024
};

export function filterLoadedSource(
  source: LoadedSource,
  options: Partial<SecurityFilterOptions> = {}
): SecurityFilteredSource {
  const mergedOptions = mergeSecurityFilterOptions(options);
  const decisions = source.files.map((file) => decideSourceFile(file, mergedOptions));

  return {
    source: source.source,
    includedFiles: decisions
      .filter((decision) => decision.include)
      .map((decision) => decision.file),
    skippedFiles: decisions.filter((decision) => !decision.include)
  };
}

export function decideSourceFile(
  file: SourceFile,
  options: Partial<SecurityFilterOptions> = {}
): SecurityFileDecision {
  const mergedOptions = mergeSecurityFilterOptions(options);
  const reason = getSkipReason(file, mergedOptions);

  return {
    file,
    include: reason === 'included',
    reason
  };
}

function getSkipReason(
  file: SourceFile,
  options: SecurityFilterOptions
): SecurityFileDecisionReason {
  if (matchesAny(file.path, options.denylistPatterns)) {
    return 'denylisted_path';
  }

  if (matchesAny(file.path, options.generatedPatterns)) {
    return 'generated_path';
  }

  if (options.binaryExtensions.includes(file.extension.toLowerCase())) {
    return 'binary_extension';
  }

  if (file.sizeBytes > options.maxPromptFileSizeBytes) {
    return 'file_size_limit_exceeded';
  }

  return 'included';
}

function mergeSecurityFilterOptions(
  options: Partial<SecurityFilterOptions>
): SecurityFilterOptions {
  return {
    denylistPatterns: options.denylistPatterns ?? defaultSecurityFilterOptions.denylistPatterns,
    generatedPatterns: options.generatedPatterns ?? defaultSecurityFilterOptions.generatedPatterns,
    binaryExtensions: options.binaryExtensions ?? defaultSecurityFilterOptions.binaryExtensions,
    maxPromptFileSizeBytes:
      options.maxPromptFileSizeBytes ?? defaultSecurityFilterOptions.maxPromptFileSizeBytes
  };
}

function matchesAny(filePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) =>
    minimatch(filePath, pattern, {
      dot: true,
      nocase: false
    })
  );
}
