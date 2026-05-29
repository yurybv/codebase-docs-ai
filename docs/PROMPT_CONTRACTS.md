# Prompt Contracts

AI prompts must be treated as versioned contracts. They should receive structured, sanitized context and produce schema-valid output.

## Global Prompt Rules

The AI must:

- use only provided source evidence;
- not invent services, deployments, or APIs;
- mention uncertainty when evidence is incomplete;
- write practical developer-facing documentation;
- include source references when available;
- avoid marketing language;
- avoid raw private code unless explicitly included in sanitized snippets;
- never output secrets.

## Documentation Plan Prompt

Input:

```json
{
  "systemMap": {},
  "targetPages": [
    "overview",
    "system-architecture",
    "source-inventory",
    "frontend",
    "backend",
    "api-contracts",
    "auth",
    "environment",
    "local-development",
    "testing",
    "build-deployment",
    "external-integrations",
    "risks",
    "source-references"
  ],
  "styleGuide": {}
}
```

Output:

```json
{
  "pages": [
    {
      "key": "overview",
      "title": "01. Overview",
      "purpose": "Explain the system and where developers should start.",
      "requiredEvidence": ["package.json", "README.md"],
      "warnings": []
    }
  ]
}
```

## Page Generation Prompt

Input:

```json
{
  "page": {
    "key": "api-contracts",
    "title": "06. API Contracts"
  },
  "systemMap": {},
  "relevantSources": [],
  "styleGuide": {}
}
```

Output:

```json
{
  "key": "api-contracts",
  "title": "06. API Contracts",
  "markdown": "# 06. API Contracts\n...",
  "sourceReferences": [
    {
      "sourceName": "backend",
      "path": "src/users/users.controller.ts"
    }
  ],
  "warnings": [
    {
      "level": "medium",
      "message": "Some frontend API calls did not match detected backend routes."
    }
  ]
}
```

## Documentation Style Guide

Generated documentation should be:

- clear;
- practical;
- developer-oriented;
- source-aware;
- concise;
- explicit about unknowns;
- useful for onboarding and maintenance.

Preferred phrasing for uncertainty:

```text
The provided source inputs do not contain enough evidence to determine this.
```

## Prompt Sources From ECC

Useful ECC ideas to adapt:

- plan prompt: restate goal, identify dependencies, phase implementation, define done;
- code review prompt: prioritize security, correctness, error handling, test coverage;
- update docs prompt: keep docs aligned with implementation;
- security rules: never trust input, validate boundaries, avoid leaked secrets.

Do not copy ECC harness-specific references into product prompts unless they are rewritten for this project.
