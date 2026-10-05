import { useEffect, useMemo, useRef, useState } from 'react';
import { useT, type Key } from '../i18n';
import { fileToDataUrl, pickFile, uid } from '../lib/util';
import { navigate } from '../router';
import { findTemplate, useStore } from '../store';
import {
  CLASSIFICATIONS,
  EMBLEMS,
  FIELD_TYPES,
  FIELD_WIDTHS,
  LORE_SOURCES,
  THEMES,
  type Classification,
  type FieldDef,
  type FieldType,
  type FieldWidth,
  type Lang,
  type LoreSource,
  type SectionDef,
  type Template,
  type ThemeId,
} from '../types';
import { Emblem } from './Emblem';
import { PreviewPane } from './PreviewPane';
import { sampleReport } from './Thumb';

const ACCENTS = ['#3fd0c9', '#f0a23b', '#e6c545', '#ffb347', '#a3271f', '#17806a', '#3d5fd9', '#5f4596', '#2b4a70'];

/** A textarea that edits a list of strings, one per line. It keeps its own text
 *  so that an empty line being typed is not swallowed before it gets content. */
function LinesInput({ value, onChange, rows = 3 }: { value: string[]; onChange: (v: string[]) => void; rows?: number }) {
  const [text, setText] = useState(value.join('\n'));
  const emitted = useRef(value);
  useEffect(() => {
    if (value !== emitted.current) setText(value.join('\n'));
  }, [value]);
  return (
    <textarea
      rows={rows}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const lines = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean);
        emitted.current = lines;
        onChange(lines);
      }}
    />
  );
}

function move<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const to = index + dir;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/** Fills in what a field type cannot work without when a field is switched to it. */
function withTypeDefaults(field: FieldDef, type: FieldType): FieldDef {
  const next: FieldDef = { ...field, type };
  if (type === 'select' && !next.options?.length) next.options = ['A', 'B'];
  if (type === 'table' && !next.columns?.length) next.columns = ['1', '2', '3'];
  if (type === 'scale' && !next.max) next.max = 5;
  return next;
}

function FieldEditor({
  field,
  onChange,
  onMove,
  onRemove,
}: {
  field: FieldDef;
  onChange: (f: FieldDef) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const hasPlaceholder = ['text', 'longtext', 'list', 'date'].includes(field.type);

  return (
    <div className="field-editor">
      <div className="field-editor-main">
        <input
          type="text"
          className="grow"
          value={field.label}
          placeholder={t('tpl.fieldLabel')}
          aria-label={t('tpl.fieldLabel')}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
        />
        <span className="mini-actions">
          <button type="button" className="icon-btn" title={t('tpl.moveUp')} aria-label={t('tpl.moveUp')} onClick={() => onMove(-1)}>
            ↑
          </button>
          <button type="button" className="icon-btn" title={t('tpl.moveDown')} aria-label={t('tpl.moveDown')} onClick={() => onMove(1)}>
            ↓
          </button>
          <button type="button" className="icon-btn danger" title={t('tpl.removeField')} aria-label={t('tpl.removeField')} onClick={onRemove}>
            ✕
          </button>
        </span>
      </div>

      <div className="field-editor-extra">
        <label className="field">
          <span className="field-label">{t('tpl.type')}</span>
          <select value={field.type} onChange={(e) => onChange(withTypeDefaults(field, e.target.value as FieldType))}>
            {FIELD_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`type.${type}` as Key)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">{t('tpl.width')}</span>
          <select value={field.width ?? 'full'} onChange={(e) => onChange({ ...field, width: e.target.value as FieldWidth })}>
            {FIELD_WIDTHS.map((w) => (
              <option key={w} value={w}>
                {t(`width.${w}` as Key)}
              </option>
            ))}
          </select>
        </label>
        {field.type === 'select' && (
          <label className="field">
            <span className="field-label">{t('tpl.options')}</span>
            <LinesInput value={field.options ?? []} onChange={(options) => onChange({ ...field, options })} />
          </label>
        )}
        {field.type === 'table' && (
          <label className="field">
            <span className="field-label">{t('tpl.columns')}</span>
            <LinesInput value={field.columns ?? []} onChange={(columns) => onChange({ ...field, columns })} />
          </label>
        )}
        {field.type === 'scale' && (
          <label className="field">
            <span className="field-label">{t('tpl.max')}</span>
            <input
              type="number"
              min={2}
              max={12}
              value={field.max ?? 5}
              onChange={(e) => onChange({ ...field, max: Math.max(2, Math.min(12, Number(e.target.value) || 5)) })}
            />
          </label>
        )}
        {field.type === 'text' && (
          <label className="field">
            <span className="field-label">{t('tpl.source')}</span>
            <select
              value={field.source ?? ''}
              onChange={(e) => onChange({ ...field, source: (e.target.value || undefined) as LoreSource | undefined })}
            >
              <option value="">{t('source.none')}</option>
              {LORE_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {t(`source.${s}` as Key)}
                </option>
              ))}
            </select>
          </label>
        )}
        {hasPlaceholder && (
          <label className="field">
            <span className="field-label">{t('tpl.placeholder')}</span>
            <input
              type="text"
              value={field.placeholder ?? ''}
              onChange={(e) => onChange({ ...field, placeholder: e.target.value || undefined })}
            />
          </label>
        )}
      </div>
    </div>
  );
}

