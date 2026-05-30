export interface SanitizePublicErrorTextOptions {
  fallback?: string;
}

export const PUBLIC_OPENAI_API_KEY_PATTERN = /sk-[A-Za-z0-9_-]{20,}/g;
export const PUBLIC_DENIED_ENV_FILE_PATTERN = /\.env(?:\.[A-Za-z0-9_-]+)?/g;
export const PUBLIC_DENIED_SOURCE_VALUE_PATTERN = /SHOULD_NOT_APPEAR/g;
export const PUBLIC_STORAGE_PATH_PATTERN =
  /(?:\/(?:Users|home|tmp|private|var|data|mnt)\/[^\s"'<>),;]+|[A-Za-z]:\\[^\s"'<>),;]+)/g;

export function sanitizePublicErrorText(
  value: string,
  options: SanitizePublicErrorTextOptions = {}
): string {
  const sanitized = value
    .replace(PUBLIC_STORAGE_PATH_PATTERN, '[REDACTED_STORAGE_PATH]')
    .replace(PUBLIC_OPENAI_API_KEY_PATTERN, '[REDACTED_OPENAI_API_KEY]')
    .replace(PUBLIC_DENIED_ENV_FILE_PATTERN, '[REDACTED_DENIED_FILE]')
    .replace(PUBLIC_DENIED_SOURCE_VALUE_PATTERN, '[REDACTED_DENIED_VALUE]');

  if (options.fallback && sanitized.trim().length === 0) {
    return options.fallback;
  }

  return sanitized;
}

export function sanitizePublicErrorValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizePublicErrorText(value, { fallback: '[REDACTED]' });
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizePublicErrorValue(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizePublicErrorValue(entry)])
    );
  }

  return value;
}
