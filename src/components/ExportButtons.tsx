import { useDeferredValue, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n';
import { copyImage, copyText, documentToPngs, reportToText, stackImages } from '../lib/exporters';
import { pagesToPdf } from '../lib/pdf';
import { downloadBlob, slugify } from '../lib/util';
import { useStore } from '../store';
import type { Report } from '../types';
import { Document } from './Document';
import { ForumDialog } from './ForumDialog';

export function fileBaseFor(report: Report): string {
  return slugify(`${report.docNo} ${report.title}`);
}

/** PNG, PDF, clipboard image, print and text export for a report, and "Foruma gönder". */
export function ExportButtons({ report }: { report: Report }) {
  const t = useT();
  const showToast = useStore((s) => s.showToast);
  const [busy, setBusy] = useState(false);
  const [forumOpen, setForumOpen] = useState(false);

  // Exports are taken from a full-size copy of their own, kept out of sight
  // (see #print-root in document.css). The preview may be scaled down, or not
  // drawn at all on a phone; this copy is always laid out and knows its pages.
  const copy = useRef<HTMLElement>(null);
  // It can lag a keystroke behind: typing must not wait for a second layout.
  const exported = useDeferredValue(report);

  /** Runs an export that needs the pages as images, with one busy state for all of them. */
  const withImages = async (
    use: (pages: Blob[]) => Promise<string | void> | string | void,
    failed: 'toast.pngFailed' | 'toast.pdfFailed' = 'toast.pngFailed',
  ) => {
    if (!copy.current || busy) return;
    setBusy(true);
    try {
      const done = await use(await documentToPngs(copy.current));
      if (done) showToast(done);
    } catch {
      showToast(t(failed));
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

  const downloadPdf = async (pages: Blob[]) => {
    downloadBlob(await pagesToPdf(pages, report.title.trim() || report.template.docTitle), `${fileBaseFor(report)}.pdf`);
  };

  /** The forum dialog asks for the pages when the player sends; the hidden copy is the one exports use. */
  const makePages = () => {
    if (!copy.current) return Promise.reject(new Error('no document'));
    return documentToPngs(copy.current);
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
      <button type="button" className="btn" disabled={busy} onClick={() => withImages(downloadPdf, 'toast.pdfFailed')}>
        {t('export.pdf')}
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
      <button type="button" className="btn" onClick={() => setForumOpen(true)}>
        {t('export.forum')}
      </button>
      {forumOpen && <ForumDialog report={report} makePages={makePages} onClose={() => setForumOpen(false)} />}

      {createPortal(<Document ref={copy} report={exported} />, document.getElementById('print-root')!)}
    </>
  );
}
