# Rate Limiting Strategy

`codebase-docs-ai` processes private source archives and can perform expensive extraction, analysis, rendering, and optional AI calls. Rate limiting is required for public or multi-tenant deployments, but the first product boundary must not assume one host application's auth model.

## Default Position

The standalone module should not hardcode a user model.

Initial deployable strategy:

```text
trusted local/operator usage
  -> no built-in rate limit required

public or multi-tenant usage
  -> host gateway or reverse proxy rate limit required

embedded host usage
  -> host application enforces authenticated user/project limits
```

## Recommended Gateway Limits

For public deployments, enforce limits before requests reach the API service:

- request body size aligned with `DOCS_AI_UPLOAD_MAX_FILE_SIZE_BYTES`;
- maximum multipart files aligned with `DOCS_AI_UPLOAD_MAX_FILES`;
- per-IP or per-authenticated-user request rate;
- concurrent upload/run creation limits;
- timeout limits for long-running requests;
- optional allowlist for internal host systems.

The API already enforces upload file count and per-file size at the multipart boundary. Gateway limits should be stricter or equal so large requests are rejected before application work starts.

## Host-Owned Quotas

When the module is embedded into another product, the host should own quota decisions:

- which users can create documentation runs;
- how many runs a project can create per hour/day;
- how many archives can be uploaded;
- maximum total archive size per project;
- whether AI-backed generation is enabled;
- how generated artifacts are retained or deleted.

The module's stable input remains:

```text
sources + options
```

The host should attach identity, billing, quota, or project ownership outside the core API contract unless a dedicated adapter is added.

## Future API Adapter

A built-in API rate limit adapter can be added later when the deployment model is clearer.

Candidate configuration:

```text
DOCS_AI_RATE_LIMIT_ENABLED=true
DOCS_AI_RATE_LIMIT_WINDOW_MS=60000
DOCS_AI_RATE_LIMIT_MAX_REQUESTS=60
DOCS_AI_RATE_LIMIT_KEY=ip
```

Candidate key strategies:

- IP address for simple standalone deployments;
- API key for machine-to-machine usage;
- forwarded authenticated user id from a trusted gateway;
- project id passed by a host adapter.

Do not add this adapter until the trusted identity source is defined. A weak in-process IP limiter can create false confidence in multi-instance deployments.

## Current API Abuse Controls

Implemented controls:

- request body validation;
- multipart file count limit;
- multipart per-file size limit;
- safe archive extraction;
- source file count and size limits;
- generated/binary/secret file filtering;
- secret redaction;
- safe error envelopes;
- run retention cleanup;
- source uploads only before run start;
- generation starts only from `ready`;
- ready-state source replacement cleans old artifacts.

Still host/gateway-owned:

- authentication;
- per-user/project quotas;
- global concurrent run limits;
- distributed rate limiting;
- billing or cost controls for AI-backed generation.
