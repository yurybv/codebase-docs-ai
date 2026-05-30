export const OPENAI_API_KEY_PATTERN = /sk-[A-Za-z0-9_-]{20,}/g;
export const DENIED_ENV_FILE_PATTERN = /\.env(?:\.[A-Za-z0-9_-]+)?/g;
export const DENIED_SOURCE_VALUE_PATTERN = /SHOULD_NOT_APPEAR/g;

export interface SanitizePublicTextOptions {
  fallback?: string;
}

export function sanitizePublicText(value: string, options: SanitizePublicTextOptions = {}): string {
  const sanitized = value
    .replace(OPENAI_API_KEY_PATTERN, '[REDACTED_OPENAI_API_KEY]')
    .replace(DENIED_ENV_FILE_PATTERN, '[REDACTED_DENIED_FILE]')
    .replace(DENIED_SOURCE_VALUE_PATTERN, '[REDACTED_DENIED_VALUE]');

  if (options.fallback && sanitized.trim().length === 0) {
    return options.fallback;
  }

  return sanitized;
}
