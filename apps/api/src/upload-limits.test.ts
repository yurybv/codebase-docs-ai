import { describe, expect, it } from 'vitest';
import { getDocumentationUploadLimits } from './upload-limits.js';

describe('getDocumentationUploadLimits', () => {
  it('uses defaults when env values are missing', () => {
    expect(getDocumentationUploadLimits({})).toEqual({
      maxFiles: 5,
      maxFileSizeBytes: 104857600
    });
  });

  it('parses positive env overrides', () => {
    expect(
      getDocumentationUploadLimits({
        DOCS_AI_UPLOAD_MAX_FILES: '2',
        DOCS_AI_UPLOAD_MAX_FILE_SIZE_BYTES: '1024'
      })
    ).toEqual({
      maxFiles: 2,
      maxFileSizeBytes: 1024
    });
  });

  it('falls back for invalid env overrides', () => {
    expect(
      getDocumentationUploadLimits({
        DOCS_AI_UPLOAD_MAX_FILES: '0',
        DOCS_AI_UPLOAD_MAX_FILE_SIZE_BYTES: 'invalid'
      })
    ).toEqual({
      maxFiles: 5,
      maxFileSizeBytes: 104857600
    });
  });
});
