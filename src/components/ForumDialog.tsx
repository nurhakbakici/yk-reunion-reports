import { useEffect, useRef, useState } from 'react';
import { translate, useT } from '../i18n';
import { fitMessage, reportToBBCode } from '../lib/bbcode';
import {
  FORUM_WINDOW,
  createHandoff,
  defaultBoard,
  fetchBoards,
  fitFiles,
  forumFileName,
  postUrl,
  type ForumBoards,
  type ForumFile,
  type Handoff,
  type HandoffStatus,
} from '../lib/forum';
import { pagesToPdf, scalePng } from '../lib/pdf';
import type { Report } from '../types';
import { Dialog } from './AccountDialog';

// The forum's subject field takes 80 characters
const MAX_SUBJECT = 80;

interface Prepared {
  metin: string;
  files: ForumFile[];
  pdfDropped: boolean;
}

/** The text, the PDF (at half size if the full one is over the forum's file limit) and the page-1 preview, as far
 *  as they fit. */
async function prepare(pages: Blob[], report: Report, limits: ForumBoards['sinirlar']): Promise<Prepared> {
  const metin = fitMessage(reportToBBCode(report), limits.ileti, translate(report.template.lang, 'forum.truncated'));
  // The same title as "PDF indir"
  const title = report.title.trim() || report.template.docTitle;
  const perFile = limits.dosya_kb * 1024;
  let pdf = await pagesToPdf(pages, title, 1);
  if (perFile && pdf.size > perFile) pdf = await pagesToPdf(pages, title, 0.5);
  const files = fitFiles(
    [
      { ad: forumFileName(report.docNo, '', 'pdf'), tur: 'application/pdf', veri: pdf },
      { ad: forumFileName(report.docNo, '-onizleme', 'png'), tur: 'image/png', veri: await scalePng(pages[0], 0.5) },
    ],
    limits,
  );
  return { metin, files, pdfDropped: !files.some((f) => f.tur === 'application/pdf') };
}

/** "Foruma gönder": pick a ReUnion board, then the forum's New Topic page opens filled in; the player posts it. */
export function ForumDialog({
  report,
  makePages,
  onClose,
}: {
  report: Report;
  makePages: () => Promise<Blob[]>;
  onClose: () => void;
}) {
  const t = useT();
  const [boards, setBoards] = useState<ForumBoards | null | undefined>(undefined);
  const [board, setBoard] = useState(0);
  const [subject, setSubject] = useState(
    (report.title.trim() || `${report.template.docTitle} ${report.docNo}`).slice(0, MAX_SUBJECT),
  );
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<HandoffStatus | null>(null);
  const [error, setError] = useState('');
  const handoff = useRef<Handoff | null>(null);
  const offline = location.protocol === 'file:';
  const busy = !prepared && !failed;

  // The board list, then everything the forum gets, while the player picks a board: the click then only opens the
  // forum tab. Once that tab is in front, this one runs in the background, where drawing pages can stall.
  useEffect(() => {
    if (offline) return;
    let live = true;
    (async () => {
      const answer = await fetchBoards();
      if (!live) return;
      setBoards(answer);
      if (!answer) return;
      setBoard(defaultBoard(answer, report.classification));
      try {
        const ready = await prepare(await makePages(), report, answer.sinirlar);
        if (live) setPrepared(ready);
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [offline, report, makePages]);

  // Messages from the forum tab, and the time-out check, for as long as the dialog is open
  useEffect(() => {
    const onMessage = (event: MessageEvent) => handoff.current?.receive(event);
    window.addEventListener('message', onMessage);
    const timer = window.setInterval(() => handoff.current?.tick(), 1000);
    return () => {
      window.removeEventListener('message', onMessage);
      window.clearInterval(timer);
    };
  }, []);

  const open = () => {
    if (!prepared) return;
    // Opened inside the click, so a pop-up blocker lets it through
    const tab = window.open(postUrl(board), FORUM_WINDOW);
    if (!tab) {
      setError(t('forum.blocked'));
      return;
    }
    setError('');
    handoff.current = createHandoff(tab, setStatus);
    handoff.current.setReport({
      kaynak: 'ankha',
      tur: 'rapor',
      surum: 1,
      konu: subject.trim(),
      metin: prepared.metin,
      dosyalar: prepared.files,
    });
  };

  const message = (() => {
    if (!status) return '';
    switch (status.tur) {
      case 'bekliyor':
      case 'gonderildi':
        return t('forum.waiting');
      case 'alindi':
        return status.ekIzniYok ? `${t('forum.received')} ${t('forum.noAttach')}` : t('forum.received');
      case 'hata':
        return status.neden === 'form-dolu' ? t('forum.formFull') : t('forum.invalid');
      case 'zaman-asimi':
        return t('forum.timeout');
    }
  })();

  return (
    <Dialog title={t('forum.title')} onClose={onClose}>
      {offline ? (
        <p className="dialog-text">{t('forum.onlineOnly')}</p>
      ) : boards === undefined ? (
        <p className="dialog-text">{t('forum.loading')}</p>
      ) : boards === null ? (
        <p className="form-error">{t('forum.offline')}</p>
      ) : (
        <div className="stack">
          <label className="field">
            <span className="field-label">{t('forum.board')}</span>
            <select value={board} onChange={(e) => setBoard(Number(e.target.value))}>
              {boards.bolumler.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.ad}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">{t('forum.subject')}</span>
            <input type="text" maxLength={MAX_SUBJECT} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <p className="dialog-text dim">{t('forum.hint')}</p>
          {busy && <p className="dialog-text">{t('forum.preparing')}</p>}
          {message && <p className="dialog-text">{message}</p>}
          {prepared?.pdfDropped && <p className="dialog-text dim">{t('forum.noPdf')}</p>}
          {failed && <p className="form-error">{t('toast.pdfFailed')}</p>}
          {error && <p className="form-error">{error}</p>}
          <div className="dialog-actions">
            <button type="button" className="btn btn-primary" disabled={!prepared || !subject.trim()} onClick={open}>
              {busy ? t('forum.preparing') : t('forum.open')}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
