import { describe, expect, it } from 'vitest';
import { buildSourceUploadMetadata, inferSourceName } from './source-metadata.js';

describe('buildSourceUploadMetadata', () => {
  it('creates API metadata from selected sources', () => {
    const file = new File(['content'], 'frontend.zip');

    expect(
      buildSourceUploadMetadata([
        {
          id: 'source_1',
          name: 'Frontend',
          role: 'frontend',
          file
        }
      ])
    ).toEqual({
      sources: [
        {
          fileField: 'source_1',
          name: 'Frontend',
          role: 'frontend'
        }
      ]
    });
  });
});

describe('inferSourceName', () => {
  it('creates a readable name from archive filename', () => {
    expect(inferSourceName('customer-portal_frontend.zip')).toBe('customer portal frontend');
  });
});
