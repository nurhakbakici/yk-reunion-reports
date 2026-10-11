import { describe, expect, it } from 'vitest';
import { fontCacheKey } from './exporters';

// html-to-image embeds only the fonts used inside the node it is given, so the
// embedded fonts can be reused only for a picture that uses the same fonts.
describe('fontCacheKey', () => {
  it('is the same for the same fonts, in any order and however often they appear', () => {
    expect(fontCacheKey(['"IBM Plex Serif", serif', 'Oxanium, sans-serif', 'Oxanium, sans-serif'])).toBe(
      fontCacheKey(['Oxanium, sans-serif', '"IBM Plex Serif", serif']),
    );
  });

  it('differs when a picture uses a font the other does not', () => {
    expect(fontCacheKey(['"JetBrains Mono", monospace'])).not.toBe(
      fontCacheKey(['"JetBrains Mono", monospace', 'Oxanium, sans-serif']),
    );
  });
});
