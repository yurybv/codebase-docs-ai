import { describe, expect, it } from 'vitest';
import { sourceInputMetadataSchema } from './schemas.js';

describe('sourceInputMetadataSchema', () => {
  it('accepts a valid source role', () => {
    const result = sourceInputMetadataSchema.parse({
      name: 'Frontend',
      role: 'frontend'
    });

    expect(result).toEqual({
      name: 'Frontend',
      role: 'frontend'
    });
  });

  it('rejects an unsupported source role', () => {
    expect(() =>
      sourceInputMetadataSchema.parse({
        name: 'Frontend',
        role: 'database'
      })
    ).toThrow();
  });
});
