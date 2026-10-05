import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { importFromFile } from '../lib/importFile';
import { downloadText } from '../lib/util';
import { navigate } from '../router';
import { allTemplates, exportFile, useStore } from '../store';
import type { Template } from '../types';
import { TemplateThumb, Thumb } from './Thumb';

export function TemplatePicker({ onPick, onClose }: { onPick: (t: Template) => void; onClose: () => void }) {
  const t = useT();
  const custom = useStore((s) => s.templates);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={t('picker.title')}>
        <div className="dialog-head">
          <h2>{t('picker.title')}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
            ✕
          </button>
        </div>
        <div className="card-grid">
          {/* The user's own templates first: they made them to use them. */}
          {[...custom, ...allTemplates([])].map((tpl) => (
            <button type="button" key={tpl.id} className="card card-button" onClick={() => onPick(tpl)}>
              <TemplateThumb template={tpl} />
              <span className="card-body">
                <span className="card-title">{tpl.name}</span>
                <span className="card-desc">{tpl.description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ReportsView() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const reports = useStore((s) => s.reports);
  const templates = useStore((s) => s.templates);
  const createReport = useStore((s) => s.createReport);
  const duplicateReport = useStore((s) => s.duplicateReport);
  const deleteReport = useStore((s) => s.deleteReport);
  const [picking, setPicking] = useState(false);

  const sorted = [...reports].sort((a, b) => b.updatedAt - a.updatedAt);

  const backup = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(exportFile({ kind: 'backup', reports, templates }), `yk-reunion-yedek-${stamp}.json`);
  };

  return (
    <main className="page">
      <div className="page-head">
        <h1>{t('reports.title')}</h1>
        <div className="page-actions">
          <button type="button" className="btn" onClick={importFromFile}>
            {t('common.import')}
          </button>
          {(reports.length > 0 || templates.length > 0) && (
            <button type="button" className="btn" onClick={backup}>
              {t('reports.backup')}
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => setPicking(true)}>
            + {t('reports.new')}
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="empty">
          <h2>{t('reports.emptyTitle')}</h2>
          <p>{t('reports.emptyBody')}</p>
          <button type="button" className="btn btn-primary" onClick={() => setPicking(true)}>
            + {t('reports.new')}
          </button>
        </div>
      ) : (
        <div className="card-grid">
          {sorted.map((report) => (
            <div key={report.id} className="card">
              <a className="card-link" href={`#/report/${report.id}`}>
                <Thumb report={report} />
                <span className="card-body">
                  <span className="card-title">{report.title || t('reports.untitled')}</span>
                  <span className="card-desc">
                    {report.template.name} · {report.docNo}
                  </span>
                  <span className="card-meta">{new Date(report.updatedAt).toLocaleDateString(lang)}</span>
                </span>
              </a>
              <div className="card-actions">
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => duplicateReport(report.id, t('common.copySuffix'))}
                >
                  {t('common.duplicate')}
                </button>
                <button
                  type="button"
                  className="btn btn-small btn-danger"
                  onClick={() => window.confirm(t('reports.confirmDelete')) && deleteReport(report.id)}
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {picking && (
        <TemplatePicker
          onClose={() => setPicking(false)}
          onPick={(tpl) => navigate(`/report/${createReport(tpl)}`)}
        />
      )}
    </main>
  );
}
