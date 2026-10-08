import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { translate, type Key } from '../i18n';
import { PROJECT_NAME, SHIP_NAME } from '../lore';
import { renderInline, renderRich } from '../lib/markup';
import { barcode, hashHex } from '../lib/util';
import { asImage, asNumber, asSignature, asText, filledRows, isEmpty, listItems } from '../lib/values';
import type { FieldDef, FieldValue, Lang, Report } from '../types';
import { Emblem } from './Emblem';

// The finished in-game document. Everything that is exported (PNG, print,
// clipboard image) is a picture of this component, so it must not depend on
// anything outside its own subtree. Styles live in styles/document.css.
//
// A report is laid out on A4 pages. The browser does the page breaking: the
// content sits in a CSS column as tall as one page's text area, and whatever
// does not fit runs into further columns beside it. Every page then shows the
// same content through a window, shifted sideways to its own column. That
// costs one copy of the content per page, and in return text breaks between
// lines exactly as the browser would break it in print.

interface Props {
  report: Report;
  /** One sheet that grows with its content instead of pages. Enough for a thumbnail, and much cheaper. */
  continuous?: boolean;
}

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
/** Distance between two pages' columns of text. Must match column-gap on .doc-flow in document.css. */
const COLUMN_GAP = 60;

/** The classification written corner to corner across the page, like a rubber
 *  stamp on a file. One box per letter, spread evenly, so any word spans the
 *  whole diagonal. Plain HTML text on purpose: the image export loses the
 *  colour of SVG text. */
function Watermark({ label }: { label: string }) {
  const letters = Array.from(label);
  const span = Math.hypot(PAGE_WIDTH, PAGE_HEIGHT) * 0.8;
  const angle = (-Math.atan2(PAGE_HEIGHT, PAGE_WIDTH) * 180) / Math.PI;
  // Short words get big letters; long ones shrink until they fit the diagonal.
  const size = Math.min(span / (letters.length * 0.68), 210);
  return (
    <div className="doc-watermark" aria-hidden="true">
      <div
        className="doc-watermark-line"
        style={{
          top: PAGE_HEIGHT / 2,
          width: span,
          fontSize: size,
          transform: `translate(-50%, -50%) rotate(${angle}deg)`,
        }}
      >
        {letters.map((ch, i) => (
          <span key={i}>{ch === ' ' ? ' ' : ch}</span>
        ))}
      </div>
    </div>
  );
}

