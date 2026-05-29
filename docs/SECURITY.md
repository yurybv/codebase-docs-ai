# Security

Security is a core product feature because the module processes private source code.

## Mandatory Rules

- Treat every archive and folder as untrusted input.
- Safely extract archives.
- Prevent path traversal.
- Enforce max archive size.
- Enforce max extracted file count.
- Enforce max individual file size.
- Enforce multipart upload file count and per-file size limits before extraction.
- Skip binary and generated files.
- Denylist secret files.
- Redact likely secrets before AI prompt construction.
- Never log uploaded source code by default.
- Never log secrets.
- Never log full AI prompts containing private source.
- Delete temporary artifacts according to retention policy.

## Denylisted Files

Never send these to AI:

```text
.env
.env.*
*.pem
*.key
*.p12
*.pfx
id_rsa
id_ed25519
secrets.*
credentials.*
```

Skip these by default:

```text
node_modules/**
dist/**
build/**
.next/**
coverage/**
.cache/**
.git/**
*.png
*.jpg
*.jpeg
*.gif
*.webp
*.pdf
*.zip
*.tar
*.gz
```

## Secret Redaction Targets

Redact likely:

- API keys;
- access tokens;
- private keys;
- passwords;
- JWT secrets;
- database URLs;
- OAuth client secrets;
- webhook secrets;
- SSH keys;
- cloud provider credentials.

## Archive Extraction Requirements

Extraction must reject:

- absolute paths;
- `..` path traversal;
- symlinks that escape the extraction root;
- files exceeding size limits;
- archives exceeding file count limits;
- nested archive recursion unless explicitly allowed.

## API Security

- Validate all request bodies with schemas or DTOs.
- Validate uploaded files before extraction.
- Limit uploaded file count and size at the HTTP boundary.
- Return safe error messages.
- Do not expose local filesystem paths.
- Add rate limits for public deployments.
- Make retention and cleanup explicit.

## AI Prompt Safety

Before sending context to AI:

1. Apply denylist.
2. Apply binary/generated filters.
3. Redact secrets.
4. Convert source to summaries or selected snippets.
5. Attach source references.
6. Validate prompt payload size.

If secret detection has high confidence and redaction cannot make content safe, fail closed and require user action.
