import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { CloudError, useCloud, type ArchiveEntry } from '../cloud/store';
import { useT, type Key } from '../i18n';
import { navigate } from '../router';
import { useStore } from '../store';
import type { Report } from '../types';
import { ExportButtons } from './ExportButtons';
import { PreviewPane } from './PreviewPane';

type Filter = 'all' | 'mine' | 'gms';

function classLabel(t: ReturnType<typeof useT>, classification: string): string | null {
  const known = ['acik', 'hizmete-ozel', 'gizli', 'cok-gizli'];
  return known.includes(classification) ? t(`class.${classification}` as Key) : null;
}

/** Everything published to the shared archive that this visitor is allowed to see. */
export function ArchiveView() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const list = useCloud((s) => s.list);
  const listState = useCloud((s) => s.listState);
  const refreshList = useCloud((s) => s.refreshList);
  const user = useCloud((s) => s.user);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    void refreshList();
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(lang);
    return list.filter((e) => {
      if (filter === 'mine' && e.authorId !== user?.id) return false;
      if (filter === 'gms' && e.visibility !== 'gms') return false;
      if (!q) return true;
      return [e.title, e.authorName, e.docNo, e.templateName].some((v) => v.toLocaleLowerCase(lang).includes(q));
    });
  }, [list, query, filter, user?.id, lang]);

  const hasRestricted = list.some((e) => e.visibility === 'gms');

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>{t('archive.title')}</h1>
          <p className="page-sub">{t('archive.intro')}</p>
        </div>
      </div>

      {listState === 'error' ? (
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
            {(user || hasRestricted) && (
              <div className="segmented" role="group">
                {(['all', ...(user ? ['mine'] : []), ...(hasRestricted ? ['gms'] : [])] as Filter[]).map((f) => (
                  <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                    {t(`archive.filter.${f}` as Key)}
                  </button>
                ))}
              </div>
            )}
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
        {entry.visibility === 'gms' && <span className="chip chip-accent">{t('archive.gmOnly')}</span>}
        {label && <span className="chip">{label}</span>}
      </span>
      <span className="archive-row-meta">
        <span>{entry.authorName}</span>
        <span>{entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString(lang) : ''}</span>
      </span>
    </a>
  );
}

/** A published report, read-only, with the same exports as your own reports. */
export function ArchiveReport({ id }: { id: string }) {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const fetchReport = useCloud((s) => s.fetchReport);
  const unpublish = useCloud((s) => s.unpublish);
  const user = useCloud((s) => s.user);
  const profile = useCloud((s) => s.profile);
  const adoptReport = useStore((s) => s.adoptReport);
  const showToast = useStore((s) => s.showToast);
  const [state, setState] = useState<'loading' | 'missing' | 'error' | 'ready'>('loading');
  const [loaded, setLoaded] = useState<{ entry: ArchiveEntry; report: Report } | null>(null);

  // Load again when the login changes: a GM-only report appears once a GM signs in.
  useEffect(() => {
    let cancelled = false;
    setState((s) => (s === 'ready' ? s : 'loading'));
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
  const canRemove = !!user && (entry.authorId === user.id || profile?.isGm === true);

  const remove = async () => {
    if (!window.confirm(t('archive.confirmRemove'))) return;
    const ok = await unpublish(entry.id);
    showToast(t(ok ? 'archive.removed' : 'publish.failed'));
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
          <span className="editor-docno">
            {entry.authorName} · {new Date(entry.updatedAt).toLocaleDateString(lang)}
          </span>
          {entry.visibility === 'gms' && <span className="chip chip-accent">{t('archive.gmOnly')}</span>}
        </span>
        <div className="editor-actions">
          <ExportButtons report={report} />
          <button
            type="button"
            className="btn"
            onClick={() => {
              adoptReport(report);
              showToast(t('archive.savedCopy'));
            }}
          >
            {t('archive.saveCopy')}
          </button>
          {canRemove && (
            <button type="button" className="btn btn-danger" onClick={remove}>
              {t('archive.remove')}
            </button>
          )}
        </div>
      </div>
      <div className="editor-main viewer">
        <PreviewPane report={report} />
      </div>
    </main>
  );
}
