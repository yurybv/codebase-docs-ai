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
- upload metadata sent to the API contract;
- completed status and progress rendering;
- generated page navigation and Markdown preview updates;
- JSON download URL generation.

This regression complements the manual browser verification above. It runs without private archives and uses API-shaped mocked responses to catch Web flow regressions quickly.
