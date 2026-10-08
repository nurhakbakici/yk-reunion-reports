import { useEffect, useState, type FormEvent } from 'react';
import { MIN_PASSWORD } from '../cloud/login';
import { useCloud, type LoginResult } from '../cloud/store';
import { useT, type Key } from '../i18n';
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

const LOGIN_ERRORS: Record<Exclude<LoginResult['code'], 'ok' | 'bad-code'>, Key> = {
  'bad-name': 'account.badName',
  'bad-login': 'account.badLogin',
  taken: 'account.taken',
  weak: 'account.weak',
  unconfirmed: 'account.unconfirmed',
  failed: 'account.failed',
};

/** Signing in, or making an account: the same form with two more fields. */
function LoginForm() {
  const t = useT();
  const signIn = useCloud((s) => s.signIn);
  const signUp = useCloud((s) => s.signUp);
  const showToast = useStore((s) => s.showToast);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const complete = name.trim() && password && (!creating || (again && code.trim()));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !complete) return;
    if (creating && password.length < MIN_PASSWORD) return setError(t('account.weak'));
    if (creating && password !== again) return setError(t('account.mismatch'));
    setBusy(true);
    setError('');
    const result = creating ? await signUp(name, password, code) : await signIn(name, password);
    // On success the dialog has already become the signed-in view, so say the rest in a toast.
    if (result.code === 'ok') {
      if (creating) showToast(t('account.created'));
    } else if (result.code === 'bad-code') {
      showToast(t('account.createdNoCode'));
    } else {
      setError(t(LOGIN_ERRORS[result.code]) + (result.detail ? ` (${result.detail})` : ''));
    }
    setBusy(false);
  };

  return (
    <form className="stack" onSubmit={submit}>
      <div className="segmented" role="group">
        <button type="button" aria-pressed={!creating} onClick={() => (setCreating(false), setError(''))}>
          {t('account.signIn')}
        </button>
        <button type="button" aria-pressed={creating} onClick={() => (setCreating(true), setError(''))}>
          {t('account.create')}
        </button>
      </div>
      <p className="dialog-text">{t(creating ? 'account.whyCreate' : 'account.why')}</p>
      <label className="field">
        <span className="field-label">{t('account.name')}</span>
        <input type="text" maxLength={40} autoComplete="username" value={name} onChange={(e) => setName(e.target.value)} />
        {creating && <span className="field-help">{t('account.nameHint')}</span>}
      </label>
      <label className="field">
        <span className="field-label">{t('account.password')}</span>
        <input
          type="password"
          autoComplete={creating ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {creating && (
        <>
          <label className="field">
            <span className="field-label">{t('account.passwordAgain')}</span>
            <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
            <span className="field-help">{t('account.passwordHint')}</span>
          </label>
          <label className="field">
            <span className="field-label">{t('account.joinCode')}</span>
            <input type="text" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
            <span className="field-help">{t('account.joinHint')}</span>
          </label>
        </>
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="dialog-actions">
        <button type="submit" className="btn btn-primary" disabled={busy || !complete}>
          {busy ? t('export.working') : t(creating ? 'account.create' : 'account.signIn')}
        </button>
      </div>
    </form>
  );
}

/** Campaign-code entry, shown wherever a signed-in user still lacks the right to save. */
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

function PasswordForm() {
  const t = useT();
  const changePassword = useCloud((s) => s.changePassword);
  const showToast = useStore((s) => s.showToast);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !password) return;
    if (password.length < MIN_PASSWORD) return setError(t('account.weak'));
    setBusy(true);
    setError('');
    const ok = await changePassword(password);
    setBusy(false);
    if (!ok) return setError(t('account.failed'));
    setPassword('');
    showToast(t('account.passwordChanged'));
  };

  return (
    <form className="stack" onSubmit={submit}>
      <label className="field">
        <span className="field-label">{t('account.newPassword')}</span>
        <span className="field-row">
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="btn" disabled={busy || !password}>
            {t('account.change')}
          </button>
        </span>
      </label>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}

function SignedIn({ onClose }: { onClose: () => void }) {
  const t = useT();
  const user = useCloud((s) => s.user);
  const member = useCloud((s) => s.member);
  const signOut = useCloud((s) => s.signOut);

  return (
    <div className="stack">
      <p className="dialog-text">
        {t('account.signedInAs', { name: user?.name ?? '' })}
        {member && <span className="chip">{t('account.member')}</span>}
      </p>

      {member === false && (
        <>
          <p className="dialog-text">{t('save.needJoin')}</p>
          <JoinForm />
        </>
      )}

      <PasswordForm />

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
    <Dialog title={t('account.title')} onClose={onClose}>
      {user ? <SignedIn onClose={onClose} /> : <LoginForm />}
    </Dialog>
  );
}
