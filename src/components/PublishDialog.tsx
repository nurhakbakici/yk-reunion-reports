import { useState } from 'react';
import { PublishError, publishKunye, type PublishErrorCode } from '../cloud/kunye';
import { useCloud } from '../cloud/store';
import { useT, type Key } from '../i18n';
import { copyText } from '../lib/exporters';
import { SIGNATURE_URL } from '../lib/forum';
import { kunyeBbcode, storagePath } from '../lib/kunye';
import { useStore } from '../store';
import type { Kunye } from '../types';
import { AccountDialog, Dialog, JoinForm } from './AccountDialog';

const ERRORS: Record<PublishErrorCode, Key> = {
  'not-ready': 'publish.notReady',
  'not-allowed': 'publish.notAllowed',
  'too-large': 'publish.tooLarge',
  offline: 'publish.offline',
  failed: 'publish.failed',
};

/** Uploads the künye as a public picture and hands over the BBCode for the forum signature. */
export function PublishDialog({
  kunye,
  makePng,
  onClose,
}: {
  kunye: Kunye;
  makePng: () => Promise<Blob>;
  onClose: () => void;
}) {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const patchKunye = useStore((s) => s.patchKunye);
  const showToast = useStore((s) => s.showToast);
  const user = useCloud((s) => s.user);
  const member = useCloud((s) => s.member);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!user) return <AccountDialog onClose={onClose} />;

  const publish = async () => {
    setBusy(true);
    setError('');
    try {
      const path = storagePath(user.id, kunye.id);
      const url = await publishKunye(path, await makePng());
      patchKunye(kunye.id, { published: { path, url, at: Date.now() } });
    } catch (e) {
      setError(t(ERRORS[e instanceof PublishError ? e.code : 'failed']));
    } finally {
      setBusy(false);
    }
  };

  const code = kunye.published ? kunyeBbcode(kunye.published.url) : '';

  const copy = async () => {
    try {
      await copyText(code);
      showToast(t('publish.copied'));
    } catch {
      showToast(t('toast.clipboardFailed'));
    }
  };

  return (
    <Dialog title={t('publish.title')} onClose={onClose}>
      {member === null ? (
        <p className="dialog-text">{t('app.loading')}</p>
      ) : !member ? (
        <div className="stack">
          <p className="dialog-text">{t('publish.needJoin')}</p>
          <JoinForm />
        </div>
      ) : !kunye.name.trim() ? (
        <p className="dialog-text">{t('publish.needName')}</p>
      ) : (
        <div className="stack">
          <p className="dialog-text">{t('publish.intro')}</p>
          {kunye.published && (
            <>
              <label className="field">
                <span className="field-label">{t('publish.code')}</span>
                <textarea readOnly rows={3} value={code} onFocus={(e) => e.currentTarget.select()} />
              </label>
              <p className="dialog-text dim">{t('publish.hint')}</p>
              <p className="dialog-text dim">
                {t('publish.last', { date: new Date(kunye.published.at).toLocaleString(lang) })}
              </p>
            </>
          )}
          {error && <p className="form-error">{error}</p>}
          <div className="dialog-actions">
            {kunye.published && (
              <>
                <a className="btn" href={SIGNATURE_URL} target="_blank" rel="noopener">
                  {t('publish.openForum')}
                </a>
                <button type="button" className="btn" onClick={copy}>
                  {t('publish.copy')}
                </button>
              </>
            )}
            <button type="button" className="btn btn-primary" disabled={busy} onClick={publish}>
              {busy ? t('publish.working') : kunye.published ? t('kunye.republish') : t('publish.submit')}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
