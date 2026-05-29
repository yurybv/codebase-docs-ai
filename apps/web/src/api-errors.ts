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
      message: typeof source.message === 'string' ? source.message : text,
      ...(typeof source.code === 'string' ? { code: source.code } : {}),
      ...('details' in source ? { details: source.details } : {})
    };
  } catch {
    return {
      message: text
    };
  }
}

export function formatApiErrorMessage(error: WebApiErrorPayload, fallback: string): string {
  const message = error.message || fallback;
  return error.code ? `${error.code}: ${message}` : message;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
