import { useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useT, type Key } from '../i18n';
import { copyImage, copyText, documentToPng, reportToText } from '../lib/exporters';
import { downloadBlob, slugify } from '../lib/util';
import { useStore } from '../store';
import type { Report } from '../types';
import { Document } from './Document';

interface Props {
  report: Report;
  /** The on-screen document element that image exports are taken from. */
  docRef: RefObject<HTMLElement>;
  /** Called when the document is not currently drawn (hidden tab on a phone). */
  onReveal?: () => void;
}

export function fileBaseFor(report: Report): string {
  return slugify(`${report.docNo} ${report.title}`);
}

/** PNG, clipboard image, print and text export for a report shown on screen. */
export function ExportButtons({ report, docRef, onReveal }: Props) {
  const t = useT();
  const showToast = useStore((s) => s.showToast);
  const [busy, setBusy] = useState(false);

  /** Runs an export that needs the rendered document, with one busy state for all of them. */
  const withImage = async (use: (png: Blob) => Promise<void> | void, done?: Key) => {
    if (!docRef.current || busy) return;
    setBusy(true);
    try {
      // A hidden element cannot be drawn; show it first and give it a moment to lay out.
      if (docRef.current.offsetWidth === 0) {
        onReveal?.();
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      await use(await documentToPng(docRef.current));
      if (done) showToast(t(done));
    } catch {
      showToast(t('toast.pngFailed'));
    } finally {
      setBusy(false);
    }
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
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={() => withImage((png) => downloadBlob(png, `${fileBaseFor(report)}.png`))}
      >
        {busy ? t('export.working') : t('export.png')}
      </button>
      <button type="button" className="btn" disabled={busy} onClick={() => withImage(copyImage, 'toast.imageCopied')}>
        {t('export.copyImage')}
      </button>
      <button type="button" className="btn" onClick={() => window.print()}>
        {t('export.print')}
      </button>
      <button type="button" className="btn" onClick={copyAsText}>
        {t('export.copyText')}
      </button>

      {/* Printing uses its own full-size copy; see #print-root in document.css. */}
      {createPortal(<Document report={report} />, document.getElementById('print-root')!)}
    </>
  );
}
