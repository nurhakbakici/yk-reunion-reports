import { useEffect, useState } from 'react';
import { cloudEnabled } from './cloud/config';
import { useCloud } from './cloud/store';
import { AccountDialog } from './components/AccountDialog';
import { ArchiveReport, ArchiveView } from './components/ArchiveView';
import { Emblem } from './components/Emblem';
import { ReportEditor } from './components/ReportEditor';
import { ReportsView } from './components/ReportsView';
import { TemplateEditor } from './components/TemplateEditor';
import { TemplatesView } from './components/TemplatesView';
import { useT } from './i18n';
import { useRoute } from './router';
import { useStore } from './store';

export function App() {
  const t = useT();
  const route = useRoute();
  const ready = useStore((s) => s.ready);
  const storageOk = useStore((s) => s.storageOk);
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  const toast = useStore((s) => s.toast);
  const init = useStore((s) => s.init);
  const cloudInit = useCloud((s) => s.init);
  const cloudUser = useCloud((s) => s.user);
  const [account, setAccount] = useState(false);

  useEffect(() => {
    document.documentElement.lang = lang;
    void init();
    cloudInit();
  }, []);

  const section =
    route.view === 'archive' || route.view === 'archived'
      ? 'archive'
      : route.view === 'templates' || route.view === 'template'
        ? 'templates'
        : 'reports';
  // Without an archive configured, its pages behave like any unknown address.
  const showArchive = cloudEnabled && section === 'archive';

  return (
    <>
      <header className="topbar">
        <a className="brand" href="#/reports">
          <Emblem id="ankh" size={28} />
          <span>
            {t('app.brand')}
            <small>YK: Reunion · ANKH-A</small>
          </span>
        </a>
        <nav className="nav">
          <a href="#/reports" aria-current={section === 'reports' || (section === 'archive' && !cloudEnabled) ? 'page' : undefined}>
            {t('nav.reports')}
          </a>
          <a href="#/templates" aria-current={section === 'templates' ? 'page' : undefined}>
            {t('nav.templates')}
          </a>
          {cloudEnabled && (
            <a href="#/archive" aria-current={section === 'archive' ? 'page' : undefined}>
              {t('nav.archive')}
            </a>
          )}
        </nav>
        {cloudEnabled && (
          <button type="button" className="btn btn-small account-btn" onClick={() => setAccount(true)}>
            {cloudUser ? cloudUser.name : t('account.signIn')}
          </button>
        )}
        <div className="lang" role="group" aria-label="Dil / Language">
          <button type="button" aria-pressed={lang === 'tr'} onClick={() => setLang('tr')}>
            TR
          </button>
          <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
            EN
          </button>
        </div>
      </header>

      {!storageOk && <div className="notice notice-wide">{t('app.storageWarn')}</div>}

      {!ready ? (
        <main className="page">
          <p className="group-empty">{t('app.loading')}</p>
        </main>
      ) : showArchive && route.view === 'archived' ? (
        <ArchiveReport key={route.id} id={route.id} />
      ) : showArchive ? (
        <ArchiveView />
      ) : route.view === 'report' ? (
        <ReportEditor key={route.id} id={route.id} />
      ) : route.view === 'template' ? (
        <TemplateEditor key={route.id} id={route.id} />
      ) : route.view === 'templates' ? (
        <TemplatesView />
      ) : (
        <ReportsView />
      )}

      {account && <AccountDialog onClose={() => setAccount(false)} />}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
