import { useCallback, useDeferredValue, useId, useRef, useState } from 'react';
import { useT, type Key } from '../i18n';
import { copyImage, nodeToPng } from '../lib/exporters';
import { DEPARTMENT_OF, DEPT_DESIGNS, NOTE_MAX, kunyeDesign, newSerial } from '../lib/kunye';
import { downloadBlob, fileToDataUrl, pickFile, slugify } from '../lib/util';
import { ORGS, ORIGINS, SQUADS } from '../lore';
import { navigate } from '../router';
import { useStore } from '../store';
import { BLOOD_TYPES, KRIYO_STATES, type Kunye } from '../types';
import { KunyeCard } from './KunyeCard';
import { KunyePreview } from './KunyePreview';
import { removeKunye } from './KunyeView';

/** Longest side of a stored portrait: the card shows it at 120–130 px, twice that in the PNG. */
const PORTRAIT_SIDE = 360;

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  list?: string;
  maxLength?: number;
  hint?: string;
}

function TextField({ label, value, onChange, list, maxLength, hint }: TextFieldProps) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input type="text" value={value} list={list} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

function Suggestions({ id, options }: { id: string; options: string[] }) {
  return (
    <datalist id={id}>
      {options.map((o) => (
        <option key={o} value={o} />
      ))}
    </datalist>
  );
}

