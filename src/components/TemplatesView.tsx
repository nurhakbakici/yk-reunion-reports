import { useT } from '../i18n';
import { importFromFile } from '../lib/importFile';
import { downloadText, slugify } from '../lib/util';
import { navigate } from '../router';
import { exportFile, useStore } from '../store';
import { BUILTIN_TEMPLATES } from '../templates/builtin';
import type { Template } from '../types';
import { TemplateThumb } from './Thumb';

export function TemplatesView() {
  const t = useT();
  const custom = useStore((s) => s.templates);
  const createReport = useStore((s) => s.createReport);
  const createTemplate = useStore((s) => s.createTemplate);
  const deleteTemplate = useStore((s) => s.deleteTemplate);

  const card = (tpl: Template) => {
    const fieldCount = tpl.sections.reduce((n, s) => n + s.fields.length, 0);
    return (
      <div key={tpl.id} className="card">
        <TemplateThumb template={tpl} />
        <div className="card-body">
          <span className="card-title">{tpl.name}</span>
          <span className="card-desc">{tpl.description}</span>
          <span className="card-meta">{t('templates.fieldCount', { n: fieldCount })}</span>
        </div>
        <div className="card-actions">
          <button
            type="button"
            className="btn btn-small btn-primary"
            onClick={() => navigate(`/report/${createReport(tpl)}`)}
          >
            {t('templates.use')}
          </button>
          {tpl.builtin ? (
            <button
              type="button"
              className="btn btn-small"
              onClick={() => navigate(`/template/${createTemplate(tpl, `${tpl.name} ${t('common.copySuffix')}`)}`)}
            >
              {t('templates.customize')}
            </button>
          ) : (
            <>
              <a className="btn btn-small" href={`#/template/${tpl.id}`}>
                {t('common.edit')}
              </a>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => createTemplate(tpl, `${tpl.name} ${t('common.copySuffix')}`)}
              >
                {t('common.duplicate')}
              </button>
              <button
                type="button"
                className="btn btn-small"
                onClick={() =>
                  downloadText(exportFile({ kind: 'template', template: tpl }), `sablon-${slugify(tpl.name)}.json`)
                }
              >
                {t('common.export')}
              </button>
              <button
                type="button"
                className="btn btn-small btn-danger"
                onClick={() => window.confirm(t('templates.confirmDelete')) && deleteTemplate(tpl.id)}
              >
                {t('common.delete')}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="page">
      <div className="page-head">
        <h1>{t('templates.title')}</h1>
        <div className="page-actions">
          <button type="button" className="btn" onClick={importFromFile}>
            {t('common.import')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate(`/template/${createTemplate(null, t('templates.newName'))}`)}
          >
            + {t('templates.new')}
          </button>
        </div>
      </div>

      <h2 className="group-title">{t('templates.custom')}</h2>
      {custom.length === 0 ? (
        <p className="group-empty">{t('templates.customEmpty')}</p>
      ) : (
        <div className="card-grid">{custom.map(card)}</div>
      )}

      <h2 className="group-title">{t('templates.builtin')}</h2>
      <div className="card-grid">{BUILTIN_TEMPLATES.map(card)}</div>
    </main>
  );
}
