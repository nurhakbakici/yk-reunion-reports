import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The picture cannot be taken down (offline, or the session ran out).
vi.mock('../cloud/kunye', () => ({ unpublishKunye: vi.fn(async () => false) }));

import { useCloud } from '../cloud/store';
import { translate, type Key } from '../i18n';
import { blankKunye } from '../lib/kunye';
import { useStore } from '../store';
import type { Kunye } from '../types';
import { removeKunye } from './KunyeView';

const t = (key: Key, vars?: Record<string, string | number>) => translate('tr', key, vars);
const published = (id: string): Kunye => ({
  ...blankKunye(0),
  id,
  published: { path: `u1/${id}.png`, url: 'https://x.supabase.co/a.png', at: 1 },
});

let answers: boolean[] = [];
const asked: string[] = [];

beforeEach(() => {
  asked.length = 0;
  // Node has no window: removeKunye asks through window.confirm, and the store's toast uses its timers.
  vi.stubGlobal('window', {
    confirm: (message: string) => {
      asked.push(message);
      return answers.shift() ?? false;
    },
    setTimeout,
    clearTimeout,
  });
  useCloud.setState({ user: { id: 'u1', name: 'deneme' }, member: true });
});

afterEach(() => vi.unstubAllGlobals());

describe('removeKunye when the published picture cannot be taken down', () => {
  it('asks again, and keeps the künye if the player says no', async () => {
    const k = published('kny-del00001');
    useStore.setState({ kunyeler: [k] });
    answers = [true, false];
    expect(await removeKunye(k, t)).toBe(false);
    expect(asked).toEqual([t('kunye.confirmDelete'), t('kunye.unpublishFailed')]);
    expect(useStore.getState().kunyeler.map((x) => x.id)).toContain('kny-del00001');
  });

  it('deletes it when the player accepts that the picture stays on the forum', async () => {
    const k = published('kny-del00002');
    useStore.setState({ kunyeler: [k] });
    answers = [true, true];
    expect(await removeKunye(k, t)).toBe(true);
    expect(useStore.getState().kunyeler.map((x) => x.id)).not.toContain('kny-del00002');
  });
});
