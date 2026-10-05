import { useEffect, useState, type FormEvent } from 'react';
import { useCloud } from '../cloud/store';
import { useT } from '../i18n';
import { useStore } from '../store';

/** Shared frame for the small dialogs: closes on Escape and on a click outside. */
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog dialog-narrow" role="dialog" aria-modal="true" aria-label={title}>
        <div className="dialog-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** First visit: a name to sign reports with and the code that lets this browser publish. */
function EnterForm() {
  const t = useT();
  const enter = useCloud((s) => s.enter);
  const showToast = useStore((s) => s.showToast);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !name.trim() || !code.trim()) return;
    setBusy(true);
    setError('');
    const result = await enter(name, code);
    // By now the dialog may already show the joined view, so the outcome goes in a toast too.
    if (result === 'ok') showToast(t('account.joined'));
    else if (result === 'bad-code') showToast(t('account.badJoin'));
    else setError(t('account.enterFailed'));
    setBusy(false);
  };

  return (
    <form className="stack" onSubmit={submit}>
      <p className="dialog-text">{t('account.why')}</p>
      <label className="field">
        <span className="field-label">{t('account.displayName')}</span>
        <input type="text" maxLength={60} autoComplete="nickname" value={name} onChange={(e) => setName(e.target.value)} />
        <span className="field-help">{t('account.displayNameHint')}</span>
      </label>
      <label className="field">
        <span className="field-label">{t('account.joinCode')}</span>
        <input type="text" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
        <span className="field-help">{t('account.joinHint')}</span>
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="dialog-actions">
        <button type="submit" className="btn btn-primary" disabled={busy || !name.trim() || !code.trim()}>
          {busy ? t('export.working') : t('account.join')}
        </button>
      </div>
    </form>
  );
}

/** Join-code entry, shown wherever a signed-in user still lacks the right to publish. */
export function JoinForm() {
  const t = useT();
  const join = useCloud((s) => s.join);
  const showToast = useStore((s) => s.showToast);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setError('');
    const ok = await join(code);
    setBusy(false);
    if (ok) showToast(t('account.joined'));
    else setError(t('account.badJoin'));
  };

  return (
    <form className="stack" onSubmit={submit}>
      <label className="field">
        <span className="field-label">{t('account.joinCode')}</span>
        <span className="field-row">
          <input type="text" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
          <button type="submit" className="btn" disabled={busy || !code.trim()}>
            {t('account.join')}
          </button>
        </span>
        <span className="field-help">{t('account.joinHint')}</span>
      </label>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}

function SignedIn({ onClose }: { onClose: () => void }) {
  const t = useT();
  const profile = useCloud((s) => s.profile);
  const rename = useCloud((s) => s.rename);
  const signOut = useCloud((s) => s.signOut);
  const showToast = useStore((s) => s.showToast);
  const [name, setName] = useState(profile?.displayName ?? '');

  // The profile arrives a moment after sign-in; fill the box when it does.
  useEffect(() => {
    if (profile) setName(profile.displayName);
  }, [profile?.displayName]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    showToast(t((await rename(name)) ? 'account.saved' : 'publish.failed'));
  };

  return (
    <div className="stack">
      <p className="dialog-text">
        {t('account.device')}
        {profile?.isGm && <span className="chip chip-accent">{t('account.gm')}</span>}
        {profile && !profile.isGm && profile.isMember && <span className="chip">{t('account.member')}</span>}
      </p>

      <form onSubmit={save}>
        <label className="field">
          <span className="field-label">{t('account.displayName')}</span>
          <span className="field-row">
            <input type="text" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
            <button type="submit" className="btn" disabled={!name.trim() || name.trim() === profile?.displayName}>
              {t('account.save')}
            </button>
          </span>
          <span className="field-help">{t('account.displayNameHint')}</span>
        </label>
      </form>

      {/* A member can still enter the GM code here to be promoted. */}
      {profile && !profile.isGm && <JoinForm />}

      <div className="dialog-actions">
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (!window.confirm(t('account.confirmForget'))) return;
            void signOut();
            onClose();
          }}
        >
          {t('account.signOut')}
        </button>
      </div>
    </div>
  );
}

export function AccountDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const user = useCloud((s) => s.user);
  return (
    <Dialog title={user ? t('account.title') : t('account.signIn')} onClose={onClose}>
      {user ? <SignedIn onClose={onClose} /> : <EnterForm />}
    </Dialog>
  );
}
