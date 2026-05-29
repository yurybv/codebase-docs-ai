// @vitest-environment jsdom

import React, { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './main.js';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('App API error handling', () => {
  it('shows standardized API error code and message during generation', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'INVALID_DOCUMENTATION_RUN',
            message: 'Documentation run request is invalid.'
          }
        }),
        {
          status: 400,
          headers: {
            'content-type': 'application/json'
          }
        }
      )
    );

    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    const root = ReactDOM.createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['zip'], 'frontend.zip', {
      type: 'application/zip'
    });
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      configurable: true
    });

    await act(async () => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const generateButton = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Generate')
    );
    expect(generateButton).toBeDefined();

    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.textContent).toContain(
      'INVALID_DOCUMENTATION_RUN: Documentation run request is invalid.'
    );
  });

  it('exposes accessible status and upload controls', async () => {
    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    const root = ReactDOM.createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });

    expect(document.querySelector('[role="status"]')?.textContent).toContain(
      'Upload archives and start a documentation run.'
    );
    expect(document.querySelector('input[type="file"]')?.getAttribute('aria-label')).toBe(
      'Upload source archives'
    );
    expect(document.querySelector('input[type="file"]')?.getAttribute('accept')).toBe(
      '.zip,.tar,.tar.gz,.tgz'
    );
    expect(document.body.textContent).toContain('Supports .zip, .tar, .tar.gz, .tgz');
    expect(
      Array.from(document.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('Generate')
      )?.getAttribute('aria-label')
    ).toBe('Generate documentation');
  });

  it('shows a client-side error for unsupported archive file selections', async () => {
    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    const root = ReactDOM.createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      value: [
        new File(['notes'], 'notes.txt', {
          type: 'text/plain'
        })
      ],
      configurable: true
    });

    await act(async () => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(document.querySelector('[role="status"]')?.textContent).toContain(
      'notes.txt is not a supported source archive.'
    );
    expect(document.querySelectorAll('.source-row')).toHaveLength(0);
  });

  it('runs the completed documentation UI flow against the API contract', async () => {
    let createdRunBody:
      | {
          options?: {
            outputFormats?: string[];
          };
        }
      | undefined;
    let uploadedMetadata:
      | {
          sources: Array<{
            name: string;
            role: string;
          }>;
        }
      | undefined;
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/v1/documentation-runs') && init?.method === 'POST') {
        createdRunBody = JSON.parse(String(init.body)) as {
          options?: {
            outputFormats?: string[];
          };
        };
        return jsonResponse({
          runId: 'run_completed_ui',
          status: 'created'
        });
      }

      if (url.endsWith('/v1/documentation-runs/run_completed_ui/sources')) {
        expect(init?.method).toBe('POST');
        expect(init?.body).toBeInstanceOf(FormData);
        uploadedMetadata = JSON.parse(String((init?.body as FormData).get('metadata'))) as {
          sources: Array<{
            name: string;
            role: string;
          }>;
        };

        return jsonResponse({
          runId: 'run_completed_ui',
          status: 'ready'
        });
      }

      if (url.endsWith('/v1/documentation-runs/run_completed_ui/start')) {
        expect(init?.method).toBe('POST');
        return jsonResponse({
          runId: 'run_completed_ui',
          status: 'completed'
        });
      }

      if (url.endsWith('/v1/documentation-runs/run_completed_ui')) {
        return jsonResponse({
          id: 'run_completed_ui',
          status: 'completed',
          progress: {
            currentStep: 'Documentation run completed',
            completedSteps: 7,
            totalSteps: 7
          }
        });
      }

      if (url.endsWith('/v1/documentation-runs/run_completed_ui/result')) {
        return jsonResponse({
          runId: 'run_completed_ui',
          status: 'completed',
          renderedFormats: ['json'],
          documentation: {
            pages: completedDocumentationPages(),
            warnings: [
              {
                level: 'warning',
                message: 'Backend exposes an unmatched route.'
              }
            ]
          }
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });
    const openMock = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    const root = ReactDOM.createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      value: [
        new File(['frontend'], 'frontend.tar', {
          type: 'application/x-tar'
        }),
        new File(['backend'], 'backend.tar', {
          type: 'application/x-tar'
        })
      ],
      configurable: true
    });

    await act(async () => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const roleSelects = Array.from(document.querySelectorAll('select'));
    expect(roleSelects).toHaveLength(2);
    const [frontendRoleSelect] = roleSelects as [HTMLSelectElement, HTMLSelectElement];
    frontendRoleSelect.value = 'frontend';
    await act(async () => {
      frontendRoleSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const backendRoleSelect = document.querySelectorAll('select')[1] as HTMLSelectElement;
    backendRoleSelect.value = 'backend';
    await act(async () => {
      backendRoleSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    for (const label of ['Include markdown-tree output', 'Include single-markdown output']) {
      const checkbox = document.querySelector(
        `input[aria-label="${label}"]`
      ) as HTMLInputElement | null;
      expect(checkbox?.checked).toBe(true);
      await act(async () => {
        checkbox?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
    }

    await act(async () => {
      getButtonByText('Generate').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForText('Documentation generated.');

    expect(createdRunBody?.options?.outputFormats).toEqual(['json']);
    expect(uploadedMetadata?.sources).toEqual([
      expect.objectContaining({
        name: 'frontend',
        role: 'frontend'
      }),
      expect.objectContaining({
        name: 'backend',
        role: 'backend'
      })
    ]);
    expect(document.body.textContent).toContain('Documentation run completed (7/7)');
    expect(document.querySelector('[aria-label="Generated documentation warnings"]')?.textContent).toContain(
      'Backend exposes an unmatched route.'
    );
    expect(document.body.textContent).toContain('01. Overview');
    expect(document.body.textContent).toContain('14. Source References');
    expect(document.body.textContent).toContain('| frontend | frontend |');
    expect(document.body.textContent).toContain('| backend | backend |');

    await act(async () => {
      getButtonByText('06. API Contracts').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelector('pre')?.textContent).toContain('GET');
    expect(document.querySelector('pre')?.textContent).toContain('/api/users');
    expect(document.querySelector('pre')?.textContent).toContain('matched');

    expect(getButtonByText('json')).toBeDefined();
    expect(queryButtonByText('markdown-tree')).toBeNull();
    expect(queryButtonByText('single-markdown')).toBeNull();

    await act(async () => {
      getButtonByText('json').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(openMock).toHaveBeenCalledWith(
      'http://localhost:3000/v1/documentation-runs/run_completed_ui/download?format=json',
      '_blank'
    );
  });

  it('uses API-rendered formats for completed download controls', async () => {
    let createdRunBody:
      | {
          options?: {
            outputFormats?: string[];
          };
        }
      | undefined;
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/v1/documentation-runs') && init?.method === 'POST') {
        createdRunBody = JSON.parse(String(init.body)) as {
          options?: {
            outputFormats?: string[];
          };
        };
        return jsonResponse({
          runId: 'run_rendered_formats',
          status: 'created'
        });
      }

      if (url.endsWith('/v1/documentation-runs/run_rendered_formats/sources')) {
        return jsonResponse({
          runId: 'run_rendered_formats',
          status: 'ready'
        });
      }

      if (url.endsWith('/v1/documentation-runs/run_rendered_formats/start')) {
        return jsonResponse({
          runId: 'run_rendered_formats',
          status: 'completed'
        });
      }

      if (url.endsWith('/v1/documentation-runs/run_rendered_formats')) {
        return jsonResponse({
          id: 'run_rendered_formats',
          status: 'completed',
          renderedFormats: ['single-markdown'],
          progress: {
            currentStep: 'Documentation run completed',
            completedSteps: 7,
            totalSteps: 7
          }
        });
      }

      if (url.endsWith('/v1/documentation-runs/run_rendered_formats/result')) {
        return jsonResponse({
          runId: 'run_rendered_formats',
          status: 'completed',
          renderedFormats: ['single-markdown'],
          documentation: {
            pages: completedDocumentationPages(),
            warnings: []
          }
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });
    const openMock = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    const root = ReactDOM.createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      value: [
        new File(['frontend'], 'frontend.tar', {
          type: 'application/x-tar'
        })
      ],
      configurable: true
    });

    await act(async () => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      getButtonByText('Generate').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForText('Documentation generated.');

    expect(createdRunBody?.options?.outputFormats).toEqual([
      'markdown-tree',
      'single-markdown',
      'json'
    ]);
    expect(getButtonByText('single-markdown')).toBeDefined();
    expect(queryButtonByText('markdown-tree')).toBeNull();
    expect(queryButtonByText('json')).toBeNull();

    await act(async () => {
      getButtonByText('single-markdown').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(openMock).toHaveBeenCalledWith(
      'http://localhost:3000/v1/documentation-runs/run_rendered_formats/download?format=single-markdown',
      '_blank'
    );
  });

  it('renders sanitized completed results without raw secret-bearing source content', async () => {
    const rawOpenAiKey = `sk-${'i'.repeat(24)}`;
    const sanitizedMarkdown =
      '# 01. Overview\n\n| Method | Path |\n| --- | --- |\n| POST | /v1/[REDACTED_OPENAI_API_KEY] |';
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/v1/documentation-runs') && init?.method === 'POST') {
        return jsonResponse({
          runId: 'run_sanitized_result',
          status: 'created'
        });
      }

      if (url.endsWith('/v1/documentation-runs/run_sanitized_result/sources')) {
        return jsonResponse({
          runId: 'run_sanitized_result',
          status: 'ready'
        });
      }

      if (url.endsWith('/v1/documentation-runs/run_sanitized_result/start')) {
        return jsonResponse({
          runId: 'run_sanitized_result',
          status: 'completed'
        });
      }

      if (url.endsWith('/v1/documentation-runs/run_sanitized_result')) {
        return jsonResponse({
          id: 'run_sanitized_result',
          status: 'completed',
          renderedFormats: ['json'],
          progress: {
            currentStep: 'Documentation run completed',
            completedSteps: 7,
            totalSteps: 7
          }
        });
      }

      if (url.endsWith('/v1/documentation-runs/run_sanitized_result/result')) {
        return jsonResponse({
          runId: 'run_sanitized_result',
          status: 'completed',
          renderedFormats: ['json'],
          documentation: {
            pages: [
              {
                key: 'overview',
                title: '01. Overview',
                markdown: sanitizedMarkdown
              }
            ],
            warnings: [
              {
                level: 'medium',
                message: 'A source reference contained [REDACTED_OPENAI_API_KEY].'
              }
            ]
          }
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);
    const openMock = vi.spyOn(window, 'open').mockImplementation(() => null);

    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    const root = ReactDOM.createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      value: [
        new File(
          [
            `fetch("https://api.example.com/v1/${rawOpenAiKey}");\n`,
            'IGNORED_ENV=process.env.SHOULD_NOT_APPEAR\n'
          ],
          'frontend.tar',
          {
            type: 'application/x-tar'
          }
        )
      ],
      configurable: true
    });

    await act(async () => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      getButtonByText('Generate').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForText('Documentation generated.');

    const previewText = document.querySelector('pre')?.textContent ?? '';
    const warningText =
      document.querySelector('[aria-label="Generated documentation warnings"]')?.textContent ?? '';
    const renderedText = document.body.textContent ?? '';

    expect(previewText).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(warningText).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(renderedText).not.toContain(rawOpenAiKey);
    expect(renderedText).not.toContain('SHOULD_NOT_APPEAR');
    expect(renderedText).not.toContain('.env');

    await act(async () => {
      getButtonByText('json').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const openedUrl = String(openMock.mock.calls[0]?.[0] ?? '');
    expect(openedUrl).toBe(
      'http://localhost:3000/v1/documentation-runs/run_sanitized_result/download?format=json'
    );
    expect(openedUrl).not.toContain(rawOpenAiKey);
    expect(openedUrl).not.toContain('SHOULD_NOT_APPEAR');
    expect(openedUrl).not.toContain('.env');
  });

  it('requires at least one selected output format', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    const root = ReactDOM.createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      value: [
        new File(['frontend'], 'frontend.tar', {
          type: 'application/x-tar'
        })
      ],
      configurable: true
    });

    await act(async () => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    for (const checkbox of Array.from(document.querySelectorAll('.format-option input'))) {
      await act(async () => {
        checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
    }

    await act(async () => {
      getButtonByText('Generate').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.textContent).toContain(
      'Select at least one output format before generating documentation.'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: {
      'content-type': 'application/json'
    }
  });
}

function completedDocumentationPages(): Array<{ key: string; title: string; markdown: string }> {
  const pageRows: Array<[string, string, string]> = [
    ['overview', '01. Overview', '# 01. Overview\n\n| Source | Role |\n| --- | --- |\n| frontend | frontend |\n| backend | backend |'],
    ['system-architecture', '02. System Architecture', '# 02. System Architecture'],
    ['source-inventory', '03. Source Inventory', '# 03. Source Inventory'],
    ['frontend', '04. Frontend', '# 04. Frontend'],
    ['backend', '05. Backend', '# 05. Backend'],
    [
      'api-contracts',
      '06. API Contracts',
      '# 06. API Contracts\n\n| Method | Path | Status |\n| --- | --- | --- |\n| GET | /api/users | matched |'
    ],
    ['authentication-and-authorization', '07. Authentication and Authorization', '# 07. Authentication and Authorization'],
    ['environment-variables', '08. Environment Variables', '# 08. Environment Variables'],
    ['local-development', '09. Local Development', '# 09. Local Development'],
    ['testing', '10. Testing', '# 10. Testing'],
    ['build-and-deployment', '11. Build and Deployment', '# 11. Build and Deployment'],
    ['external-integrations', '12. External Integrations', '# 12. External Integrations'],
    ['risks-and-unknowns', '13. Risks and Unknowns', '# 13. Risks and Unknowns'],
    ['source-references', '14. Source References', '# 14. Source References']
  ];

  return pageRows.map(([key, title, markdown]) => ({
    key,
    title,
    markdown
  }));
}

function getButtonByText(text: string): HTMLButtonElement {
  const button = queryButtonByText(text);
  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }

  return button;
}

function queryButtonByText(text: string): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === text
    ) ?? null
  );
}

async function waitForText(text: string): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 1000) {
    if (document.body.textContent?.includes(text)) {
      return;
    }

    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });
    });
  }

  throw new Error(`Timed out waiting for text: ${text}. Current text: ${document.body.textContent ?? ''}`);
}
