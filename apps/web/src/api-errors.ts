import { sanitizePublicErrorText, sanitizePublicErrorValue } from '@codebase-docs-ai/shared';

export interface WebApiErrorPayload {
  code?: string;
  message: string;
  details?: unknown;
}

export async function parseApiError(response: Response): Promise<WebApiErrorPayload> {
  const text = await response.text();

  try {
    const parsed = JSON.parse(text) as unknown;
    if (!isRecord(parsed)) {
      return {
        message: text
      };
    }

    const source = isRecord(parsed.error) ? parsed.error : parsed;
    return {
      message:
        typeof source.message === 'string'
          ? sanitizeWebErrorText(source.message, 'Request failed.')
          : sanitizeWebErrorText(text, 'Request failed.'),
      ...(typeof source.code === 'string' ? { code: source.code } : {}),
      ...('details' in source ? { details: sanitizePublicErrorValue(source.details) } : {})
    };
  } catch {
    return {
      message: sanitizeWebErrorText(text, 'Request failed.')
    };
  }
}

export function formatApiErrorMessage(error: WebApiErrorPayload, fallback: string): string {
  const message = sanitizeWebErrorText(error.message || fallback, fallback);
  return error.code ? `${error.code}: ${message}` : message;
}

export function sanitizeWebErrorText(value: string, fallback: string): string {
  return sanitizePublicErrorText(value, { fallback });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