function FieldBody({ def, value, docNo, lang }: { def: FieldDef; value: FieldValue | undefined; docNo: string; lang: Lang }) {
  const empty = isEmpty(def, value);
  const dash = <span className="doc-blank">—</span>;

  switch (def.type) {
    case 'longtext':
      return <div className="doc-rich">{empty ? dash : renderRich(asText(value))}</div>;

    case 'list':
      if (empty) return <div className="doc-value">{dash}</div>;
      return (
        <ul className="doc-list">
          {listItems(value).map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );

    case 'select':
      return <div className="doc-value">{empty ? dash : <span className="doc-badge">{asText(value)}</span>}</div>;

    case 'scale': {
      const max = def.max ?? 5;
      const n = Math.min(max, asNumber(value));
      return (
        <div className="doc-scale">
          <span className="doc-pips">
            {Array.from({ length: max }, (_, i) => (
              <span key={i} className={i < n ? 'doc-pip on' : 'doc-pip'} />
            ))}
          </span>
          <span className="doc-scale-num">{empty ? '—' : `${n} / ${max}`}</span>
        </div>
      );
    }

    case 'table': {
      const columns = def.columns ?? [];
      const rows = filledRows(value, columns.length);
      return (
        <table className="doc-table">
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={i}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(rows.length ? rows : [columns.map(() => '')]).map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci}>{cell.trim() ? renderInline(cell) : dash}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    case 'image': {
      const image = asImage(value);
      if (!image.src) return <div className="doc-noimage">{translate(lang, 'doc.noImage')}</div>;
      return (
        <figure className="doc-figure">
          <img src={image.src} alt={image.caption} />
          {image.caption && <figcaption>{image.caption}</figcaption>}
        </figure>
      );
    }

    case 'signature': {
      const sig = asSignature(value);
      return (
        <div className="doc-sign">
          <div className="doc-sign-hand">{sig.name || ' '}</div>
          <div className="doc-sign-name">{sig.name || dash}</div>
          {sig.title && <div className="doc-sign-title">{sig.title}</div>}
          {sig.name && (
            <div className="doc-sign-hash">
              {translate(lang, 'doc.esign')} · {hashHex(sig.name + docNo, 12)}
            </div>
          )}
        </div>
      );
    }

    default:
      return <div className="doc-value">{empty ? dash : asText(value)}</div>;
  }
}

/** How a section's fields sit on the page. A full-width field is a plain block
 *  so that a long one can run from one page onto the next; narrower fields
 *  share a line. */
type Row =
  | { kind: 'block'; field: FieldDef }
  | { kind: 'line'; fields: FieldDef[] }
  | { kind: 'portrait'; image: FieldDef; beside: FieldDef[] };

/** Field widths in sixths of the line. */
const SPAN = { full: 6, twothirds: 4, half: 3, third: 2 } as const;
const spanOf = (def: FieldDef): number => SPAN[def.width ?? 'full'];

/** Field types that can grow past a page and are allowed to break across one. */
const canBreak = (def: FieldDef): boolean => def.type === 'longtext' || def.type === 'list' || def.type === 'table';

function layoutRows(fields: FieldDef[]): Row[] {
  const rows: Row[] = [];
  let start = 0;

  // A 1/3-wide image that opens a section becomes a portrait beside the run of
  // 2/3-wide fields that follows it.
  if (fields[0]?.type === 'image' && fields[0].width === 'third') {
    let n = 0;
    while (fields[n + 1]?.width === 'twothirds') n++;
    if (n > 0) {
      rows.push({ kind: 'portrait', image: fields[0], beside: fields.slice(1, n + 1) });
      start = n + 1;
    }
  }

  let line: FieldDef[] = [];
  let used = 0;
  const close = () => {
    if (line.length === 1 && used === 6) rows.push({ kind: 'block', field: line[0] });
    else if (line.length) rows.push({ kind: 'line', fields: line });
    line = [];
    used = 0;
  };
  for (const def of fields.slice(start)) {
    if (used + spanOf(def) > 6) close();
    line.push(def);
    used += spanOf(def);
    if (used === 6) close();
  }
  close();
  return rows;
}

/** Everything that flows from page to page: the letterhead, the title and the sections. */
function renderContent(report: Report): ReactNode {
  const tpl = report.template;
  const lang = tpl.lang;
  const t = (key: Key) => translate(lang, key);

  const sections = tpl.sections
    .map((section) => ({
      ...section,
      fields: report.hideEmpty
        ? section.fields.filter((def) => !isEmpty(def, report.values[def.id]))
        : section.fields,
    }))
    .filter((section) => section.fields.length > 0);

  return (
    <>
      <header className="doc-head">
        {(tpl.logo || tpl.emblem !== 'none') && (
          <div className="doc-emblem">{tpl.logo ? <img src={tpl.logo} alt="" /> : <Emblem id={tpl.emblem} />}</div>
        )}
        <div className="doc-org">
          <div className="doc-project">
            {PROJECT_NAME} · {t('doc.ship')} {SHIP_NAME}
          </div>
          {tpl.issuer && <div className="doc-issuer">{tpl.issuer}</div>}
        </div>
        <div className="doc-meta">
          <div className="doc-meta-label">{t('doc.docNo')}</div>
          <div className="doc-meta-value">{report.docNo || '—'}</div>
          <div className="doc-barcode" aria-hidden="true">
            {barcode(report.docNo).map((w, i) => (
              <span key={i} style={{ width: w, marginRight: (w % 2) + 1 }} />
            ))}
          </div>
        </div>
      </header>

      <div className="doc-titleblock">
        <h1 className="doc-title">{tpl.docTitle}</h1>
        {report.title && (
          <div className="doc-subject">
            <span className="doc-subject-label">{t('doc.subject')}</span>
            {report.title}
          </div>
        )}
        {report.stamp.trim() && <div className="doc-stamp">{report.stamp}</div>}
      </div>

      {sections.map((section, i) => {
        // A lone field whose label repeats the section heading reads better without it.
        const lone = section.fields.length === 1;
        const field = (def: FieldDef, extra = '') => (
          <div key={def.id} className={`doc-field w-${def.width ?? 'full'} f-${def.type}${extra}`}>
            {def.label && !(lone && def.label === section.title) && <div className="doc-label">{def.label}</div>}
            <FieldBody def={def} value={report.values[def.id]} docNo={report.docNo} lang={lang} />
          </div>
        );
        return (
          <section key={section.id} className="doc-section">
            <h2 className="doc-section-head">
              <span className="doc-section-no">{String(i + 1).padStart(2, '0')}</span>
              <span className="doc-section-title">{section.title}</span>
              <span className="doc-section-rule" />
            </h2>
            {layoutRows(section.fields).map((row) => {
              if (row.kind === 'block') return field(row.field);
              if (row.kind === 'portrait') {
                return (
                  <div key={row.image.id} className="doc-row is-portrait">
                    {field(row.image, ' is-portrait')}
                    <div className="doc-beside">{row.beside.map((def) => field(def))}</div>
                  </div>
                );
              }
              // A line of short fields moves to the next page as one; a line holding a long field may break.
              const whole = !row.fields.some(canBreak);
              return (
                <div key={row.fields[0].id} className={whole ? 'doc-row is-whole' : 'doc-row'}>
                  {row.fields.map((def) => field(def))}
                </div>
              );
            })}
          </section>
        );
      })}
    </>
  );
}

export const Document = forwardRef<HTMLElement, Props>(function Document({ report, continuous }, ref) {
  const tpl = report.template;
  const lang = tpl.lang;
  const t = (key: Key) => translate(lang, key);
  const classified = report.classification !== 'none';
  const classLabel = t(`class.${report.classification}` as Key);

  const root = useRef<HTMLElement | null>(null);
  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      root.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  // The first page's column of text doubles as the ruler: how far its content
  // runs sideways is the number of pages.
  const ruler = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(1);
  const [, remeasure] = useReducer((n: number) => n + 1, 0);

  useLayoutEffect(() => {
    const flow = ruler.current;
    // No width means the document is not on screen (a hidden tab on a phone); keep the last count.
    if (!flow || flow.clientWidth === 0) return;
    const pages = Math.max(1, Math.round((flow.scrollWidth + COLUMN_GAP) / (flow.clientWidth + COLUMN_GAP)));
    if (pages !== count) setCount(pages);
  });

  // Layout also changes without React knowing: an image or a font arrives, or the document is shown.
  useEffect(() => {
    const flow = ruler.current;
    if (!flow || !root.current) return;
    let alive = true;
    const again = () => alive && remeasure();
    flow.addEventListener('load', again, true);
    document.fonts?.addEventListener?.('loadingdone', again);
    void document.fonts?.ready.then(again);
    const observer = new ResizeObserver(again);
    observer.observe(root.current);
    return () => {
      alive = false;
      flow.removeEventListener('load', again, true);
      document.fonts?.removeEventListener?.('loadingdone', again);
      observer.disconnect();
    };
  }, [continuous]);

  const content = renderContent(report);
  const className = `doc theme-${tpl.theme} class-${report.classification}`;
  const style = { '--accent': tpl.accent } as CSSProperties;
  const bar = classified && <div className="doc-class">{classLabel}</div>;
  const watermark = classified && report.watermark && <Watermark label={classLabel.toLocaleUpperCase(lang)} />;
  const motto = (
    <span>
      {SHIP_NAME} — “{t('doc.motto')}”
    </span>
  );
  const hash = (
    <span className="doc-foot-hash">{hashHex(report.docNo + report.id, 16).replace(/(.{4})/g, '$1 ').trim()}</span>
  );

  if (continuous) {
    return (
      <article ref={setRefs} lang={lang} className={className} style={style}>
        {bar}
        <div className="doc-body">
          <div className="doc-flow">{content}</div>
          <footer className="doc-foot">
            {motto}
            {hash}
          </footer>
        </div>
        {bar}
        {watermark}
      </article>
    );
  }

  return (
    <div ref={setRefs as (node: HTMLDivElement | null) => void} className="doc-pages" data-pages={count}>
      {Array.from({ length: count }, (_, page) => (
        <article key={page} lang={lang} className={`${className} doc-page`} style={style}>
          <div className="doc-sheet">
            {bar}
            <div className="doc-body">
              {page > 0 && (
                <div className="doc-running">
                  <span className="doc-running-title">
                    {tpl.docTitle}
                    {report.title && ` · ${report.title}`}
                  </span>
                  <span>{report.docNo}</span>
                </div>
              )}
              <div className="doc-window">
                <div
                  ref={page === 0 ? ruler : undefined}
                  className="doc-flow"
                  // Every page holds the whole text; only the first copy is for screen readers.
                  aria-hidden={page > 0 || undefined}
                  style={page > 0 ? { transform: `translateX(calc(${page} * (-100% - ${COLUMN_GAP}px)))` } : undefined}
                >
                  {content}
                </div>
              </div>
              <footer className="doc-foot">
                {motto}
                {count > 1 && (
                  <span className="doc-foot-page">
                    {t('doc.page')} {page + 1} / {count}
                  </span>
                )}
                {hash}
              </footer>
            </div>
            {bar}
          </div>
          {watermark}
        </article>
      ))}
    </div>
  );
});
