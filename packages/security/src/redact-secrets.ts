import type { SecretRedaction, SecretRedactionResult } from './security-types.js';

interface RedactionPattern {
  kind: string;
  pattern: RegExp;
  replacement: string;
}

const redactionPatterns: RedactionPattern[] = [
  {
    kind: 'private_key',
    pattern:
      /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replacement: '[REDACTED_PRIVATE_KEY]'
  },
  {
    kind: 'database_url',
    pattern: /\b(?:postgres|postgresql|mysql|mongodb|redis):\/\/[^\s"'`<>]+/gi,
    replacement: '[REDACTED_DATABASE_URL]'
  },
  {
    kind: 'openai_api_key',
    pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g,
    replacement: '[REDACTED_OPENAI_API_KEY]'
  },
  {
    kind: 'github_token',
    pattern: /\b(?:ghp|github_pat|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g,
    replacement: '[REDACTED_GITHUB_TOKEN]'
  },
  {
    kind: 'jwt',
    pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    replacement: '[REDACTED_JWT]'
  },
  {
    kind: 'assignment_secret',
    pattern:
      /\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|ACCESS_KEY|PRIVATE_KEY)[A-Z0-9_]*\s*=\s*)(["']?)[^\s"'`]+(["']?)/gi,
    replacement: '$1$2[REDACTED_SECRET]$3'
  }
];

export function redactSecrets(text: string): SecretRedactionResult {
  const redactions = new Map<string, number>();
  let redactedText = text;

  for (const redactionPattern of redactionPatterns) {
    let count = 0;
    redactedText = redactedText.replace(redactionPattern.pattern, (...args: unknown[]) => {
      const match = args[0];
      if (typeof match !== 'string') {
        return redactionPattern.replacement;
      }

      count += 1;
      return applyReplacement(redactionPattern.replacement, args);
    });

    if (count > 0) {
      redactions.set(redactionPattern.kind, count);
    }
  }

  return {
    text: redactedText,
    redactions: mapRedactions(redactions)
  };
}

function applyReplacement(replacement: string, args: unknown[]): string {
  return replacement.replace(/\$(\d)/g, (_, index: string) => {
    const value = args[Number.parseInt(index, 10)];
    return typeof value === 'string' ? value : '';
  });
}

function mapRedactions(redactions: Map<string, number>): SecretRedaction[] {
  return [...redactions.entries()].map(([kind, count]) => ({
    kind,
    count
  }));
}
