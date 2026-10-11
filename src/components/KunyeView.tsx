import { unpublishKunye } from '../cloud/kunye';
import { useCloud } from '../cloud/store';
import { useT, type T } from '../i18n';
import { kunyeDesign } from '../lib/kunye';
import { navigate } from '../router';
import { useStore } from '../store';
import type { Kunye } from '../types';
import { KunyeCard } from './KunyeCard';

/** A künye shown small, for lists. */
export function KunyeThumb({ kunye }: { kunye: Kunye }) {
  return (
    <div className="kunye-thumb" aria-hidden="true">
      <div className="kunye-thumb-box">
        <div className="kunye-thumb-inner">
          <KunyeCard kunye={kunye} />
        </div>
      </div>
    </div>
  );
}

/** Asks, then deletes, taking its published picture down too when signed in. If the picture cannot be
 *  taken down, asks again: once the künye is gone, nothing here can remove that picture any more. */
export async function removeKunye(kunye: Kunye, t: T): Promise<boolean> {
  const { user } = useCloud.getState();
  const kept = !!kunye.published && !user;
  if (!window.confirm(t(kept ? 'kunye.confirmDeleteKept' : 'kunye.confirmDelete'))) return false;
  if (kunye.published && user && !(await unpublishKunye(kunye.published.path))) {
    if (!window.confirm(t('kunye.unpublishFailed'))) return false;
  }
  useStore.getState().deleteKunye(kunye.id);
  return true;
}

const SAMPLE: Kunye = {
  id: 'sample-kunye',
  name: 'Deniz Kaya',
  title: 'Füzyon Reaktörü Teknisyeni',
  department: 'Teknik',
  org: '',
  rank: '',
  squad: '',
  origin: 'Dünya Birleşik Hükümeti (DBH)',
  cryo: 'uyanik',
  clearance: 3,
  blood: '0 Rh+',
  note: '',
  serial: 'TKN-2326-0558',
  serialManual: false,
  createdAt: 0,
  updatedAt: 0,
};

/** The künye's entry among the templates: it opens a new künye. */
export function KunyeTemplateCard() {
  const t = useT();
  const createKunye = useStore((s) => s.createKunye);
  return (
    <div className="card">
      <KunyeThumb kunye={SAMPLE} />
      <div className="card-body">
        <span className="card-title">{t('kunye.templateName')}</span>
        <span className="card-desc">{t('kunye.templateDesc')}</span>
      </div>
      <div className="card-actions">
        <button
          type="button"
          className="btn btn-small btn-primary"
          onClick={() => navigate(`/kunye/${createKunye()}`)}
        >
          {t('kunye.new')}
        </button>
      </div>
    </div>
  );
}

export function KunyeView() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const kunyeler = useStore((s) => s.kunyeler);
  const createKunye = useStore((s) => s.createKunye);
  const sorted = [...kunyeler].sort((a, b) => b.updatedAt - a.updatedAt);
  const add = () => navigate(`/kunye/${createKunye()}`);

  return (
    <main className="page">
      <div className="page-head">
        <h1>{t('kunye.title')}</h1>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={add}>
            + {t('kunye.new')}
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="empty">
          <h2>{t('kunye.emptyTitle')}</h2>
          <p>{t('kunye.emptyBody')}</p>
          <button type="button" className="btn btn-primary" onClick={add}>
            + {t('kunye.new')}
          </button>
        </div>
      ) : (
        <div className="card-grid">
          {sorted.map((k) => (
            <div key={k.id} className="card">
              <a className="card-link" href={`#/kunye/${k.id}`}>
                <KunyeThumb kunye={k} />
                <span className="card-body">
                  <span className="card-title">{k.name.trim() || t('kunye.untitled')}</span>
                  <span className="card-desc">
                    {kunyeDesign(k) === 'atlas' ? t('kunye.designAtlas') : k.department} · {k.serial}
                  </span>
                  <span className="card-meta">{new Date(k.updatedAt).toLocaleDateString(lang)}</span>
                </span>
              </a>
              <div className="card-actions">
                <button type="button" className="btn btn-small btn-danger" onClick={() => void removeKunye(k, t)}>
                  {t('common.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
