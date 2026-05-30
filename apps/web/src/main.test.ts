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

  it('renders sanitized API errors without raw secret-bearing source content', async () => {
    const rawOpenAiKey = `sk-${'u'.repeat(24)}`;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'SOURCE_UPLOAD_INVALID',
            message: 'Source upload failed for [REDACTED_OPENAI_API_KEY] in [REDACTED_DENIED_FILE].'
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
    const file = new File(
      [
        `fetch("https://api.example.com/v1/${rawOpenAiKey}");\n`,
        'IGNORED_ENV=process.env.SHOULD_NOT_APPEAR\n'
      ],
      'frontend.zip',
      {
        type: 'application/zip'
      }
    );
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      configurable: true
    });

    await act(async () => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      getButtonByText('Generate').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const renderedText = document.body.textContent ?? '';
    expect(renderedText).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(renderedText).toContain('[REDACTED_DENIED_FILE]');
    expect(renderedText).not.toContain(rawOpenAiKey);
    expect(renderedText).not.toContain('SHOULD_NOT_APPEAR');
    expect(renderedText).not.toContain('.env');
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
      Array.from(document.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Generate'))
        ?.getAttribute('aria-label')
    ).toBe('Generate documentation');
  });

  it('renders sanitized run history summaries from the API contract', async () => {
    const rawOpenAiKey = `sk-${'r'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/prefix_${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR/run.json`;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        runs: [
          {
            id: 'run_created',
            name: `Created ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
            status: 'created',
            sources: [],
            sourceCount: 0,
            outputFormats: ['json'],
            createdAt: '2026-05-30T00:00:00.000Z',
            updatedAt: '2026-05-30T00:00:00.000Z'
          },
          {
            id: 'run_completed',
            name: 'Completed Docs',
            status: 'completed',
            sources: [
              {
                name: `Frontend ${rawStoragePath}`,
                role: 'frontend'
              }
            ],
            sourceCount: 1,
            outputFormats: ['single-markdown'],
            renderedFormats: ['single-markdown'],
            createdAt: '2026-05-30T00:00:00.000Z',
            updatedAt: '2026-05-30T00:01:00.000Z'
          },
          {
            id: 'run_failed',
            name: 'Failed Docs',
            status: 'failed',
            sources: [
              {
                name: `Backend .env SHOULD_NOT_APPEAR ${rawOpenAiKey}`,
                role: 'backend'
              }
            ],
            sourceCount: 1,
            outputFormats: ['json'],
            error: {
              message: `Documentation generation failed at ${rawStoragePath}.`
            },
            createdAt: '2026-05-30T00:00:00.000Z',
            updatedAt: '2026-05-30T00:02:00.000Z'
          }
        ]
      })
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    const root = ReactDOM.createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });

    await act(async () => {
      getButtonByText('Refresh').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForText('Completed Docs');

    const renderedText = document.body.textContent ?? '';
    expect(renderedText).toContain('Recent runs');
    expect(renderedText).toContain('created · 0 sources');
    expect(renderedText).toContain('completed · 1 source');
    expect(renderedText).toContain('failed · 1 source');
    expect(renderedText).toContain('single-markdown');
    expect(renderedText).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(renderedText).toContain('[REDACTED_DENIED_FILE]');
    expect(renderedText).toContain('[REDACTED_DENIED_VALUE]');
    expect(renderedText).not.toContain(rawStoragePath);
    expect(renderedText).not.toContain('/private/tmp');
    expect(renderedText).not.toContain(rawOpenAiKey);
    expect(renderedText).not.toContain('.env');
    expect(renderedText).not.toContain('SHOULD_NOT_APPEAR');
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/v1/documentation-runs?limit=50');
  });

  it('requests run history with selected limit, status, role, name, created-at, completed-at, and updated-at range while preserving sanitized summaries', async () => {
    const rawOpenAiKey = `sk-${'s'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR/run.json`;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        runs: [
          {
            id: 'run_limited',
            name: `Limited ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
            status: 'failed',
            sources: [
              {
                name: `Backend ${rawStoragePath}`,
                role: 'backend'
              }
            ],
            sourceCount: 1,
            outputFormats: ['json'],
            renderedFormats: ['json'],
            createdAt: '2026-05-30T00:00:00.000Z',
            updatedAt: '2026-05-30T00:01:00.000Z'
          }
        ]
      })
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    const root = ReactDOM.createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });

    const limitSelect = document.querySelector(
      'select[aria-label="Recent run limit"]'
    ) as HTMLSelectElement;
    limitSelect.value = '10';
    await act(async () => {
      limitSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const statusSelect = document.querySelector(
      'select[aria-label="Recent run status"]'
    ) as HTMLSelectElement;
    statusSelect.value = 'failed';
    await act(async () => {
      statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const roleSelect = document.querySelector(
      'select[aria-label="Recent run source role"]'
    ) as HTMLSelectElement;
    roleSelect.value = 'backend';
    await act(async () => {
      roleSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const nameInput = document.querySelector(
      'input[aria-label="Recent run name"]'
    ) as HTMLInputElement;
    await act(async () => {
      setTextInputValue(nameInput, 'backend search');
    });
    const formatSelect = document.querySelector(
      'select[aria-label="Recent run output format"]'
    ) as HTMLSelectElement;
    formatSelect.value = 'json';
    await act(async () => {
      formatSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const minSourcesInput = document.querySelector(
      'input[aria-label="Recent run minimum sources"]'
    ) as HTMLInputElement;
    await act(async () => {
      setTextInputValue(minSourcesInput, '1');
    });
    const maxSourcesInput = document.querySelector(
      'input[aria-label="Recent run maximum sources"]'
    ) as HTMLInputElement;
    await act(async () => {
      setTextInputValue(maxSourcesInput, '2');
    });
    const sortSelect = document.querySelector(
      'select[aria-label="Recent run sort"]'
    ) as HTMLSelectElement;
    sortSelect.value = 'createdAt:asc';
    await act(async () => {
      sortSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const createdAfterInput = document.querySelector(
      'input[aria-label="Recent run created after"]'
    ) as HTMLInputElement;
    await act(async () => {
      setTextInputValue(createdAfterInput, '2026-05-29T23:59:30.000Z');
    });
    const createdBeforeInput = document.querySelector(
      'input[aria-label="Recent run created before"]'
    ) as HTMLInputElement;
    await act(async () => {
      setTextInputValue(createdBeforeInput, '2026-05-30T00:00:30.000Z');
    });
    const completedAfterInput = document.querySelector(
      'input[aria-label="Recent run completed after"]'
    ) as HTMLInputElement;
    await act(async () => {
      setTextInputValue(completedAfterInput, '2026-05-30T00:00:30.000Z');
    });
    const completedBeforeInput = document.querySelector(
      'input[aria-label="Recent run completed before"]'
    ) as HTMLInputElement;
    await act(async () => {
      setTextInputValue(completedBeforeInput, '2026-05-30T00:01:30.000Z');
    });
    const updatedAfterInput = document.querySelector(
      'input[aria-label="Recent run updated after"]'
    ) as HTMLInputElement;
    await act(async () => {
      setTextInputValue(updatedAfterInput, '2026-05-30T00:00:30.000Z');
    });
    const updatedBeforeInput = document.querySelector(
      'input[aria-label="Recent run updated before"]'
    ) as HTMLInputElement;
    await act(async () => {
      setTextInputValue(updatedBeforeInput, '2026-05-30T00:01:30.000Z');
    });

    await act(async () => {
      getButtonByText('Refresh').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForText('failed · 1 source');

    const renderedText = document.body.textContent ?? '';
    expect(renderedText).toContain('json');
    expect(renderedText).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(renderedText).toContain('[REDACTED_DENIED_FILE]');
    expect(renderedText).toContain('[REDACTED_DENIED_VALUE]');
    expect(renderedText).not.toContain(rawStoragePath);
    expect(renderedText).not.toContain(rawOpenAiKey);
    expect(renderedText).not.toContain('.env');
    expect(renderedText).not.toContain('SHOULD_NOT_APPEAR');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/v1/documentation-runs?limit=10&status=failed&role=backend&name=backend+search&format=json&minSources=1&maxSources=2&sort=createdAt%3Aasc&createdAfter=2026-05-29T23%3A59%3A30.000Z&createdBefore=2026-05-30T00%3A00%3A30.000Z&completedAfter=2026-05-30T00%3A00%3A30.000Z&completedBefore=2026-05-30T00%3A01%3A30.000Z&updatedAfter=2026-05-30T00%3A00%3A30.000Z&updatedBefore=2026-05-30T00%3A01%3A30.000Z'
    );
  });

  it('loads additional run history pages with the returned cursor and selected filters', async () => {
    const rawOpenAiKey = `sk-${'w'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR/run.json`;
    const cursor =
      'eyJ1cGRhdGVkQXQiOiIyMDI2LTA1LTMwVDAwOjAxOjAwLjAwMFoiLCJpZCI6InJ1bl8xMjMifQ';
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          runs: [
            {
              id: 'run_page_one',
              name: `Page One ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
              status: 'completed',
              sources: [
                {
                  name: `Backend ${rawStoragePath}`,
                  role: 'backend'
                }
              ],
              sourceCount: 1,
              outputFormats: ['json'],
              renderedFormats: ['json'],
              createdAt: '2026-05-30T00:00:00.000Z',
              updatedAt: '2026-05-30T00:02:00.000Z'
            }
          ],
          nextCursor: cursor
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          runs: [
            {
              id: 'run_page_two',
              name: `Page Two ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
              status: 'completed',
              sources: [
                {
                  name: `Backend ${rawStoragePath}`,
                  role: 'backend'
                }
              ],
              sourceCount: 1,
              outputFormats: ['json'],
              renderedFormats: ['json'],
              createdAt: '2026-05-30T00:00:00.000Z',
              updatedAt: '2026-05-30T00:01:00.000Z'
            }
          ]
        })
      );
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    const root = ReactDOM.createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });

    const limitSelect = document.querySelector(
      'select[aria-label="Recent run limit"]'
    ) as HTMLSelectElement;
    limitSelect.value = '10';
    await act(async () => {
      limitSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const statusSelect = document.querySelector(
      'select[aria-label="Recent run status"]'
    ) as HTMLSelectElement;
    statusSelect.value = 'completed';
    await act(async () => {
      statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const roleSelect = document.querySelector(
      'select[aria-label="Recent run source role"]'
    ) as HTMLSelectElement;
    roleSelect.value = 'backend';
    await act(async () => {
      roleSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const nameInput = document.querySelector(
      'input[aria-label="Recent run name"]'
    ) as HTMLInputElement;
    await act(async () => {
      setTextInputValue(nameInput, 'backend search');
    });
    const formatSelect = document.querySelector(
      'select[aria-label="Recent run output format"]'
    ) as HTMLSelectElement;
    formatSelect.value = 'json';
    await act(async () => {
      formatSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const minSourcesInput = document.querySelector(
      'input[aria-label="Recent run minimum sources"]'
    ) as HTMLInputElement;
    await act(async () => {
      setTextInputValue(minSourcesInput, '1');
    });
    const maxSourcesInput = document.querySelector(
      'input[aria-label="Recent run maximum sources"]'
    ) as HTMLInputElement;
    await act(async () => {
      setTextInputValue(maxSourcesInput, '2');
    });
    const sortSelect = document.querySelector(
      'select[aria-label="Recent run sort"]'
    ) as HTMLSelectElement;
    sortSelect.value = 'createdAt:asc';
    await act(async () => {
      sortSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const createdAfterInput = document.querySelector(
      'input[aria-label="Recent run created after"]'
    ) as HTMLInputElement;
    await act(async () => {
      setTextInputValue(createdAfterInput, '2026-05-29T23:59:30.000Z');
    });
    const createdBeforeInput = document.querySelector(
      'input[aria-label="Recent run created before"]'
    ) as HTMLInputElement;
    await act(async () => {
      setTextInputValue(createdBeforeInput, '2026-05-30T00:01:30.000Z');
    });
    const completedAfterInput = document.querySelector(
      'input[aria-label="Recent run completed after"]'
    ) as HTMLInputElement;
    await act(async () => {
      setTextInputValue(completedAfterInput, '2026-05-30T00:00:45.000Z');
    });
    const completedBeforeInput = document.querySelector(
      'input[aria-label="Recent run completed before"]'
    ) as HTMLInputElement;
    await act(async () => {
      setTextInputValue(completedBeforeInput, '2026-05-30T00:02:00.000Z');
    });
    const updatedAfterInput = document.querySelector(
      'input[aria-label="Recent run updated after"]'
    ) as HTMLInputElement;
    await act(async () => {
      setTextInputValue(updatedAfterInput, '2026-05-30T00:00:30.000Z');
    });
    const updatedBeforeInput = document.querySelector(
      'input[aria-label="Recent run updated before"]'
    ) as HTMLInputElement;
    await act(async () => {
      setTextInputValue(updatedBeforeInput, '2026-05-30T00:02:30.000Z');
    });

    await act(async () => {
      getButtonByText('Refresh').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForText('Page One');
    await act(async () => {
      getButtonByText('Load more').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForText('Page Two');

    const renderedText = document.body.textContent ?? '';
    expect(renderedText).toContain('Page One');
    expect(renderedText).toContain('Page Two');
    expect(renderedText).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(renderedText).toContain('[REDACTED_DENIED_FILE]');
    expect(renderedText).toContain('[REDACTED_DENIED_VALUE]');
    expect(renderedText).not.toContain(rawStoragePath);
    expect(renderedText).not.toContain(rawOpenAiKey);
    expect(renderedText).not.toContain('/private/tmp');
    expect(renderedText).not.toContain('.env');
    expect(renderedText).not.toContain('SHOULD_NOT_APPEAR');
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/v1/documentation-runs?limit=10&status=completed&role=backend&name=backend+search&format=json&minSources=1&maxSources=2&sort=createdAt%3Aasc&createdAfter=2026-05-29T23%3A59%3A30.000Z&createdBefore=2026-05-30T00%3A01%3A30.000Z&completedAfter=2026-05-30T00%3A00%3A45.000Z&completedBefore=2026-05-30T00%3A02%3A00.000Z&updatedAfter=2026-05-30T00%3A00%3A30.000Z&updatedBefore=2026-05-30T00%3A02%3A30.000Z'
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `http://localhost:3000/v1/documentation-runs?limit=10&status=completed&role=backend&name=backend+search&format=json&minSources=1&maxSources=2&sort=createdAt%3Aasc&createdAfter=2026-05-29T23%3A59%3A30.000Z&createdBefore=2026-05-30T00%3A01%3A30.000Z&completedAfter=2026-05-30T00%3A00%3A45.000Z&completedBefore=2026-05-30T00%3A02%3A00.000Z&updatedAfter=2026-05-30T00%3A00%3A30.000Z&updatedBefore=2026-05-30T00%3A02%3A30.000Z&cursor=${cursor}`
    );
  });

  it('sanitizes run history limit API errors before rendering', async () => {
    const rawOpenAiKey = `sk-${'t'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonErrorResponse(400, 'RUN_LIST_LIMIT_INVALID', {
        message: `Invalid run list limit from ${rawStoragePath}.`,
        details: {
          limit: rawStoragePath
        }
      })
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    const root = ReactDOM.createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });

    await act(async () => {
      getButtonByText('Refresh').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForText('RUN_LIST_LIMIT_INVALID');

    const renderedText = document.body.textContent ?? '';
    expect(renderedText).toContain('RUN_LIST_LIMIT_INVALID');
    expect(renderedText).toContain('[REDACTED_STORAGE_PATH]');
    expect(renderedText).not.toContain(rawStoragePath);
    expect(renderedText).not.toContain(rawOpenAiKey);
    expect(renderedText).not.toContain('/private/tmp');
    expect(renderedText).not.toContain('.env');
    expect(renderedText).not.toContain('SHOULD_NOT_APPEAR');
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/v1/documentation-runs?limit=50');
  });

  it('sanitizes run history status API errors before rendering', async () => {
    const rawOpenAiKey = `sk-${'u'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonErrorResponse(400, 'RUN_LIST_STATUS_INVALID', {
        message: `Invalid run list status from ${rawStoragePath}.`,
        details: {
          status: rawStoragePath
        }
      })
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    const root = ReactDOM.createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });

    await act(async () => {
      getButtonByText('Refresh').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForText('RUN_LIST_STATUS_INVALID');

    const renderedText = document.body.textContent ?? '';
    expect(renderedText).toContain('RUN_LIST_STATUS_INVALID');
    expect(renderedText).toContain('[REDACTED_STORAGE_PATH]');
    expect(renderedText).not.toContain(rawStoragePath);
    expect(renderedText).not.toContain(rawOpenAiKey);
    expect(renderedText).not.toContain('/private/tmp');
    expect(renderedText).not.toContain('.env');
    expect(renderedText).not.toContain('SHOULD_NOT_APPEAR');
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/v1/documentation-runs?limit=50');
  });

  it('sanitizes run history source role API errors before rendering', async () => {
    const rawOpenAiKey = `sk-${'v'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonErrorResponse(400, 'RUN_LIST_SOURCE_ROLE_INVALID', {
        message: `Invalid run list source role from ${rawStoragePath}.`,
        details: {
          role: rawStoragePath
        }
      })
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    const root = ReactDOM.createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });

    await act(async () => {
      getButtonByText('Refresh').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForText('RUN_LIST_SOURCE_ROLE_INVALID');

    const renderedText = document.body.textContent ?? '';
    expect(renderedText).toContain('RUN_LIST_SOURCE_ROLE_INVALID');
    expect(renderedText).toContain('[REDACTED_STORAGE_PATH]');
    expect(renderedText).not.toContain(rawStoragePath);
    expect(renderedText).not.toContain(rawOpenAiKey);
    expect(renderedText).not.toContain('/private/tmp');
    expect(renderedText).not.toContain('.env');
    expect(renderedText).not.toContain('SHOULD_NOT_APPEAR');
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/v1/documentation-runs?limit=50');
  });

  it('sanitizes run history name API errors before rendering', async () => {
    const rawOpenAiKey = `sk-${'p'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonErrorResponse(400, 'RUN_LIST_NAME_INVALID', {
        message: `Invalid run list name from ${rawStoragePath}.`,
        details: {
          name: rawStoragePath
        }
      })
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    const root = ReactDOM.createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });

    const nameInput = document.querySelector(
      'input[aria-label="Recent run name"]'
    ) as HTMLInputElement;
    await act(async () => {
      setTextInputValue(nameInput, 'backend search');
    });

    await act(async () => {
      getButtonByText('Refresh').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForText('RUN_LIST_NAME_INVALID');

    const renderedText = document.body.textContent ?? '';
    expect(renderedText).toContain('RUN_LIST_NAME_INVALID');
    expect(renderedText).toContain('[REDACTED_STORAGE_PATH]');
    expect(renderedText).not.toContain(rawStoragePath);
    expect(renderedText).not.toContain(rawOpenAiKey);
    expect(renderedText).not.toContain('/private/tmp');
    expect(renderedText).not.toContain('.env');
    expect(renderedText).not.toContain('SHOULD_NOT_APPEAR');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/v1/documentation-runs?limit=50&name=backend+search'
    );
  });

  it('sanitizes run history format API errors before rendering', async () => {
    const rawOpenAiKey = `sk-${'f'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonErrorResponse(400, 'RUN_LIST_FORMAT_INVALID', {
        message: `Invalid run list format from ${rawStoragePath}.`,
        details: {
          format: rawStoragePath
        }
      })
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    const root = ReactDOM.createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });

    const formatSelect = document.querySelector(
      'select[aria-label="Recent run output format"]'
    ) as HTMLSelectElement;
    formatSelect.value = 'json';
    await act(async () => {
      formatSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      getButtonByText('Refresh').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForText('RUN_LIST_FORMAT_INVALID');

    const renderedText = document.body.textContent ?? '';
    expect(renderedText).toContain('RUN_LIST_FORMAT_INVALID');
    expect(renderedText).toContain('[REDACTED_STORAGE_PATH]');
    expect(renderedText).not.toContain(rawStoragePath);
    expect(renderedText).not.toContain(rawOpenAiKey);
    expect(renderedText).not.toContain('/private/tmp');
    expect(renderedText).not.toContain('.env');
    expect(renderedText).not.toContain('SHOULD_NOT_APPEAR');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/v1/documentation-runs?limit=50&format=json'
    );
  });

  it('sanitizes run history source count API errors before rendering', async () => {
    const rawOpenAiKey = `sk-${'g'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonErrorResponse(400, 'RUN_LIST_SOURCE_COUNT_INVALID', {
        message: `Invalid run list source count from ${rawStoragePath}.`,
        details: {
          minSources: rawStoragePath
        }
      })
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    const root = ReactDOM.createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });

    const minSourcesInput = document.querySelector(
      'input[aria-label="Recent run minimum sources"]'
    ) as HTMLInputElement;
    await act(async () => {
      setTextInputValue(minSourcesInput, '1');
    });

    await act(async () => {
      getButtonByText('Refresh').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForText('RUN_LIST_SOURCE_COUNT_INVALID');

    const renderedText = document.body.textContent ?? '';
    expect(renderedText).toContain('RUN_LIST_SOURCE_COUNT_INVALID');
    expect(renderedText).toContain('[REDACTED_STORAGE_PATH]');
    expect(renderedText).not.toContain(rawStoragePath);
    expect(renderedText).not.toContain(rawOpenAiKey);
    expect(renderedText).not.toContain('/private/tmp');
    expect(renderedText).not.toContain('.env');
    expect(renderedText).not.toContain('SHOULD_NOT_APPEAR');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/v1/documentation-runs?limit=50&minSources=1'
    );
  });

  it('sanitizes run history sort API errors before rendering', async () => {
    const rawOpenAiKey = `sk-${'h'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonErrorResponse(400, 'RUN_LIST_SORT_INVALID', {
        message: `Invalid run list sort from ${rawStoragePath}.`,
        details: {
          sort: rawStoragePath
        }
      })
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    const root = ReactDOM.createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });

    const sortSelect = document.querySelector(
      'select[aria-label="Recent run sort"]'
    ) as HTMLSelectElement;
    sortSelect.value = 'updatedAt:asc';
    await act(async () => {
      sortSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      getButtonByText('Refresh').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForText('RUN_LIST_SORT_INVALID');

    const renderedText = document.body.textContent ?? '';
    expect(renderedText).toContain('RUN_LIST_SORT_INVALID');
    expect(renderedText).toContain('[REDACTED_STORAGE_PATH]');
    expect(renderedText).not.toContain(rawStoragePath);
    expect(renderedText).not.toContain(rawOpenAiKey);
    expect(renderedText).not.toContain('/private/tmp');
    expect(renderedText).not.toContain('.env');
    expect(renderedText).not.toContain('SHOULD_NOT_APPEAR');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/v1/documentation-runs?limit=50&sort=updatedAt%3Aasc'
    );
  });

  it('sanitizes run history updated-at API errors before rendering', async () => {
    const rawOpenAiKey = `sk-${'q'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonErrorResponse(400, 'RUN_LIST_UPDATED_AFTER_INVALID', {
        message: `Invalid run list updatedAfter from ${rawStoragePath}.`,
        details: {
          updatedAfter: rawStoragePath
        }
      })
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    const root = ReactDOM.createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });

    const updatedAfterInput = document.querySelector(
      'input[aria-label="Recent run updated after"]'
    ) as HTMLInputElement;
    await act(async () => {
      setTextInputValue(updatedAfterInput, '2026-05-30T00:00:30.000Z');
    });

    await act(async () => {
      getButtonByText('Refresh').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForText('RUN_LIST_UPDATED_AFTER_INVALID');

    const renderedText = document.body.textContent ?? '';
    expect(renderedText).toContain('RUN_LIST_UPDATED_AFTER_INVALID');
    expect(renderedText).toContain('[REDACTED_STORAGE_PATH]');
    expect(renderedText).not.toContain(rawStoragePath);
    expect(renderedText).not.toContain(rawOpenAiKey);
    expect(renderedText).not.toContain('/private/tmp');
    expect(renderedText).not.toContain('.env');
    expect(renderedText).not.toContain('SHOULD_NOT_APPEAR');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/v1/documentation-runs?limit=50&updatedAfter=2026-05-30T00%3A00%3A30.000Z'
    );
  });

  it('sanitizes run history created-at API errors before rendering', async () => {
    const rawOpenAiKey = `sk-${'v'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonErrorResponse(400, 'RUN_LIST_CREATED_AFTER_INVALID', {
        message: `Invalid run list createdAfter from ${rawStoragePath}.`,
        details: {
          createdAfter: rawStoragePath
        }
      })
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    const root = ReactDOM.createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });

    const createdAfterInput = document.querySelector(
      'input[aria-label="Recent run created after"]'
    ) as HTMLInputElement;
    await act(async () => {
      setTextInputValue(createdAfterInput, '2026-05-29T23:59:30.000Z');
    });

    await act(async () => {
      getButtonByText('Refresh').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForText('RUN_LIST_CREATED_AFTER_INVALID');

    const renderedText = document.body.textContent ?? '';
    expect(renderedText).toContain('RUN_LIST_CREATED_AFTER_INVALID');
    expect(renderedText).toContain('[REDACTED_STORAGE_PATH]');
    expect(renderedText).not.toContain(rawStoragePath);
    expect(renderedText).not.toContain(rawOpenAiKey);
    expect(renderedText).not.toContain('/private/tmp');
    expect(renderedText).not.toContain('.env');
    expect(renderedText).not.toContain('SHOULD_NOT_APPEAR');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/v1/documentation-runs?limit=50&createdAfter=2026-05-29T23%3A59%3A30.000Z'
    );
  });

  it('sanitizes run history completed-at API errors before rendering', async () => {
    const rawOpenAiKey = `sk-${'m'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonErrorResponse(400, 'RUN_LIST_COMPLETED_AFTER_INVALID', {
        message: `Invalid run list completedAfter from ${rawStoragePath}.`,
        details: {
          completedAfter: rawStoragePath
        }
      })
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    const root = ReactDOM.createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });

    const completedAfterInput = document.querySelector(
      'input[aria-label="Recent run completed after"]'
    ) as HTMLInputElement;
    await act(async () => {
      setTextInputValue(completedAfterInput, '2026-05-30T00:00:30.000Z');
    });

    await act(async () => {
      getButtonByText('Refresh').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForText('RUN_LIST_COMPLETED_AFTER_INVALID');

    const renderedText = document.body.textContent ?? '';
    expect(renderedText).toContain('RUN_LIST_COMPLETED_AFTER_INVALID');
    expect(renderedText).toContain('[REDACTED_STORAGE_PATH]');
    expect(renderedText).not.toContain(rawStoragePath);
    expect(renderedText).not.toContain(rawOpenAiKey);
    expect(renderedText).not.toContain('/private/tmp');
    expect(renderedText).not.toContain('.env');
    expect(renderedText).not.toContain('SHOULD_NOT_APPEAR');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/v1/documentation-runs?limit=50&completedAfter=2026-05-30T00%3A00%3A30.000Z'
    );
  });

  it('sanitizes run history cursor API errors before rendering', async () => {
    const rawOpenAiKey = `sk-${'x'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;
    const cursor =
      'eyJ1cGRhdGVkQXQiOiIyMDI2LTA1LTMwVDAwOjAxOjAwLjAwMFoiLCJpZCI6InJ1bl8xMjMifQ';
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          runs: [
            {
              id: 'run_page_one',
              name: 'Page One',
              status: 'completed',
              sources: [],
              sourceCount: 0,
              outputFormats: ['json'],
              createdAt: '2026-05-30T00:00:00.000Z',
              updatedAt: '2026-05-30T00:01:00.000Z'
            }
          ],
          nextCursor: cursor
        })
      )
      .mockResolvedValueOnce(
        jsonErrorResponse(400, 'RUN_LIST_CURSOR_INVALID', {
          message: `Invalid run list cursor from ${rawStoragePath}.`,
          details: {
            cursor: rawStoragePath
          }
        })
      );
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    const root = ReactDOM.createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });

    await act(async () => {
      getButtonByText('Refresh').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForText('Page One');
    await act(async () => {
      getButtonByText('Load more').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForText('RUN_LIST_CURSOR_INVALID');

    const renderedText = document.body.textContent ?? '';
    expect(renderedText).toContain('RUN_LIST_CURSOR_INVALID');
    expect(renderedText).toContain('[REDACTED_STORAGE_PATH]');
    expect(renderedText).not.toContain(rawStoragePath);
    expect(renderedText).not.toContain(rawOpenAiKey);
    expect(renderedText).not.toContain('/private/tmp');
    expect(renderedText).not.toContain('.env');
    expect(renderedText).not.toContain('SHOULD_NOT_APPEAR');
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `http://localhost:3000/v1/documentation-runs?limit=50&cursor=${cursor}`
    );
  });

  it('sanitizes returned run history cursors before reuse', async () => {
    const rawOpenAiKey = `sk-${'y'.repeat(24)}`;
    const rawCursor = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR/run.json`;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          runs: [
            {
              id: 'run_page_one',
              name: 'Page One',
              status: 'completed',
              sources: [],
              sourceCount: 0,
              outputFormats: ['json'],
              createdAt: '2026-05-30T00:00:00.000Z',
              updatedAt: '2026-05-30T00:01:00.000Z'
            }
          ],
          nextCursor: rawCursor
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          runs: []
        })
      );
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    const rootElement = document.createElement('div');
    document.body.append(rootElement);
    const root = ReactDOM.createRoot(rootElement);

    await act(async () => {
      root.render(React.createElement(App));
    });

    await act(async () => {
      getButtonByText('Refresh').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForText('Page One');
    await act(async () => {
      getButtonByText('Load more').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const renderedText = document.body.textContent ?? '';
    const secondUrl = String(fetchMock.mock.calls[1]?.[0] ?? '');
    expect(renderedText).not.toContain(rawCursor);
    expect(renderedText).not.toContain(rawOpenAiKey);
    expect(renderedText).not.toContain('/private/tmp');
    expect(renderedText).not.toContain('.env');
    expect(renderedText).not.toContain('SHOULD_NOT_APPEAR');
    expect(secondUrl).toContain('cursor=%5BREDACTED_STORAGE_PATH%5D');
    expect(secondUrl).not.toContain(rawCursor);
    expect(secondUrl).not.toContain(rawOpenAiKey);
    expect(secondUrl).not.toContain('/private/tmp');
    expect(secondUrl).not.toContain('.env');
    expect(secondUrl).not.toContain('SHOULD_NOT_APPEAR');
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

    const roleSelects = Array.from(document.querySelectorAll('select[aria-label="Source role"]'));
    expect(roleSelects).toHaveLength(2);
    const [frontendRoleSelect] = roleSelects as [HTMLSelectElement, HTMLSelectElement];
    frontendRoleSelect.value = 'frontend';
    await act(async () => {
      frontendRoleSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const backendRoleSelect = roleSelects[1] as HTMLSelectElement;
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
    expect(
      document.querySelector('[aria-label="Generated documentation warnings"]')?.textContent
    ).toContain('Backend exposes an unmatched route.');
    expect(document.body.textContent).toContain('01. Overview');
    expect(document.body.textContent).toContain('14. Source References');
    expect(document.body.textContent).toContain('| frontend | frontend |');
    expect(document.body.textContent).toContain('| backend | backend |');

    await act(async () => {
      getButtonByText('06. API Contracts').dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      );
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
          runId: 'run_rendered_formats',
          status: 'created'
        });
      }

      if (url.endsWith('/v1/documentation-runs/run_rendered_formats/sources')) {
        uploadedMetadata = JSON.parse(String((init?.body as FormData).get('metadata'))) as {
          sources: Array<{
            name: string;
            role: string;
          }>;
        };
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

    const [frontendRoleSelect, backendRoleSelect] = Array.from(
      document.querySelectorAll('select[aria-label="Source role"]')
    ) as [HTMLSelectElement, HTMLSelectElement];
    frontendRoleSelect.value = 'frontend';
    await act(async () => {
      frontendRoleSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    backendRoleSelect.value = 'backend';
    await act(async () => {
      backendRoleSelect.dispatchEvent(new Event('change', { bubbles: true }));
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
    expect(document.body.textContent).toContain('| frontend | frontend |');
    expect(document.body.textContent).toContain('| backend | backend |');
    expect(
      document.querySelector('[aria-label="Generated documentation warnings"]')?.textContent
    ).toContain('Backend exposes an unmatched route.');

    await act(async () => {
      getButtonByText('06. API Contracts').dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      );
    });
    expect(document.querySelector('pre')?.textContent).toContain('/api/users');
    expect(document.querySelector('pre')?.textContent).toContain('matched');
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
    const embeddedOpenAiKey = `prefix_${rawOpenAiKey}`;
    const sanitizedMarkdown =
      '# 01. Overview\n\n| Method | Path |\n| --- | --- |\n| POST | /v1/prefix_[REDACTED_OPENAI_API_KEY]/[REDACTED_DENIED_FILE]/[REDACTED_DENIED_VALUE] |';
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
          renderedFormats: ['markdown-tree', 'single-markdown', 'json'],
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
          renderedFormats: ['markdown-tree', 'single-markdown', 'json'],
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
                message:
                  'A source reference contained prefix_[REDACTED_OPENAI_API_KEY] in [REDACTED_DENIED_FILE] with [REDACTED_DENIED_VALUE].'
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
            `fetch("https://api.example.com/v1/${embeddedOpenAiKey}/.env/SHOULD_NOT_APPEAR");\n`,
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
    expect(previewText).toContain('prefix_[REDACTED_OPENAI_API_KEY]');
    expect(previewText).toContain('[REDACTED_DENIED_FILE]');
    expect(previewText).toContain('[REDACTED_DENIED_VALUE]');
    expect(warningText).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(warningText).toContain('prefix_[REDACTED_OPENAI_API_KEY]');
    expect(warningText).toContain('[REDACTED_DENIED_FILE]');
    expect(warningText).toContain('[REDACTED_DENIED_VALUE]');
    expect(renderedText).not.toContain(rawOpenAiKey);
    expect(renderedText).not.toContain(embeddedOpenAiKey);
    expect(renderedText).not.toContain('SHOULD_NOT_APPEAR');
    expect(renderedText).not.toContain('.env');

    for (const format of ['markdown-tree', 'single-markdown', 'json']) {
      expect(getButtonByText(format).textContent).not.toContain(rawOpenAiKey);
      await act(async () => {
        getButtonByText(format).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
    }

    expect(openMock.mock.calls.map((call) => String(call[0]))).toEqual([
      'http://localhost:3000/v1/documentation-runs/run_sanitized_result/download?format=markdown-tree',
      'http://localhost:3000/v1/documentation-runs/run_sanitized_result/download?format=single-markdown',
      'http://localhost:3000/v1/documentation-runs/run_sanitized_result/download?format=json'
    ]);
    for (const [openedUrl] of openMock.mock.calls) {
      const url = String(openedUrl);
      expect(url).not.toContain(rawOpenAiKey);
      expect(url).not.toContain(embeddedOpenAiKey);
      expect(url).not.toContain('SHOULD_NOT_APPEAR');
      expect(url).not.toContain('.env');
    }
  });

  it('renders sanitized expired run API errors without raw storage or stale artifact content', async () => {
    const rawOpenAiKey = `sk-${'e'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/prefix_${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR/documentation-tree.json`;
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/v1/documentation-runs') && init?.method === 'POST') {
        return jsonResponse({
          runId: 'run_expired_ui',
          status: 'created'
        });
      }

      if (url.endsWith('/v1/documentation-runs/run_expired_ui/sources')) {
        return jsonResponse({
          runId: 'run_expired_ui',
          status: 'ready'
        });
      }

      if (url.endsWith('/v1/documentation-runs/run_expired_ui/start')) {
        return jsonResponse({
          runId: 'run_expired_ui',
          status: 'completed'
        });
      }

      if (url.endsWith('/v1/documentation-runs/run_expired_ui')) {
        return jsonErrorResponse(404, 'DOCUMENTATION_RUN_NOT_FOUND', {
          message: `Documentation run expired after cleanup. Stale artifact at ${rawStoragePath} contained SHOULD_NOT_APPEAR.`
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });
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
        new File([`fetch("/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR")`], 'frontend.tar', {
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
    await waitForText('DOCUMENTATION_RUN_NOT_FOUND');

    expectSafeWebFailure(rawOpenAiKey, rawStoragePath);
    expect(document.body.textContent).toContain('DOCUMENTATION_RUN_NOT_FOUND');
    expect(document.body.textContent).toContain('[REDACTED_STORAGE_PATH]');
  });

  it('renders sanitized missing artifact API errors without raw storage or stale artifact content', async () => {
    const rawOpenAiKey = `sk-${'m'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/prefix_${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR/documentation-tree.json`;
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/v1/documentation-runs') && init?.method === 'POST') {
        return jsonResponse({
          runId: 'run_missing_artifact_ui',
          status: 'created'
        });
      }

      if (url.endsWith('/v1/documentation-runs/run_missing_artifact_ui/sources')) {
        return jsonResponse({
          runId: 'run_missing_artifact_ui',
          status: 'ready'
        });
      }

      if (url.endsWith('/v1/documentation-runs/run_missing_artifact_ui/start')) {
        return jsonResponse({
          runId: 'run_missing_artifact_ui',
          status: 'completed'
        });
      }

      if (url.endsWith('/v1/documentation-runs/run_missing_artifact_ui')) {
        return jsonResponse({
          id: 'run_missing_artifact_ui',
          status: 'completed',
          renderedFormats: ['json'],
          progress: {
            currentStep: 'Documentation run completed',
            completedSteps: 7,
            totalSteps: 7
          },
          error: {
            message: `Stored run error referenced ${rawStoragePath} and SHOULD_NOT_APPEAR.`
          }
        });
      }

      if (url.endsWith('/v1/documentation-runs/run_missing_artifact_ui/result')) {
        return jsonErrorResponse(400, 'DOCUMENTATION_RESULT_ARTIFACT_MISSING', {
          message: `Documentation result artifact is missing at ${rawStoragePath}; stale markdown SHOULD_NOT_APPEAR was removed.`,
          details: {
            path: rawStoragePath,
            staleContent: `# SHOULD_NOT_APPEAR ${rawOpenAiKey}`
          }
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });
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
        new File([`fetch("/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR")`], 'frontend.tar', {
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
    await waitForText('DOCUMENTATION_RESULT_ARTIFACT_MISSING');

    expectSafeWebFailure(rawOpenAiKey, rawStoragePath);
    expect(document.body.textContent).toContain('DOCUMENTATION_RESULT_ARTIFACT_MISSING');
    expect(document.body.textContent).toContain('[REDACTED_STORAGE_PATH]');
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

function jsonErrorResponse(
  status: number,
  code: string,
  error: {
    message: string;
    details?: unknown;
  }
): Response {
  return new Response(
    JSON.stringify({
      error: {
        code,
        message: error.message,
        ...(error.details ? { details: error.details } : {})
      }
    }),
    {
      status,
      headers: {
        'content-type': 'application/json'
      }
    }
  );
}

function expectSafeWebFailure(rawOpenAiKey: string, rawStoragePath: string): void {
  const renderedText = document.body.textContent ?? '';

  expect(renderedText).not.toContain(rawStoragePath);
  expect(renderedText).not.toContain(rawOpenAiKey);
  expect(renderedText).not.toContain('.env');
  expect(renderedText).not.toContain('SHOULD_NOT_APPEAR');
}

function completedDocumentationPages(): Array<{ key: string; title: string; markdown: string }> {
  const pageRows: Array<[string, string, string]> = [
    [
      'overview',
      '01. Overview',
      '# 01. Overview\n\n| Source | Role |\n| --- | --- |\n| frontend | frontend |\n| backend | backend |'
    ],
    ['system-architecture', '02. System Architecture', '# 02. System Architecture'],
    ['source-inventory', '03. Source Inventory', '# 03. Source Inventory'],
    ['frontend', '04. Frontend', '# 04. Frontend'],
    ['backend', '05. Backend', '# 05. Backend'],
    [
      'api-contracts',
      '06. API Contracts',
      '# 06. API Contracts\n\n| Method | Path | Status |\n| --- | --- | --- |\n| GET | /api/users | matched |'
    ],
    [
      'authentication-and-authorization',
      '07. Authentication and Authorization',
      '# 07. Authentication and Authorization'
    ],
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

function setTextInputValue(input: HTMLInputElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
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

  throw new Error(
    `Timed out waiting for text: ${text}. Current text: ${document.body.textContent ?? ''}`
  );
}
