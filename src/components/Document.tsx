import { forwardRef, useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
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

interface Props {
  report: Report;
  /** Height to assume while the document is not laid out yet (the hidden print copy). */
  heightHint?: number;
}

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;

/** Splits a document's height into printed pages. A last part too short to
 *  carry a stamp of its own is left bare rather than given a squashed one. */
function pageBoxes(height: number): { top: number; height: number }[] {
  const boxes: { top: number; height: number }[] = [];
  let top = 0;
  while (height - top >= PAGE_HEIGHT * 1.45) {
    boxes.push({ top, height: PAGE_HEIGHT });
    top += PAGE_HEIGHT;
  }
  const rest = height - top;
  if (rest <= PAGE_HEIGHT * 1.02) {
    if (rest >= PAGE_HEIGHT * 0.45 || boxes.length === 0) boxes.push({ top, height: rest });
  } else {
    // Between one and one-and-a-half pages: a full page, the remainder stays bare.
    boxes.push({ top, height: PAGE_HEIGHT });
  }
  return boxes;
}

/** The classification written corner to corner across each page, like a rubber
 *  stamp on a file. One box per letter, spread evenly, so any word spans the
 *  whole diagonal. Plain HTML text on purpose: the image export loses the
 *  colour of SVG text. */
function Watermark({ label, height }: { label: string; height: number }) {
  const letters = Array.from(label);
  return (
    <div className="doc-watermark" aria-hidden="true">
      {pageBoxes(height).map((box) => {
        const span = Math.hypot(PAGE_WIDTH, box.height) * 0.8;
        const angle = (-Math.atan2(box.height, PAGE_WIDTH) * 180) / Math.PI;
        // Short words get big letters; long ones shrink until they fit the diagonal.
        const size = Math.min(span / (letters.length * 0.68), 210);
        return (
          <div
            key={box.top}
            className="doc-watermark-line"
            style={{
              top: box.top + box.height / 2,
              width: span,
              fontSize: size,
              transform: `translate(-50%, -50%) rotate(${angle}deg)`,
            }}
          >
            {letters.map((ch, i) => (
              <span key={i}>{ch === ' ' ? '\u00a0' : ch}</span>
            ))}
          </div>
        );
      })}
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
          <div className="doc-sign-hand">{sig.name || ' '}</div>
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

/** A 1/3-wide image that opens a section becomes a portrait beside the run of
 *  2/3-wide fields that follows it. Returns how many rows it should span. */
function portraitRows(fields: FieldDef[]): number {
  if (fields[0]?.type !== 'image' || fields[0].width !== 'third') return 0;
  let rows = 0;
  while (fields[rows + 1]?.width === 'twothirds') rows++;
  return rows;
}

export const Document = forwardRef<HTMLElement, Props>(function Document({ report, heightHint }, ref) {
  const tpl = report.template;
  const lang = tpl.lang;

  // The watermark follows the page's real diagonal, so it needs the page's size.
  const own = useRef<HTMLElement | null>(null);
  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      own.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );
  const [measured, setMeasured] = useState(0);
  useLayoutEffect(() => {
    const node = own.current;
    if (!node) return;
    const measure = () => node.offsetHeight > 0 && setMeasured(node.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const pageHeight = measured || heightHint || PAGE_HEIGHT;
  const t = (key: Key) => translate(lang, key);
  const classified = report.classification !== 'none';
  const classLabel = t(`class.${report.classification}` as Key);

  const sections = tpl.sections
    .map((section) => ({
      ...section,
      fields: report.hideEmpty
        ? section.fields.filter((def) => !isEmpty(def, report.values[def.id]))
        : section.fields,
    }))
    .filter((section) => section.fields.length > 0);

  return (
    <article
      ref={setRefs}
      lang={lang}
      className={`doc theme-${tpl.theme} class-${report.classification}`}
      style={{ '--accent': tpl.accent } as CSSProperties}
    >
      {classified && <div className="doc-class">{classLabel}</div>}

      <div className="doc-body">
        <header className="doc-head">
          {(tpl.logo || tpl.emblem !== 'none') && (
            <div className="doc-emblem">
              {tpl.logo ? <img src={tpl.logo} alt="" /> : <Emblem id={tpl.emblem} />}
            </div>
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

        <div className="doc-sections">
          {sections.map((section, i) => (
            <section key={section.id} className="doc-section">
              <h2 className="doc-section-head">
                <span className="doc-section-no">{String(i + 1).padStart(2, '0')}</span>
                <span className="doc-section-title">{section.title}</span>
                <span className="doc-section-rule" />
              </h2>
              <div className="doc-grid">
                {section.fields.map((def, fi) => {
                  // A lone field whose label repeats the section heading reads better without it.
                  const single = section.fields.length === 1;
                  const showLabel = def.label && !(single && def.label === section.title);
                  const rows = fi === 0 ? portraitRows(section.fields) : 0;
                  return (
                    <div
                      key={def.id}
                      className={`doc-field w-${def.width ?? 'full'} f-${def.type}${rows ? ' is-portrait' : ''}`}
                      style={rows ? { gridRow: `span ${rows}` } : undefined}
                    >
                      {showLabel && <div className="doc-label">{def.label}</div>}
                      <FieldBody def={def} value={report.values[def.id]} docNo={report.docNo} lang={lang} />
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <footer className="doc-foot">
          <span>
            {SHIP_NAME} — “{t('doc.motto')}”
          </span>
          <span className="doc-foot-hash">
            {hashHex(report.docNo + report.id, 16).replace(/(.{4})/g, '$1 ').trim()}
          </span>
        </footer>
      </div>

      {classified && <div className="doc-class">{classLabel}</div>}
      {classified && report.watermark && (
        <Watermark label={classLabel.toLocaleUpperCase(lang)} height={pageHeight} />
      )}
    </article>
  );
});
