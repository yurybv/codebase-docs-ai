export interface UploadConstraints {
  maxFiles: number;
  maxFileSizeBytes: number;
}

export interface UploadValidationResult {
  acceptedFiles: File[];
  errorMessage?: string;
}

export const defaultUploadConstraints: UploadConstraints = {
  maxFiles: 5,
  maxFileSizeBytes: 100 * 1024 * 1024
};

export function validateSelectedFiles(
  existingFileCount: number,
  selectedFiles: File[],
  constraints: UploadConstraints
): UploadValidationResult {
  if (existingFileCount + selectedFiles.length > constraints.maxFiles) {
    return {
      acceptedFiles: [],
      errorMessage: `Upload up to ${constraints.maxFiles} source archive(s).`
    };
  }

  const oversizedFile = selectedFiles.find((file) => file.size > constraints.maxFileSizeBytes);
  if (oversizedFile) {
    return {
      acceptedFiles: [],
      errorMessage: `${oversizedFile.name} exceeds the ${formatBytes(constraints.maxFileSizeBytes)} upload limit.`
    };
  }

  return {
    acceptedFiles: selectedFiles
  };
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${bytes} B`;
}

export function uploadConstraintsFromEnv(env: Record<string, string | undefined>): UploadConstraints {
  return {
    maxFiles: parsePositiveInteger(env.VITE_WEB_UPLOAD_MAX_FILES, defaultUploadConstraints.maxFiles),
    maxFileSizeBytes: parsePositiveInteger(
      env.VITE_WEB_UPLOAD_MAX_FILE_SIZE_BYTES,
      defaultUploadConstraints.maxFileSizeBytes
    )
  };
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
