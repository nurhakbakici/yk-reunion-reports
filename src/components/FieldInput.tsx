import { useId } from 'react';
import { useT } from '../i18n';
import { LORE } from '../lore';
import { fileToDataUrl, gameDate, pickFile } from '../lib/util';
import { asImage, asNumber, asRows, asSignature, asText } from '../lib/values';
import { useStore } from '../store';
import type { FieldDef, FieldValue } from '../types';

interface Props {
  def: FieldDef;
  value: FieldValue | undefined;
  onChange: (value: FieldValue) => void;
}

/** The form control for one template field. */
export function FieldInput({ def, value, onChange }: Props) {
  const t = useT();
  const showToast = useStore((s) => s.showToast);
  const id = useId();

  switch (def.type) {
    case 'longtext':
      return (
        <label className="field">
          <span className="field-label">{def.label}</span>
          <textarea
            rows={5}
            value={asText(value)}
            placeholder={def.placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
          <span className="field-hint">{t('field.markupHint')}</span>
        </label>
      );

    case 'list':
      return (
        <label className="field">
          <span className="field-label">{def.label}</span>
          <textarea
            rows={4}
            value={asText(value)}
            placeholder={def.placeholder || t('field.listHint')}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      );

    case 'select': {
      const current = asText(value);
      const options = def.options ?? [];
      return (
        <label className="field">
          <span className="field-label">{def.label}</span>
          <select value={current} onChange={(e) => onChange(e.target.value)}>
            <option value="">{t('field.choose')}</option>
            {/* A value from an older version of the template stays selectable. */}
            {current && !options.includes(current) && <option value={current}>{current}</option>}
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      );
    }

    case 'date':
      return (
        <label className="field">
          <span className="field-label">{def.label}</span>
          <span className="field-row">
            <input
              type="text"
              value={asText(value)}
              placeholder={def.placeholder || gameDate()}
              onChange={(e) => onChange(e.target.value)}
            />
            <button type="button" className="btn btn-small" onClick={() => onChange(gameDate())}>
              {t('field.today')}
            </button>
          </span>
        </label>
      );

    case 'scale': {
      const max = def.max ?? 5;
      const current = asNumber(value);
      return (
        <div className="field" role="group" aria-labelledby={id}>
          <span className="field-label" id={id}>
            {def.label}
          </span>
          <span className="scale-input">
            {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={n <= current ? 'scale-step on' : 'scale-step'}
                aria-pressed={n === current}
                onClick={() => onChange(n === current ? 0 : n)}
              >
                {n}
              </button>
            ))}
          </span>
        </div>
      );
    }

    case 'table': {
      const columns = def.columns ?? [];
      const stored = asRows(value, columns.length);
      const rows = stored.length ? stored : [columns.map(() => '')];
      const setCell = (ri: number, ci: number, text: string) =>
        onChange(rows.map((row, r) => (r === ri ? row.map((cell, c) => (c === ci ? text : cell)) : row)));
      return (
        <div className="field" role="group" aria-labelledby={id}>
          <span className="field-label" id={id}>
            {def.label}
          </span>
          <div className="table-input">
            {rows.map((row, ri) => (
              <div className="table-input-row" key={ri}>
                <div className="table-input-cells">
                  {row.map((cell, ci) => (
                    <input
                      key={ci}
                      type="text"
                      value={cell}
                      placeholder={columns[ci]}
                      aria-label={`${columns[ci]} ${ri + 1}`}
                      onChange={(e) => setCell(ri, ci, e.target.value)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  title={t('field.removeRow')}
                  aria-label={t('field.removeRow')}
                  onClick={() => onChange(rows.filter((_, r) => r !== ri))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-small" onClick={() => onChange([...rows, columns.map(() => '')])}>
            + {t('field.addRow')}
          </button>
        </div>
      );
    }

    case 'image': {
      const image = asImage(value);
      const choose = async () => {
        const file = await pickFile('image/*');
        if (!file) return;
        try {
          onChange({ src: await fileToDataUrl(file), caption: image.caption });
        } catch {
          showToast(t('toast.imageBad'));
        }
      };
      return (
        <div className="field" role="group" aria-labelledby={id}>
          <span className="field-label" id={id}>
            {def.label}
          </span>
          <div className="image-input">
            {image.src && <img src={image.src} alt="" />}
            <div className="image-input-side">
              <span className="field-row">
                <button type="button" className="btn btn-small" onClick={choose}>
                  {image.src ? t('field.changeImage') : t('field.chooseImage')}
                </button>
                {image.src && (
                  <button type="button" className="btn btn-small" onClick={() => onChange({ src: '', caption: '' })}>
                    {t('field.remove')}
                  </button>
                )}
              </span>
              <input
                type="text"
                value={image.caption}
                placeholder={t('field.caption')}
                aria-label={t('field.caption')}
                onChange={(e) => onChange({ ...image, caption: e.target.value })}
              />
            </div>
          </div>
        </div>
      );
    }

    case 'signature': {
      const sig = asSignature(value);
      return (
        <div className="field" role="group" aria-labelledby={id}>
          <span className="field-label" id={id}>
            {def.label}
          </span>
          <span className="field-row">
            <input
              type="text"
              value={sig.name}
              placeholder={t('field.sigName')}
              aria-label={t('field.sigName')}
              onChange={(e) => onChange({ ...sig, name: e.target.value })}
            />
            <input
              type="text"
              value={sig.title}
              placeholder={t('field.sigTitle')}
              aria-label={t('field.sigTitle')}
              onChange={(e) => onChange({ ...sig, title: e.target.value })}
            />
          </span>
        </div>
      );
    }

    default: {
      const suggestions = [...(def.source ? LORE[def.source] : []), ...(def.options ?? [])];
      return (
        <label className="field">
          <span className="field-label">{def.label}</span>
          <input
            type="text"
            value={asText(value)}
            placeholder={def.placeholder}
            list={suggestions.length ? id : undefined}
            onChange={(e) => onChange(e.target.value)}
          />
          {suggestions.length > 0 && (
            <datalist id={id}>
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          )}
        </label>
      );
    }
  }
}
