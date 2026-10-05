import type { ReactNode } from 'react';

// The small markup available in long-text fields:
//   **bold**   *italic*   ||redacted||   lines starting with "- " become bullets
// ||…|| is Discord's spoiler syntax, which the players already know.

const INLINE = /(\*\*[^*\n]+\*\*|\|\|[^|\n]+\|\||\*[^*\n]+\*)/g;

/** A redaction keeps the shape of the words but never the words themselves, so
 *  the hidden text cannot be selected back out of a PDF. */
function Redacted({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\s+)/).map((part, i) =>
        /^\s+$/.test(part) || part === '' ? (
          part
        ) : (
          <span key={i} className="doc-redact" aria-label="█">
            {'x'.repeat(part.length)}
          </span>
        ),
      )}
    </>
  );
}

export function renderInline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('||') && part.endsWith('||') && part.length > 4) {
      return <Redacted key={i} text={part.slice(2, -2)} />;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

const BULLET = /^\s*[-•]\s+/;

export function renderRich(text: string): ReactNode {
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let bullets: string[] = [];

  const flush = () => {
    if (para.length) {
      const lines = para;
      blocks.push(
        <p key={blocks.length}>
          {lines.map((line, i) => (
            <span key={i}>
              {renderInline(line)}
              {i < lines.length - 1 && <br />}
            </span>
          ))}
        </p>,
      );
      para = [];
    }
    if (bullets.length) {
      const items = bullets;
      blocks.push(
        <ul key={blocks.length}>
          {items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };

  for (const line of text.split('\n')) {
    if (!line.trim()) {
      flush();
    } else if (BULLET.test(line)) {
      if (para.length) flush();
      bullets.push(line.replace(BULLET, ''));
    } else {
      if (bullets.length) flush();
      para.push(line);
    }
  }
  flush();
  return blocks;
}

/** Plain-text version of the same markup, for pasting into chat. */
export function richToPlain(text: string): string {
  return text.replace(/\|\|([^|\n]+)\|\|/g, (_, hidden: string) => hidden.replace(/\S/g, '█'));
}
