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
});
