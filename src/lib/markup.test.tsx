import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { renderInline } from './markup';

const html = (text: string) => renderToStaticMarkup(<>{renderInline(text)}</>);

describe('renderInline', () => {
  it('keeps bold and italic', () => {
    expect(html('**kalın** *eğik* düz')).toBe('<strong>kalın</strong> <em>eğik</em> düz');
  });

  // The PDF and the forum preview are drawn from the document, so this is what keeps hidden words out of them
  it('never shows a hidden word, also inside bold or italic', () => {
    for (const text of ['||Ahmet Yılmaz||', '**Şüpheli: ||Ahmet Yılmaz||**', '*not: ||Ahmet Yılmaz||*', '*a ||Ahmet* Yılmaz||']) {
      expect(html(text)).not.toMatch(/Ahmet|Yılmaz/);
    }
    expect(html('**Şüpheli: ||Ahmet||**')).toBe(
      '<strong>Şüpheli: <span class="doc-redact" aria-label="█">xxxxx</span></strong>',
    );
  });
});
