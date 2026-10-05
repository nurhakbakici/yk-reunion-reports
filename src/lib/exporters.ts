import { getFontEmbedCSS, toBlob } from 'html-to-image';
import { translate, type Key } from '../i18n';
import { PROJECT_NAME, SHIP_NAME } from '../lore';
import type { Report } from '../types';
import { richToPlain } from './markup';
import { asImage, asNumber, asSignature, asText, filledRows, isEmpty, listItems } from './values';

// The embedded web fonts never change while the page is open, and collecting
// them is the slow part of an export, so do it once.
let fontCss: Promise<string> | null = null;

/** Renders the document element to a PNG at twice its natural size. The preview
 *  is only scaled by a transform on its parent, so the element itself is full size. */
export async function documentToPng(node: HTMLElement): Promise<Blob> {
  fontCss ??= getFontEmbedCSS(node).catch(() => '');
  const blob = await toBlob(node, { pixelRatio: 2, fontEmbedCSS: await fontCss });
  if (!blob) throw new Error('empty image');
  return blob;
}

export async function copyImage(blob: Blob): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard API is refused in some contexts; fall back to the old way.
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    if (!ok) throw new Error('clipboard unavailable');
  }
}

/** The report as chat-friendly markdown (Discord renders this as-is). */
export function reportToText(report: Report): string {
  const tpl = report.template;
  const lang = tpl.lang;
  const t = (key: Key) => translate(lang, key);
  const upper = (s: string) => s.toLocaleUpperCase(lang);
  const out: string[] = [];

  out.push(`# ${upper(tpl.docTitle)}`);
  if (report.title) out.push(`**${t('doc.subject')}:** ${report.title}`);
  const meta = [`\`${report.docNo}\``];
  if (report.classification !== 'none') meta.push(upper(t(`class.${report.classification}` as Key)));
  if (report.stamp.trim()) meta.push(`[${upper(report.stamp.trim())}]`);
  out.push(meta.join(' · '));
  out.push(`*${[PROJECT_NAME, SHIP_NAME, tpl.issuer].filter(Boolean).join(' · ')}*`);

  let n = 0;
  for (const section of tpl.sections) {
    const fields = section.fields.filter((def) => !isEmpty(def, report.values[def.id]));
    // Chat text has no use for blank form rows, whatever the document setting is.
    if (fields.length === 0) continue;
    n++;
    out.push('', `## ${String(n).padStart(2, '0')} · ${section.title}`);

    for (const def of fields) {
      const value = report.values[def.id];
      const sameAsSection = fields.length === 1 && def.label === section.title;
      const label = def.label && !sameAsSection ? `**${def.label}:**` : '';

      switch (def.type) {
        case 'longtext':
          if (label) out.push(label);
          out.push(richToPlain(asText(value)).trim());
          break;
        case 'list':
          if (label) out.push(label);
          out.push(...listItems(value).map((item) => `- ${richToPlain(item)}`));
          break;
        case 'table': {
          if (label) out.push(label);
          const columns = def.columns ?? [];
          for (const row of filledRows(value, columns.length)) {
            const cells = row
              .map((cell, i) => (cell.trim() ? `${columns[i]}: ${richToPlain(cell.trim())}` : ''))
              .filter(Boolean);
            out.push(`- ${cells.join(' · ')}`);
          }
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
          if (caption) out.push(`${label} *${caption}*`.trim());
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
  return out.join('\n');
}
