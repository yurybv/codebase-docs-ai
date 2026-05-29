# Decisions

## 2026-05-29: Core Product Is Integration-Agnostic

Decision:

The core product accepts archives/folders and returns documentation output. GitHub and Confluence are future adapters.

Reason:

This makes the module usable by any host application and avoids coupling the product to one source or publishing provider.

## 2026-05-29: HTTP API Is The Universal Integration Surface

Decision:

The module must expose an HTTP API as the primary external contract.

Reason:

Node.js SDK is useful only for Node.js/TypeScript projects. HTTP allows integration from any language or platform.

## 2026-05-29: UI Is A Testing And Operator Surface

Decision:

The Web UI is required, but it should stay thin and call the API.

Reason:

The product must be testable manually, but core value belongs in the engine and API.

## 2026-05-29: Multi-Source Analysis Is Required

Decision:

The engine must support multiple uploaded sources, such as frontend and backend archives, and analyze them together.

Reason:

Useful technical documentation often requires understanding relationships between repositories, not only one repository in isolation.

## 2026-05-29: Documentation Is English

Decision:

Project documentation, specs, workflow docs, and prompt contracts should be written in English.

Reason:

English is the most practical language for code comments, prompts, API contracts, and generated engineering documentation.