export function KunyeEditor({ id }: { id: string }) {
  const t = useT();
  const kunye = useStore((s) => s.kunyeler.find((k) => k.id === id));
  const patchKunye = useStore((s) => s.patchKunye);
  const showToast = useStore((s) => s.showToast);
  const [tab, setTab] = useState<'form' | 'preview'>('form');
  const uidBase = useId();
  // The PNG is taken from a full-size copy kept out of sight; the preview may be scaled down.
  const exportRef = useRef<HTMLDivElement>(null);
  const exported = useDeferredValue(kunye);
  const [busy, setBusy] = useState(false);
  const makePng = useCallback(async () => {
    const card = exportRef.current?.firstElementChild;
    if (!(card instanceof HTMLElement)) throw new Error('no card');
    return nodeToPng(card, 'kunye');
  }, []);

  if (!kunye) {
    return (
      <main className="page">
        <div className="empty">
          <p>{t('kunye.notFound')}</p>
          <a className="btn" href="#/kunye">
            ← {t('kunye.back')}
          </a>
        </div>
      </main>
    );
  }

  const set = (patch: Partial<Omit<Kunye, 'id'>>) => patchKunye(kunye.id, patch);
  const design = kunyeDesign(kunye);
  const atlas = design === 'atlas';
  const designName = atlas ? t('kunye.designAtlas') : t('kunye.designCard', { dept: kunye.department });

  const choosePortrait = async () => {
    const file = await pickFile('image/*');
    if (!file) return;
    try {
      set({ portrait: await fileToDataUrl(file, PORTRAIT_SIDE) });
    } catch {
      showToast(t('toast.imageBad'));
    }
  };

  const remove = async () => {
    if (await removeKunye(kunye, t)) navigate('/kunye');
  };

  const withPng = async (use: (png: Blob) => Promise<string | void> | string | void) => {
    if (busy) return;
    setBusy(true);
    try {
      const done = await use(await makePng());
      if (done) showToast(done);
    } catch {
      showToast(t('toast.pngFailed'));
    } finally {
      setBusy(false);
    }
  };

  const download = (png: Blob) => downloadBlob(png, `kunye-${slugify(`${kunye.serial} ${kunye.name}`)}.png`);

  const copy = async (png: Blob) => {
    try {
      await copyImage(png);
      return t('toast.imageCopied');
    } catch {
      return t('toast.clipboardFailed');
    }
  };

  return (
    <main className="editor">
      <div className="editor-bar">
        <a className="back-link" href="#/kunye">
          ← {t('kunye.back')}
        </a>
        <span className="editor-name">
          {kunye.name.trim() || t('kunye.untitled')}
          <span className="editor-docno">{kunye.serial}</span>
        </span>
        <div className="editor-actions">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => withPng(download)}>
            {busy ? t('export.working') : t('export.png')}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => withPng(copy)}>
            {t('export.copyImage')}
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
          <section className="panel">
            <h2 className="panel-title">{t('kunye.panelIdentity')}</h2>
            <div className="form-grid">
              <div className="span-2">
                <TextField
                  label={t('kunye.f.name')}
                  value={kunye.name}
                  maxLength={60}
                  hint={atlas ? t('kunye.f.nameHint') : undefined}
                  onChange={(name) => set({ name })}
                />
              </div>
              <div className="span-2">
                <TextField label={t('kunye.f.role')} value={kunye.title} maxLength={60} onChange={(title) => set({ title })} />
              </div>
              <label className="field">
                <span className="field-label">{t('kunye.f.department')}</span>
                <select value={kunye.department} onChange={(e) => set({ department: e.target.value })}>
                  {DEPT_DESIGNS.map((d) => (
                    <option key={d} value={DEPARTMENT_OF[d]}>
                      {DEPARTMENT_OF[d]}
                    </option>
                  ))}
                </select>
              </label>
              <TextField
                label={t('kunye.f.org')}
                value={kunye.org}
                list={`${uidBase}-org`}
                maxLength={60}
                hint={t('kunye.f.orgHint')}
                onChange={(org) => set({ org })}
              />
            </div>
          </section>

          {atlas && (
            <section className="panel">
              <h2 className="panel-title">{t('kunye.panelAtlas')}</h2>
              <div className="form-grid">
                <TextField label={t('kunye.f.rank')} value={kunye.rank} maxLength={40} onChange={(rank) => set({ rank })} />
                <TextField
                  label={t('kunye.f.squad')}
                  value={kunye.squad}
                  list={`${uidBase}-squad`}
                  maxLength={40}
                  onChange={(squad) => set({ squad })}
                />
              </div>
            </section>
          )}

          <section className="panel">
            <h2 className="panel-title">{t('kunye.panelDetails')}</h2>
            <div className="form-grid">
              <TextField
                label={t('kunye.f.origin')}
                value={kunye.origin}
                list={`${uidBase}-origin`}
                maxLength={60}
                onChange={(origin) => set({ origin })}
              />
              <label className="field">
                <span className="field-label">{t('kunye.f.cryo')}</span>
                <select value={kunye.cryo} onChange={(e) => set({ cryo: e.target.value as Kunye['cryo'] })}>
                  {KRIYO_STATES.map((c) => (
                    <option key={c} value={c}>
                      {c ? t(`kunye.cryo.${c}` as Key) : t('field.choose')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">{t('kunye.f.blood')}</span>
                <select value={kunye.blood} onChange={(e) => set({ blood: e.target.value })}>
                  <option value="">{t('field.choose')}</option>
                  {BLOOD_TYPES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
              {!atlas && (
                <div className="field" role="group" aria-labelledby={`${uidBase}-clearance`}>
                  <span className="field-label" id={`${uidBase}-clearance`}>
                    {t('kunye.f.clearance')}
                  </span>
                  <span className="scale-input">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={n <= kunye.clearance ? 'scale-step on' : 'scale-step'}
                        aria-pressed={n === kunye.clearance}
                        onClick={() => set({ clearance: n === kunye.clearance ? 0 : n })}
                      >
                        {n}
                      </button>
                    ))}
                  </span>
                </div>
              )}
              {!atlas && (
                <div className="span-2">
                  <TextField label={t('kunye.f.note')} value={kunye.note} maxLength={NOTE_MAX} onChange={(note) => set({ note })} />
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <h2 className="panel-title">{t('kunye.panelPortrait')}</h2>
            {atlas ? (
              <p className="field-hint">{t('kunye.portraitAtlas')}</p>
            ) : (
              <div className="image-input">
                {kunye.portrait && <img src={kunye.portrait} alt="" />}
                <div className="image-input-side">
                  <span className="field-row">
                    <button type="button" className="btn btn-small" onClick={choosePortrait}>
                      {kunye.portrait ? t('field.changeImage') : t('field.chooseImage')}
                    </button>
                    {kunye.portrait && (
                      <button type="button" className="btn btn-small" onClick={() => set({ portrait: undefined })}>
                        {t('field.remove')}
                      </button>
                    )}
                  </span>
                </div>
              </div>
            )}
          </section>

          <section className="panel">
            <h2 className="panel-title">{t('kunye.panelSerial')}</h2>
            <label className="field">
              <span className="field-label">{t('kunye.f.serial')}</span>
              <span className="field-row">
                <input
                  type="text"
                  value={kunye.serial}
                  maxLength={24}
                  onChange={(e) => set({ serial: e.target.value, serialManual: true })}
                />
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => set({ serial: newSerial(design), serialManual: false })}
                >
                  {t('kunye.serialRegen')}
                </button>
              </span>
            </label>
          </section>

          <Suggestions id={`${uidBase}-org`} options={ORGS} />
          <Suggestions id={`${uidBase}-squad`} options={SQUADS} />
          <Suggestions id={`${uidBase}-origin`} options={ORIGINS} />
        </div>

        <KunyePreview kunye={kunye} label={t('kunye.design', { name: designName })} />
      </div>

      <div className="kunye-export" ref={exportRef}>
        {exported && <KunyeCard kunye={exported} />}
      </div>
    </main>
  );
}
