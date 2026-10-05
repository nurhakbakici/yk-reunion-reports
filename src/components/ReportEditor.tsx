import { useMemo, useRef, useState } from 'react';
import { cloudEnabled } from '../cloud/config';
import { useCloud } from '../cloud/store';
import { useT, type Key } from '../i18n';
import { clone, downloadText, makeDocNo } from '../lib/util';
import { navigate } from '../router';
import { exportFile, findTemplate, templateSignature, useStore } from '../store';
import { CLASSIFICATIONS, type Classification, type FieldDef } from '../types';
import { ExportButtons, fileBaseFor } from './ExportButtons';
import { FieldInput } from './FieldInput';
import { PreviewPane } from './PreviewPane';
import { PublishDialog } from './PublishDialog';

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
  const published = useCloud((s) => s.mine.some((e) => e.localId === id));

  const docRef = useRef<HTMLElement>(null);
  const [publishing, setPublishing] = useState(false);
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
  const fileBase = fileBaseFor(report);

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
          <ExportButtons report={report} docRef={docRef} onReveal={() => setTab('preview')} />
          {cloudEnabled && (
            <button type="button" className="btn" onClick={() => setPublishing(true)}>
              {published ? t('archive.published') : t('archive.publish')}
            </button>
          )}
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

      {publishing && <PublishDialog report={report} onClose={() => setPublishing(false)} />}
    </main>
  );
}
