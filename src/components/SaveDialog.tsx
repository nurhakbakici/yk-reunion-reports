import { useState } from 'react';
import { CloudError, isStale, useCloud, type Status } from '../cloud/store';
import { useT, type Key } from '../i18n';
import { useStore } from '../store';
import type { Report } from '../types';
import { AccountDialog, Dialog, JoinForm } from './AccountDialog';

const ERRORS: Record<CloudError['code'], Key> = {
  'too-large': 'save.tooLarge',
  'not-allowed': 'save.notAllowed',
  offline: 'save.failed',
  failed: 'save.failed',
};

/** Saves the current state of a report to the owner's archive, as a draft or as finished, or takes it back out. */
export function SaveDialog({ report, onClose }: { report: Report; onClose: () => void }) {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const user = useCloud((s) => s.user);
  const member = useCloud((s) => s.member);
  const existing = useCloud((s) => s.list.find((e) => e.localId === report.id));
  const save = useCloud((s) => s.save);
  const remove = useCloud((s) => s.remove);
  const showToast = useStore((s) => s.showToast);
  const [status, setStatus] = useState<Status>(existing?.status ?? 'draft');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!user) return <AccountDialog onClose={onClose} />;

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await save(report, status);
      showToast(t('save.done'));
      onClose();
    } catch (e) {
      setError(t(ERRORS[e instanceof CloudError ? e.code : 'failed']));
      setBusy(false);
    }
  };

  const takeOut = async () => {
    if (!existing || !window.confirm(t('archive.confirmRemove'))) return;
    setBusy(true);
    const ok = await remove(existing.id);
    showToast(t(ok ? 'archive.removed' : 'save.failed'));
    if (ok) onClose();
    else setBusy(false);
  };

  return (
    <Dialog title={t('save.title')} onClose={onClose}>
      {member === null ? (
        <p className="dialog-text">{t('app.loading')}</p>
      ) : !member ? (
        <div className="stack">
          <p className="dialog-text">{t('save.needJoin')}</p>
          <JoinForm />
        </div>
      ) : (
        <div className="stack">
          <p className="dialog-text">{t('save.snapshot')}</p>
          {existing && (
            <p className="dialog-text dim">
              {t(isStale(existing, report) ? 'save.lastStale' : 'save.last', {
                date: new Date(existing.updatedAt).toLocaleString(lang),
              })}
            </p>
          )}

          <fieldset className="choices">
            <legend className="field-label">{t('save.status')}</legend>
            {(['draft', 'final'] as const).map((v) => (
              <label key={v} className={status === v ? 'choice on' : 'choice'}>
                <input type="radio" name="status" checked={status === v} onChange={() => setStatus(v)} />
                <span>
                  <strong>{t(`archive.status.${v}` as Key)}</strong>
                  <small>{t(`save.${v}Hint` as Key)}</small>
                </span>
              </label>
            ))}
          </fieldset>

          {error && <p className="form-error">{error}</p>}

          <div className="dialog-actions">
            {existing && (
              <button type="button" className="btn btn-danger" disabled={busy} onClick={takeOut}>
                {t('archive.remove')}
              </button>
            )}
            <button type="button" className="btn btn-primary" disabled={busy} onClick={submit}>
              {busy ? t('export.working') : existing ? t('save.update') : t('save.submit')}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
