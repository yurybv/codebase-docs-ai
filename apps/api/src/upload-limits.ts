export interface DocumentationUploadLimits {
  maxFiles: number;
  maxFileSizeBytes: number;
}

export const defaultDocumentationUploadLimits: DocumentationUploadLimits = {
  maxFiles: 5,
  maxFileSizeBytes: 100 * 1024 * 1024
};

export function getDocumentationUploadLimits(
  env: Record<string, string | undefined> = process.env
): DocumentationUploadLimits {
  return {
    maxFiles: parsePositiveInteger(
      env.DOCS_AI_UPLOAD_MAX_FILES,
      defaultDocumentationUploadLimits.maxFiles
    ),
    maxFileSizeBytes: parsePositiveInteger(
      env.DOCS_AI_UPLOAD_MAX_FILE_SIZE_BYTES,
      defaultDocumentationUploadLimits.maxFileSizeBytes
    )
  };
}

export function getDocumentationUploadMulterOptions(): { limits: { files: number; fileSize: number } } {
  const limits = getDocumentationUploadLimits();
  return {
    limits: {
      files: limits.maxFiles,
      fileSize: limits.maxFileSizeBytes
    }
  };
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
