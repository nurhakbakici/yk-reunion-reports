import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { CloudError, useCloud, type ArchiveEntry, type Status } from '../cloud/store';
import { useT, type Key } from '../i18n';
import { navigate } from '../router';
import { useStore } from '../store';
import type { Report } from '../types';
import { AccountDialog } from './AccountDialog';
import { ExportButtons } from './ExportButtons';
import { PreviewPane } from './PreviewPane';

type Filter = 'all' | Status;

function classLabel(t: ReturnType<typeof useT>, classification: string): string | null {
  const known = ['acik', 'hizmete-ozel', 'gizli', 'cok-gizli'];
  return known.includes(classification) ? t(`class.${classification}` as Key) : null;
}

/** The archive belongs to whoever is signed in; without that there is nothing to show but the way in. */
function SignInPrompt() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="empty">
      <p>{t('archive.signedOut')}</p>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        {t('account.signIn')}
      </button>
      {open && <AccountDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

/** The signed-in user's own archived reports, drafts and finished ones. */
export function ArchiveView() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const ready = useCloud((s) => s.ready);
  const user = useCloud((s) => s.user);
  const list = useCloud((s) => s.list);
  const listState = useCloud((s) => s.listState);
  const refreshList = useCloud((s) => s.refreshList);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  // Another device may have saved something since this one last looked.
  useEffect(() => {
    void refreshList();
  }, [user?.id]);

  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(lang);
    return list.filter((e) => {
      if (filter !== 'all' && e.status !== filter) return false;
      if (!q) return true;
      return [e.title, e.docNo, e.templateName].some((v) => v.toLocaleLowerCase(lang).includes(q));
    });
  }, [list, query, filter, lang]);

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>{t('archive.title')}</h1>
          <p className="page-sub">{t('archive.intro')}</p>
        </div>
      </div>

      {!ready ? (
        <p className="group-empty">{t('archive.loading')}</p>
      ) : !user ? (
        <SignInPrompt />
      ) : listState === 'error' ? (
        <div className="empty">
          <p>{t('archive.loadFailed')}</p>
          <button type="button" className="btn" onClick={() => void refreshList()}>
            {t('archive.retry')}
          </button>
        </div>
      ) : listState !== 'ready' ? (
        <p className="group-empty">{t('archive.loading')}</p>
      ) : list.length === 0 ? (
        <div className="empty">
          <p>{t('archive.empty')}</p>
        </div>
      ) : (
        <>
          <div className="archive-toolbar">
            <input
              type="text"
              value={query}
              placeholder={t('archive.search')}
              aria-label={t('archive.search')}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="segmented" role="group">
              {(['all', 'draft', 'final'] as Filter[]).map((f) => (
                <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  {t(f === 'all' ? 'archive.filter.all' : (`archive.status.${f}` as Key))}
                </button>
              ))}
            </div>
          </div>

          {shown.length === 0 ? (
            <p className="group-empty">{t('archive.noMatch')}</p>
          ) : (
            <div className="archive-list">
              {shown.map((e) => (
                <ArchiveRow key={e.id} entry={e} />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}

function ArchiveRow({ entry }: { entry: ArchiveEntry }) {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const label = classLabel(t, entry.classification);
  return (
    <a className="archive-row" href={`#/archive/${entry.id}`} style={{ '--accent': entry.accent } as CSSProperties}>
      <span className="archive-row-main">
        <span className="card-title">{entry.title || t('reports.untitled')}</span>
        <span className="card-desc">
          {entry.templateName} · {entry.docNo}
        </span>
      </span>
      <span className="archive-row-chips">
        <span className={entry.status === 'final' ? 'chip chip-accent' : 'chip'}>{t(`archive.status.${entry.status}` as Key)}</span>
        {label && <span className="chip">{label}</span>}
      </span>
      <span className="archive-row-meta">
        <span>{entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString(lang) : ''}</span>
      </span>
    </a>
  );
}

/** One archived report, read-only, with the exports and the way back into the library. */
export function ArchiveReport({ id }: { id: string }) {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const fetchReport = useCloud((s) => s.fetchReport);
  const remove = useCloud((s) => s.remove);
  const ready = useCloud((s) => s.ready);
  const user = useCloud((s) => s.user);
  const restoreReport = useStore((s) => s.restoreReport);
  const showToast = useStore((s) => s.showToast);
  const [state, setState] = useState<'loading' | 'missing' | 'error' | 'ready'>('loading');
  const [loaded, setLoaded] = useState<{ entry: ArchiveEntry; report: Report } | null>(null);
  const inLibrary = useStore((s) => !!loaded && s.reports.some((r) => r.id === loaded.report.id));

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setState('loading');
    fetchReport(id)
      .then((result) => {
        if (cancelled) return;
        setLoaded(result);
        setState(result ? 'ready' : 'missing');
      })
      .catch((e) => !cancelled && setState(e instanceof CloudError ? 'error' : 'missing'));
    return () => {
      cancelled = true;
    };
  }, [id, user?.id]);

  if (ready && !user) {
    return (
      <main className="page">
        <SignInPrompt />
      </main>
    );
  }

  if (state !== 'ready' || !loaded) {
    return (
      <main className="page">
        <div className="empty">
          <p>{t(state === 'loading' ? 'archive.loading' : state === 'error' ? 'archive.loadFailed' : 'archive.notFound')}</p>
          <a className="btn" href="#/archive">
            ← {t('nav.archive')}
          </a>
        </div>
      </main>
    );
  }

  const { entry, report } = loaded;

  const restore = () => {
    if (inLibrary && !window.confirm(t('archive.confirmRestore'))) return;
    restoreReport(report);
    showToast(t('archive.restored'));
    navigate(`/report/${report.id}`);
  };

  const takeOut = async () => {
    if (!window.confirm(t('archive.confirmRemove'))) return;
    const ok = await remove(entry.id);
    showToast(t(ok ? 'archive.removed' : 'save.failed'));
    if (ok) navigate('/archive');
  };

  return (
    <main className="editor">
      <div className="editor-bar">
        <a className="back-link" href="#/archive">
          ← {t('nav.archive')}
        </a>
        <span className="editor-name">
          {entry.title || t('reports.untitled')}
          <span className="editor-docno">{new Date(entry.updatedAt).toLocaleDateString(lang)}</span>
          <span className={entry.status === 'final' ? 'chip chip-accent' : 'chip'}>{t(`archive.status.${entry.status}` as Key)}</span>
        </span>
        <div className="editor-actions">
          <ExportButtons report={report} />
          {inLibrary && (
            <a className="btn" href={`#/report/${report.id}`}>
              {t('archive.openLocal')}
            </a>
          )}
          <button type="button" className="btn" onClick={restore}>
            {t(inLibrary ? 'archive.restoreOver' : 'archive.restore')}
          </button>
          <button type="button" className="btn btn-danger" onClick={takeOut}>
            {t('archive.remove')}
          </button>
        </div>
      </div>
      <div className="editor-main viewer">
        <PreviewPane report={report} />
      </div>
    </main>
  );
}
