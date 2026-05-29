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
