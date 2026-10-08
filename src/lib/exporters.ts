import { getFontEmbedCSS } from 'html-to-image';
import { translate, type Key } from '../i18n';
import { PROJECT_NAME, SHIP_NAME } from '../lore';
import type { Report } from '../types';
import { richToPlain } from './markup';
import { asImage, asNumber, asSignature, asText, filledRows, isEmpty, listItems } from './values';

// The embedded web fonts never change while the page is open, and collecting
// them is the slow part of an export, so do it once.
let fontCss: Promise<string> | null = null;

/** Twice the document's natural size: sharp when zoomed, still a reasonable file. */
const PIXEL_RATIO = 2;

/** Every style rule on the page as text, fonts aside (those are embedded separately). */
function styleRules(): string {
  let css = '';
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // a sheet from another origin cannot be read, and is none of ours
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSFontFaceRule)) css += `${rule.cssText}\n`;
    }
  }
  return css;
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  // A canvas larger than the browser allows comes back empty; that is reported like any failed export.
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('empty image'))), 'image/png'),
  );
}

/** Draws one page. The browser is handed a copy of the page inside an SVG
 *  picture, together with the same style rules the screen uses, and lays it out
 *  itself. Copying each element's computed sizes instead, as export libraries
 *  do, drifts by fractions of a pixel, which is enough to move a page break. */
async function pageToPng(page: HTMLElement, css: string): Promise<Blob> {
  const width = page.offsetWidth;
  const height = page.offsetHeight;
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const frame = document.createElementNS(svgNs, 'foreignObject');
  frame.setAttribute('width', '100%');
  frame.setAttribute('height', '100%');
  const style = document.createElement('style');
  style.textContent = css;
  frame.append(style, page.cloneNode(true));
  svg.append(frame);

  const image = new Image();
  image.decoding = 'async';
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('page could not be drawn'));
  });
  // A data address rather than a blob: a canvas refuses to give back a picture drawn from the latter.
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  await loaded;
  await image.decode().catch(() => undefined);

  const canvas = document.createElement('canvas');
  canvas.width = width * PIXEL_RATIO;
  canvas.height = height * PIXEL_RATIO;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no canvas');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvasToPng(canvas);
}

/** Renders each page of the document to a PNG. The preview is only scaled by a
 *  transform on its parent, so the pages themselves are full size. */
export async function documentToPngs(root: HTMLElement): Promise<Blob[]> {
  const pages = Array.from(root.querySelectorAll<HTMLElement>(':scope > .doc-page'));
  if (pages.length === 0) throw new Error('no pages');
  fontCss ??= getFontEmbedCSS(pages[0]).catch(() => '');
  const css = styleRules() + (await fontCss);
  const images: Blob[] = [];
  // One at a time: each page is a large picture, and several at once can run a phone out of memory.
  for (const page of pages) images.push(await pageToPng(page, css));
  return images;
}

/** Gap left between pages in a stacked image, in image pixels. */
const STACK_GAP = 24;

/** All pages as one tall image, for the clipboard, which holds a single picture. */
export async function stackImages(pages: Blob[]): Promise<Blob> {
  if (pages.length === 1) return pages[0];
  const bitmaps = await Promise.all(pages.map((page) => createImageBitmap(page)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(...bitmaps.map((b) => b.width));
  canvas.height = bitmaps.reduce((sum, b) => sum + b.height, 0) + STACK_GAP * (bitmaps.length - 1);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no canvas');
  let y = 0;
  for (const bitmap of bitmaps) {
    context.drawImage(bitmap, 0, y);
    y += bitmap.height + STACK_GAP;
    bitmap.close();
  }
  return canvasToPng(canvas);
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