export function TemplateEditor({ id }: { id: string }) {
  const t = useT();
  const templates = useStore((s) => s.templates);
  const patchTemplate = useStore((s) => s.patchTemplate);
  const createTemplate = useStore((s) => s.createTemplate);
  const createReport = useStore((s) => s.createReport);
  const showToast = useStore((s) => s.showToast);
  const [tab, setTab] = useState<'form' | 'preview'>('form');

  const tpl = findTemplate(templates, id);
  const sampleSubject = t('tpl.sampleSubject');
  const sample = useMemo(() => (tpl ? sampleReport(tpl, sampleSubject) : null), [tpl, sampleSubject]);

  if (!tpl || !sample) {
    return (
      <main className="page">
        <div className="empty">
          <p>{t('tpl.notFound')}</p>
          <a className="btn" href="#/templates">
            ← {t('tpl.back')}
          </a>
        </div>
      </main>
    );
  }

  if (tpl.builtin) {
    return (
      <main className="page">
        <div className="empty">
          <p>{t('tpl.readonly')}</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate(`/template/${createTemplate(tpl, `${tpl.name} ${t('common.copySuffix')}`)}`)}
          >
            {t('templates.customize')}
          </button>
        </div>
      </main>
    );
  }

  const patch = (p: Partial<Omit<Template, 'id'>>) => patchTemplate(tpl.id, p);
  const setSections = (sections: SectionDef[]) => patch({ sections });
  const patchSection = (si: number, p: Partial<SectionDef>) =>
    setSections(tpl.sections.map((s, i) => (i === si ? { ...s, ...p } : s)));
  const setFields = (si: number, fields: FieldDef[]) => patchSection(si, { fields });

  const uploadLogo = async () => {
    const file = await pickFile('image/*');
    if (!file) return;
    try {
      patch({ logo: await fileToDataUrl(file, 320) });
    } catch {
      showToast(t('toast.imageBad'));
    }
  };

  return (
    <main className="editor">
      <div className="editor-bar">
        <a className="back-link" href="#/templates">
          ← {t('tpl.back')}
        </a>
        <span className="editor-name">{tpl.name}</span>
        <div className="editor-actions">
          <button type="button" className="btn btn-primary" onClick={() => navigate(`/report/${createReport(tpl)}`)}>
            {t('templates.use')}
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
          <section className="panel">
            <h2 className="panel-title">{t('tpl.settings')}</h2>
            <div className="form-grid">
              <label className="field">
                <span className="field-label">{t('tpl.name')}</span>
                <input type="text" value={tpl.name} onChange={(e) => patch({ name: e.target.value })} />
              </label>
              <label className="field">
                <span className="field-label">{t('tpl.docTitle')}</span>
                <input type="text" value={tpl.docTitle} onChange={(e) => patch({ docTitle: e.target.value })} />
              </label>
              <label className="field span-2">
                <span className="field-label">{t('tpl.description')}</span>
                <input type="text" value={tpl.description} onChange={(e) => patch({ description: e.target.value })} />
              </label>
              <label className="field span-2">
                <span className="field-label">{t('tpl.issuer')}</span>
                <input
                  type="text"
                  value={tpl.issuer}
                  placeholder={t('tpl.issuerPh')}
                  onChange={(e) => patch({ issuer: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field-label">{t('tpl.codePrefix')}</span>
                <input
                  type="text"
                  maxLength={6}
                  value={tpl.codePrefix}
                  onChange={(e) => patch({ codePrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                />
              </label>
              <label className="field">
                <span className="field-label">{t('tpl.classification')}</span>
                <select
                  value={tpl.classification}
                  onChange={(e) => patch({ classification: e.target.value as Classification })}
                >
                  {CLASSIFICATIONS.map((c) => (
                    <option key={c} value={c}>
                      {t(`class.${c}` as Key)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">{t('tpl.lang')}</span>
                <select value={tpl.lang} onChange={(e) => patch({ lang: e.target.value as Lang })}>
                  <option value="tr">Türkçe</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label className="field">
                <span className="field-label">{t('tpl.theme')}</span>
                <select value={tpl.theme} onChange={(e) => patch({ theme: e.target.value as ThemeId })}>
                  {THEMES.map((theme) => (
                    <option key={theme} value={theme}>
                      {t(`theme.${theme}` as Key)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="field">
                <span className="field-label">{t('tpl.accent')}</span>
                <span className="swatches">
                  <input
                    type="color"
                    value={tpl.accent}
                    aria-label={t('tpl.accent')}
                    onChange={(e) => patch({ accent: e.target.value })}
                  />
                  {ACCENTS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={c === tpl.accent ? 'swatch on' : 'swatch'}
                      style={{ background: c }}
                      aria-label={c}
                      onClick={() => patch({ accent: c })}
                    />
                  ))}
                </span>
              </div>
              <div className="field span-2">
                <span className="field-label">{t('tpl.emblem')}</span>
                <span className="emblems">
                  {EMBLEMS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      className={!tpl.logo && e === tpl.emblem ? 'emblem-pick on' : 'emblem-pick'}
                      title={t(`emblem.${e}` as Key)}
                      aria-label={t(`emblem.${e}` as Key)}
                      onClick={() => patch({ emblem: e, logo: undefined })}
                    >
                      {e === 'none' ? '∅' : <Emblem id={e} size={26} />}
                    </button>
                  ))}
                  <button type="button" className={tpl.logo ? 'emblem-pick on wide' : 'emblem-pick wide'} onClick={uploadLogo}>
                    {tpl.logo ? <img src={tpl.logo} alt="" /> : null}
                    {t('tpl.uploadLogo')}
                  </button>
                </span>
              </div>
            </div>
          </section>

          <h2 className="group-title">{t('tpl.sections')}</h2>

          {tpl.sections.map((section, si) => (
            <section className="panel" key={section.id}>
              <div className="section-editor-head">
                <input
                  type="text"
                  className="grow section-title-input"
                  value={section.title}
                  placeholder={t('tpl.sectionTitle')}
                  aria-label={t('tpl.sectionTitle')}
                  onChange={(e) => patchSection(si, { title: e.target.value })}
                />
                <span className="mini-actions">
                  <button type="button" className="icon-btn" title={t('tpl.moveUp')} aria-label={t('tpl.moveUp')} onClick={() => setSections(move(tpl.sections, si, -1))}>
                    ↑
                  </button>
                  <button type="button" className="icon-btn" title={t('tpl.moveDown')} aria-label={t('tpl.moveDown')} onClick={() => setSections(move(tpl.sections, si, 1))}>
                    ↓
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    title={t('tpl.removeSection')}
                    aria-label={t('tpl.removeSection')}
                    onClick={() => setSections(tpl.sections.filter((_, i) => i !== si))}
                  >
                    ✕
                  </button>
                </span>
              </div>

              {section.fields.map((field, fi) => (
                <FieldEditor
                  key={field.id}
                  field={field}
                  onChange={(next) => setFields(si, section.fields.map((f, i) => (i === fi ? next : f)))}
                  onMove={(dir) => setFields(si, move(section.fields, fi, dir))}
                  onRemove={() => setFields(si, section.fields.filter((_, i) => i !== fi))}
                />
              ))}

              <button
                type="button"
                className="btn btn-small"
                onClick={() =>
                  setFields(si, [...section.fields, { id: uid('f-'), type: 'text', label: t('tpl.newField'), width: 'full' }])
                }
              >
                + {t('tpl.addField')}
              </button>
            </section>
          ))}

          <button
            type="button"
            className="btn"
            onClick={() => setSections([...tpl.sections, { id: uid('s-'), title: t('tpl.newSection'), fields: [] }])}
          >
            + {t('tpl.addSection')}
          </button>
        </div>

        <PreviewPane report={sample} />
      </div>
    </main>
  );
}
