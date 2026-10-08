import { useDeferredValue, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n';
import { copyImage, copyText, documentToPngs, reportToText, stackImages } from '../lib/exporters';
import { downloadBlob, slugify } from '../lib/util';
import { useStore } from '../store';
import type { Report } from '../types';
import { Document } from './Document';

export function fileBaseFor(report: Report): string {
  return slugify(`${report.docNo} ${report.title}`);
}

/** PNG, clipboard image, print and text export for a report. */
export function ExportButtons({ report }: { report: Report }) {
  const t = useT();
  const showToast = useStore((s) => s.showToast);
  const [busy, setBusy] = useState(false);

  // Exports are taken from a full-size copy of their own, kept out of sight
  // (see #print-root in document.css). The preview may be scaled down, or not
  // drawn at all on a phone; this copy is always laid out and knows its pages.
  const copy = useRef<HTMLElement>(null);
  // It can lag a keystroke behind: typing must not wait for a second layout.
  const exported = useDeferredValue(report);

  /** Runs an export that needs the pages as images, with one busy state for all of them. */
  const withImages = async (use: (pages: Blob[]) => Promise<string | void> | string | void) => {
    if (!copy.current || busy) return;
    setBusy(true);
    try {
      const done = await use(await documentToPngs(copy.current));
      if (done) showToast(done);
    } catch {
      showToast(t('toast.pngFailed'));
    } finally {
      setBusy(false);
    }
  };

  const download = (pages: Blob[]) => {
    const base = fileBaseFor(report);
    if (pages.length === 1) return downloadBlob(pages[0], `${base}.png`);
    // Browsers drop downloads that start in the same instant, so space them out.
    pages.forEach((page, i) =>
      setTimeout(() => downloadBlob(page, `${base}-${String(i + 1).padStart(2, '0')}.png`), i * 350),
    );
    return t('toast.pagesSaved', { n: pages.length });
  };

  const copyAsImage = async (pages: Blob[]) => {
    await copyImage(await stackImages(pages));
    return t('toast.imageCopied');
  };

  const copyAsText = async () => {
    try {
      await copyText(reportToText(report));
      showToast(t('toast.copied'));
    } catch {
      showToast(t('toast.clipboardFailed'));
    }
  };

  return (
    <>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => withImages(download)}>
        {busy ? t('export.working') : t('export.png')}
      </button>
      <button type="button" className="btn" disabled={busy} onClick={() => withImages(copyAsImage)}>
        {t('export.copyImage')}
      </button>
      <button type="button" className="btn" onClick={() => window.print()}>
        {t('export.print')}
      </button>
      <button type="button" className="btn" onClick={copyAsText}>
        {t('export.copyText')}
      </button>

      {createPortal(<Document ref={copy} report={exported} />, document.getElementById('print-root')!)}
    </>
  );
}
