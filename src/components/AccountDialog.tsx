import { useEffect, useState, type FormEvent } from 'react';
import { DISCORD_LOGIN } from '../cloud/config';
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

function SignInForm() {
  const t = useT();
  const sendLink = useCloud((s) => s.sendLink);
  const verifyCode = useCloud((s) => s.verifyCode);
  const signInWithDiscord = useCloud((s) => s.signInWithDiscord);
  const linkError = useCloud((s) => s.linkError);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true);
    setError('');
    const ok = await sendLink(email);
    setBusy(false);
    if (ok) setSentTo(email.trim());
    else setError(t('account.sendFailed'));
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setError('');
    const ok = await verifyCode(sentTo, code);
    setBusy(false);
    // On success the dialog re-renders as the signed-in view by itself.
    if (!ok) setError(t('account.badCode'));
  };

  if (sentTo) {
    return (
      <form className="stack" onSubmit={verify}>
        <p className="dialog-text">{t('account.sent', { email: sentTo })}</p>
        <label className="field">
          <span className="field-label">{t('account.code')}</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={() => setSentTo('')}>
            {t('account.otherEmail')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !code.trim()}>
            {t('account.verify')}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className="stack" onSubmit={send}>
      <p className="dialog-text">{t('account.why')}</p>
      {linkError && <p className="form-error">{t('account.linkFailed')}</p>}
      <label className="field">
        <span className="field-label">{t('account.email')}</span>
        <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="dialog-actions">
        {DISCORD_LOGIN && (
          <button type="button" className="btn" onClick={() => void signInWithDiscord()}>
            {t('account.discord')}
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy || !email.trim()}>
          {busy ? t('export.working') : t('account.sendLink')}
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
  const user = useCloud((s) => s.user);
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
        {t('account.signedInAs', { email: user?.email ?? '' })}
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

      {profile && !profile.isGm && !profile.isMember && <JoinForm />}

      <div className="dialog-actions">
        <button
          type="button"
          className="btn"
          onClick={() => {
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
      {user ? <SignedIn onClose={onClose} /> : <SignInForm />}
    </Dialog>
  );
}
