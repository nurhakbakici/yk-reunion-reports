// The report as forum BBCode (SMF 2.1), for "Foruma gönder". Same structure as reportToText's Markdown;
// markup is read where the document reads it: long text, list items and table cells.
import { translate, type Key } from '../i18n';
import { PROJECT_NAME, SHIP_NAME } from '../lore';
import type { Report } from '../types';
import { richToPlain } from './markup';
import { asImage, asNumber, asSignature, asText, filledRows, isEmpty, listItems } from './values';

// The document's own markup (markup.tsx): **bold**, *italic*, ||hidden||, and "- " lines as bullets
const INLINE = /(\*\*[^*\n]+\*\*|\|\|[^|\n]+\|\||\*[^*\n]+\*)/g;
const BULLET = /^\s*[-•]\s+/;

/** One piece of text: bold and italic carried over, hidden words as █ like the text export. */
export function inlineToBBCode(text: string): string {
  return text
    .split(INLINE)
    .map((part) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return `[b]${part.slice(2, -2)}[/b]`;
      if (part.startsWith('||') && part.endsWith('||') && part.length > 4) return richToPlain(part);
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return `[i]${part.slice(1, -1)}[/i]`;
      return part;
    })
    .join('');
}

const list = (items: string[]) => `[list]${items.map((item) => `[li]${item}[/li]`).join('')}[/list]`;

/** A long-text value: lines stay lines, a run of "- " lines becomes one list. */
export function richToBBCode(text: string): string {
  const out: string[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) out.push(list(bullets.map(inlineToBBCode)));
    bullets = [];
  };
  for (const line of text.split('\n')) {
    if (BULLET.test(line)) {
      bullets.push(line.replace(BULLET, ''));
    } else {
      flush();
      out.push(inlineToBBCode(line));
    }
  }
  flush();
  return out.join('\n').trim();
}

export function reportToBBCode(report: Report): string {
  const tpl = report.template;
  const lang = tpl.lang;
  const t = (key: Key) => translate(lang, key);
  const upper = (s: string) => s.toLocaleUpperCase(lang);
  const out: string[] = [];

  out.push(`[b][size=14pt]${upper(tpl.docTitle)}[/size][/b]`);
  if (report.title) out.push(`[b]${t('doc.subject')}:[/b] ${report.title}`);
  const meta = [`[b]${report.docNo}[/b]`];
  if (report.classification !== 'none') meta.push(upper(t(`class.${report.classification}` as Key)));
  // « » rather than [ ]: square brackets read as a tag in BBCode
  if (report.stamp.trim()) meta.push(`«${upper(report.stamp.trim())}»`);
  out.push(meta.join(' · '));
  out.push(`[i]${[PROJECT_NAME, SHIP_NAME, tpl.issuer].filter(Boolean).join(' · ')}[/i]`);

  let n = 0;
  for (const section of tpl.sections) {
    const fields = section.fields.filter((def) => !isEmpty(def, report.values[def.id]));
    if (fields.length === 0) continue;
    n++;
    out.push('', `[b]${String(n).padStart(2, '0')} · ${section.title}[/b]`);

    for (const def of fields) {
      const value = report.values[def.id];
      const sameAsSection = fields.length === 1 && def.label === section.title;
      const label = def.label && !sameAsSection ? `[b]${def.label}:[/b]` : '';

      switch (def.type) {
        case 'longtext':
          if (label) out.push(label);
          out.push(richToBBCode(asText(value)));
          break;
        case 'list':
          if (label) out.push(label);
          out.push(list(listItems(value).map(inlineToBBCode)));
          break;
        case 'table': {
          if (label) out.push(label);
          const columns = def.columns ?? [];
          const rows = filledRows(value, columns.length).map((row) =>
            row
              .map((cell, i) => (cell.trim() ? `${columns[i]}: ${inlineToBBCode(cell.trim())}` : ''))
              .filter(Boolean)
              .join(' · '),
          );
          out.push(list(rows));
          break;
        }
        case 'scale': {
          const max = def.max ?? 5;
          const v = Math.min(max, asNumber(value));
          out.push(`${label} ${'▰'.repeat(v)}${'▱'.repeat(max - v)} ${v}/${max}`.trim());
          break;
        }
        case 'image': {
          const caption = asImage(value).caption;
          if (caption) out.push(`${label} [i]${caption}[/i]`.trim());
          break;
        }
        case 'signature': {
          const sig = asSignature(value);
          out.push(`${label} ${sig.name}${sig.title ? ` — ${sig.title}` : ''}`.trim());
          break;
        }
        default:
          out.push(`${label} ${asText(value).trim()}`.trim());
      }
    }
  }

  out.push('', `[size=8pt][i]${t('forum.footer')}[/i][/size]`);
  return out.join('\n');
}

/** Text that fits the forum's message limit: cut at the last whole line, with a note that the PDF has the rest. */
export function fitMessage(text: string, limit: number, note: string): string {
  if (limit <= 0 || text.length <= limit) return text;
  const room = Math.max(0, limit - note.length - 1);
  const cut = text.lastIndexOf('\n', room);
  return `${text.slice(0, cut > 0 ? cut : room)}\n${note}`;
}
