import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT, type Key } from '../i18n';
import { copyImage, copyText, documentToPng, reportToText } from '../lib/exporters';
import { clone, downloadBlob, downloadText, makeDocNo, slugify } from '../lib/util';
import { navigate } from '../router';
import { exportFile, findTemplate, templateSignature, useStore } from '../store';
import { CLASSIFICATIONS, type Classification, type FieldDef } from '../types';
import { Document } from './Document';
import { FieldInput } from './FieldInput';
import { PreviewPane } from './PreviewPane';

/** Wide controls always take a full form row, whatever their width in the document. */
function formSpan(def: FieldDef): string {
  const wide = ['longtext', 'list', 'table', 'image', 'signature'].includes(def.type);
  return wide || !def.width || def.width === 'full' || def.width === 'twothirds' ? 'span-2' : '';
}

export function ReportEditor({ id }: { id: string }) {
  const t = useT();
  const report = useStore((s) => s.reports.find((r) => r.id === id));
  const templates = useStore((s) => s.templates);
  const patchReport = useStore((s) => s.patchReport);
  const setValue = useStore((s) => s.setValue);
  const duplicateReport = useStore((s) => s.duplicateReport);
  const deleteReport = useStore((s) => s.deleteReport);
  const showToast = useStore((s) => s.showToast);

  const docRef = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'form' | 'preview'>('form');

  const current = report ? findTemplate(templates, report.template.id) : undefined;
  const templateChanged = useMemo(
    () => !!report && !!current && templateSignature(current) !== templateSignature(report.template),
    [report?.template, current],
  );

  if (!report) {
    return (
      <main className="page">
        <div className="empty">
          <p>{t('editor.notFound')}</p>
          <a className="btn" href="#/reports">
            ← {t('editor.back')}
          </a>
        </div>
      </main>
    );
  }

  const tpl = report.template;
  const fileBase = slugify(`${report.docNo} ${report.title}`);

  /** Runs an export that needs the rendered document, with one busy state for all of them. */
  const withImage = async (use: (png: Blob) => Promise<void> | void, done?: Key) => {
    if (!docRef.current || busy) return;
    setBusy(true);
    try {
      // On a phone the document sits in a hidden tab, and a hidden element cannot be drawn.
      if (docRef.current.offsetWidth === 0) {
        setTab('preview');
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

  const remove = () => {
    if (!window.confirm(t('reports.confirmDelete'))) return;
    deleteReport(report.id);
    navigate('/reports');
  };

  const duplicate = () => {
    const copyId = duplicateReport(report.id, t('common.copySuffix'));
    if (copyId) navigate(`/report/${copyId}`);
  };

  return (
    <main className="editor">
      <div className="editor-bar">
        <a className="back-link" href="#/reports">
          ← {t('editor.back')}
        </a>
        <span className="editor-name">
          {tpl.name}
          <span className="editor-docno">{report.docNo}</span>
        </span>
        <div className="editor-actions">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => withImage((png) => downloadBlob(png, `${fileBase}.png`))}>
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
          <button
            type="button"
            className="btn"
            onClick={() => downloadText(exportFile({ kind: 'report', report }), `${fileBase}.json`)}
          >
            {t('export.json')}
          </button>
          <button type="button" className="btn" onClick={duplicate}>
            {t('common.duplicate')}
          </button>
          <button type="button" className="btn btn-danger" onClick={remove}>
            {t('common.delete')}
          </button>
        </div>
      </div>

      <div className="editor-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'form'} onClick={() => setTab('form')}>
          {t('editor.tabForm')}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'preview'} onClick={() => setTab('preview')}>
          {t('editor.tabPreview')}
        </button>
      </div>

      <div className={`editor-main show-${tab}`}>
        <div className="editor-form">
          {templateChanged && current && (
            <div className="notice">
              <span>{t('editor.templateChanged')}</span>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => patchReport(report.id, { template: clone(current) })}
              >
                {t('editor.syncTemplate')}
              </button>
            </div>
          )}

          <section className="panel">
            <h2 className="panel-title">{t('editor.document')}</h2>
            <div className="form-grid">
              <label className="field span-2">
                <span className="field-label">{t('editor.subject')}</span>
                <input
                  type="text"
                  value={report.title}
                  placeholder={t('editor.subjectPh')}
                  onChange={(e) => patchReport(report.id, { title: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field-label">{t('editor.docNo')}</span>
                <span className="field-row">
                  <input
                    type="text"
                    value={report.docNo}
                    onChange={(e) => patchReport(report.id, { docNo: e.target.value })}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    title={t('editor.regen')}
                    aria-label={t('editor.regen')}
                    onClick={() => patchReport(report.id, { docNo: makeDocNo(tpl.codePrefix) })}
                  >
                    ↻
                  </button>
                </span>
              </label>
              <label className="field">
                <span className="field-label">{t('editor.classification')}</span>
                <select
                  value={report.classification}
                  onChange={(e) => patchReport(report.id, { classification: e.target.value as Classification })}
                >
                  {CLASSIFICATIONS.map((c) => (
                    <option key={c} value={c}>
                      {t(`class.${c}` as Key)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">{t('editor.stamp')}</span>
                <input
                  type="text"
                  value={report.stamp}
                  placeholder={t('editor.stampPh')}
                  onChange={(e) => patchReport(report.id, { stamp: e.target.value })}
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={report.hideEmpty}
                  onChange={(e) => patchReport(report.id, { hideEmpty: e.target.checked })}
                />
                <span>{t('editor.hideEmpty')}</span>
              </label>
            </div>
          </section>

          {tpl.sections.map((section) => (
            <section className="panel" key={section.id}>
              <h2 className="panel-title">{section.title}</h2>
              <div className="form-grid">
                {section.fields.map((def) => (
                  <div key={def.id} className={formSpan(def)}>
                    <FieldInput
                      def={def}
                      value={report.values[def.id]}
                      onChange={(value) => setValue(report.id, def.id, value)}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <PreviewPane ref={docRef} report={report} />
      </div>

      {/* Printing uses its own full-size copy; see #print-root in document.css. */}
      {createPortal(<Document report={report} />, document.getElementById('print-root')!)}
    </main>
  );
}
