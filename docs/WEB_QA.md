# Web QA

This document records operator UI checks for the Web surface.

## Responsive Verification

Latest verification:

```text
Date: 2026-05-29
URL: http://localhost:5173
Viewports:
- 1440x900
- 390x844
```

Verified:

- application root renders;
- upload panel is visible;
- run status region is visible;
- generate button is visible and labeled;
- upload limit copy fits within the dropzone;
- no obvious text overlap in the first viewport;
- mobile layout stacks source and result panels without horizontal overflow in the initial state.

## Accessibility Checks

Current expected behavior:

- run status uses `role="status"` and `aria-live="polite"`;
- run error detail uses `role="alert"`;
- source archive input has an accessible label;
- progress element exposes a readable `aria-valuetext`;
- generate action is disabled while generation is already creating, uploading, or running;
- download buttons have format-specific accessible labels.
- failed run messages are sanitized before display and must not expose raw provider keys, denied source evidence, or API run storage paths.

## Manual Follow-Up Areas

Before treating the Web UI as a polished operator console, manually verify:

- keyboard navigation through upload, source rows, role selects, generate, page list, and download controls;
- long source names in the source list;
- multiple uploaded files on narrow mobile widths;
- completed documentation preview with long Markdown lines;
- failed upload and failed generation states with real API errors.

## Completed-State Verification

Latest verification:

```text
Date: 2026-05-29
API URL: http://localhost:3300
Web URL: http://localhost:5173
Input fixture:
- frontend.tar
- backend.tar
Viewports:
- 1440x900
- 390x844
```

Verified:

- frontend and backend archives can be uploaded together through the Web UI;
- source rows render with editable names and role selectors;
- roles can be assigned as `frontend` and `backend`;
- generation reaches the completed state with progress `7/7`;
- generated page navigation renders all 14 documentation pages;
- page navigation updates the Markdown preview;
- the overview preview lists both uploaded sources and roles;
- the API Contracts preview shows matched frontend/backend routes;
- markdown-tree, single-markdown, and JSON download buttons render with accessible labels;
- JSON download starts from the API and returns `documentation-tree.json`;
- desktop completed state has no obvious first-viewport overlap;
- mobile completed state stacks source rows, status, page navigation, downloads, and preview without horizontal overflow.

## Automated Completed-State Regression

Run:

```bash
pnpm web:completed-state
```

Covered:

- multi-archive selection in the Web upload control;
- source role changes before generation;
- output format selection before generation;
- upload metadata sent to the API contract;
- completed status and progress rendering;
- generated warning display;
- generated page navigation and Markdown preview updates;
- download controls aligned to the selected output formats.

This regression complements the manual browser verification above. It runs without private archives and uses API-shaped mocked responses to catch Web flow regressions quickly.

## Generated Warning Display

Expected behavior:

- generated documentation warnings render in the completed state;
- warnings are exposed through a labeled `region` so operators can find them without opening JSON output;
- warning level and message are visible above generated page navigation;
- warning display does not block page preview or download controls.

## Failed Run Error Display

Expected behavior:

- standardized API error codes remain visible in failed generation states;
- expired run and missing-artifact API envelopes render as operator-facing status text;
- Web-rendered error text redacts raw provider keys, denied `.env` evidence, denied-source values, and API run storage paths;
- stale artifact content must not appear in the failed state after run storage cleanup.

## Run History Display

Expected behavior:

- operators can refresh recent documentation run summaries from the API;
- operators can choose a recent-run limit before refreshing history;
- operators can choose a recent-run status filter before refreshing history;
- operators can choose a recent-run source role filter before refreshing history;
- operators can enter a recent-run name search filter before refreshing history;
- operators can choose a recent-run output format filter before refreshing history;
- operators can enter recent-run source-count range filters before refreshing history;
- operators can choose a recent-run sort direction, including completion-time and duration ordering, before refreshing history;
- operators can enter recent-run created-at range filters before refreshing history;
- operators can enter recent-run completed-at range filters before refreshing history;
- operators can enter recent-run updated-at range filters before refreshing history;
- operators can request the next page of recent runs when the API returns a pagination cursor;
- pagination preserves selected limit, status, role, name, output-format, source-count, sort direction, created-at, completed-at, and updated-at filters;
- recent runs show status, source count, terminal duration, and rendered formats when available;
- run history rendering remains a thin API client and does not perform analysis, generation, rendering, or cleanup logic in the Web app;
- run history text redacts raw provider keys, denied `.env` evidence, denied-source values, upload storage paths, and artifact paths.
- run history cursor errors render as sanitized operator-facing API errors without exposing raw cursor input or storage paths.
- run history name errors render as sanitized operator-facing API errors without exposing raw name input or storage paths.
- run history format errors render as sanitized operator-facing API errors without exposing raw format input or storage paths.
- run history source-count errors render as sanitized operator-facing API errors without exposing raw source-count input or storage paths.
- run history sort errors render as sanitized operator-facing API errors without exposing raw sort input or storage paths.
- run history created-at errors render as sanitized operator-facing API errors without exposing raw timestamp input or storage paths.
- run history completed-at errors render as sanitized operator-facing API errors without exposing raw timestamp input or storage paths.
- run history updated-at errors render as sanitized operator-facing API errors without exposing raw timestamp input or storage paths.

## Output Format Selection

Expected behavior:

- operators can choose one or more output formats before generation;
- generation is blocked with a clear status message when no output format is selected;
- the create-run API request includes only the selected output formats;
- completed-state download controls show only formats rendered for that run.
- when the API returns `renderedFormats`, completed-state download controls should use that list even if it differs from the pre-run selected formats.

Browser verification:

- checked the running Web app at `http://localhost:5173/`;
- confirmed markdown tree, single Markdown, and JSON are selected by default;
- toggled the running UI down to JSON-only and confirmed checkbox state updates correctly;
- checked the desktop first viewport with the format panel visible and no obvious overlap;
- checked the mobile first viewport with no horizontal document overflow;
- reduced the mobile heading size and constrained the topbar text container after the narrow viewport exposed heading clipping.

Rendered format browser verification:

- ran the Web app against a mock API that returned `renderedFormats: ["single-markdown"]` after all three formats were selected before generation;
- uploaded a synthetic archive through the browser file input and completed the run flow;
- confirmed the completed status and Markdown preview rendered;
- confirmed the completed download row displayed only `single-markdown`.

## Supported Archive Guidance

Expected behavior:

- the upload control accepts `.zip`, `.tar`, `.tar.gz`, and `.tgz`;
- visible upload guidance lists the same archive types supported by the API.

Browser verification:

- checked the running Web app at `http://localhost:5173/`;
- confirmed the file input `accept` attribute is `.zip,.tar,.tar.gz,.tgz`;
- confirmed the dropzone displays `Supports .zip, .tar, .tar.gz, .tgz`.

## Client-Side Archive Type Validation

Expected behavior:

- selecting an unsupported file name shows a status message before upload;
- unsupported selections do not add source rows;
- supported archive checks match the API-supported `.zip`, `.tar`, `.tar.gz`, and `.tgz` extensions.

Browser verification:

- selected a synthetic `notes.txt` file through the browser file input;
- confirmed the status message `notes.txt is not a supported source archive.`;
- confirmed no source row was added.
