import { useState } from 'react';
import { CloudError, useCloud, type Visibility } from '../cloud/store';
import { useT, type Key } from '../i18n';
import { useStore } from '../store';
import type { Report } from '../types';
import { AccountDialog, Dialog, JoinForm } from './AccountDialog';

const ERRORS: Record<CloudError['code'], Key> = {
  'too-large': 'publish.tooLarge',
  'not-allowed': 'publish.notAllowed',
  offline: 'publish.failed',
  failed: 'publish.failed',
};

/** Sends the current state of a report to the shared archive, or takes it back out. */
export function PublishDialog({ report, onClose }: { report: Report; onClose: () => void }) {
  const t = useT();
  const user = useCloud((s) => s.user);
  const profile = useCloud((s) => s.profile);
  const existing = useCloud((s) => s.mine.find((e) => e.localId === report.id));
  const publish = useCloud((s) => s.publish);
  const unpublish = useCloud((s) => s.unpublish);
  const showToast = useStore((s) => s.showToast);
  const [visibility, setVisibility] = useState<Visibility>(existing?.visibility ?? 'everyone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!user) return <AccountDialog onClose={onClose} />;

  const allowed = !!profile && (profile.isGm || profile.isMember);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await publish(report, visibility);
      showToast(t('publish.done'));
      onClose();
    } catch (e) {
      setError(t(ERRORS[e instanceof CloudError ? e.code : 'failed']));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!existing || !window.confirm(t('archive.confirmRemove'))) return;
    setBusy(true);
    const ok = await unpublish(existing.id);
    showToast(t(ok ? 'archive.removed' : 'publish.failed'));
    if (ok) onClose();
    else setBusy(false);
  };

  return (
    <Dialog title={t('publish.title')} onClose={onClose}>
      {!profile ? (
        <p className="dialog-text">{t('app.loading')}</p>
      ) : !allowed ? (
        <div className="stack">
          <p className="dialog-text">{t('publish.needJoin')}</p>
          <JoinForm />
        </div>
      ) : (
        <div className="stack">
          <p className="dialog-text">{t('publish.snapshot')}</p>

          <fieldset className="choices">
            <legend className="field-label">{t('publish.visibility')}</legend>
            {(['everyone', 'gms'] as const).map((v) => (
              <label key={v} className={visibility === v ? 'choice on' : 'choice'}>
                <input type="radio" name="visibility" checked={visibility === v} onChange={() => setVisibility(v)} />
                <span>
                  <strong>{t(`publish.${v}` as Key)}</strong>
                  <small>{t(`publish.${v}Hint` as Key)}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <p className="dialog-text dim">{t('publish.as', { name: profile.displayName || '—' })}</p>
          {error && <p className="form-error">{error}</p>}

          <div className="dialog-actions">
            {existing && (
              <button type="button" className="btn btn-danger" disabled={busy} onClick={remove}>
                {t('archive.remove')}
              </button>
            )}
            <button type="button" className="btn btn-primary" disabled={busy} onClick={submit}>
              {busy ? t('export.working') : existing ? t('publish.update') : t('publish.submit')}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
