import { describe, expect, it } from 'vitest';
import { publishErrorCode } from './kunye';

describe('publishErrorCode', () => {
  it('tells a missing bucket from a refusal, a big file and no connection', () => {
    expect(publishErrorCode({ message: 'Bucket not found', statusCode: '404', status: 400 })).toBe('not-ready');
    expect(
      publishErrorCode({ message: 'new row violates row-level security policy', statusCode: '403', status: 400 }),
    ).toBe('not-allowed');
    expect(
      publishErrorCode({ message: 'The object exceeded the maximum allowed size', statusCode: '413', status: 400 }),
    ).toBe('too-large');
    expect(publishErrorCode({ message: 'Failed to fetch' })).toBe('offline');
    expect(publishErrorCode({ message: 'Internal Server Error', statusCode: '500', status: 500 })).toBe('failed');
    expect(publishErrorCode(null)).toBe('offline');
  });
});
