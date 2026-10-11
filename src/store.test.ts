import { describe, expect, it } from 'vitest';
import { exportFile, useStore } from './store';

describe('importJson with künyeler', () => {
  it('takes in a file with only a künye, without where someone else published it', () => {
    const file = exportFile({
      kind: 'kunye',
      kunye: {
        id: 'kny-only0001',
        name: 'Deniz Kaya',
        department: 'Teknik',
        published: { path: 'someone/kny-only0001.png', url: 'https://x.supabase.co/a.png', at: 1 },
      },
    });
    expect(useStore.getState().importJson(file)).toBe(1);
    const k = useStore.getState().kunyeler.find((x) => x.id === 'kny-only0001');
    expect(k?.name).toBe('Deniz Kaya');
    expect(k?.published).toBeUndefined();
  });

  it('reads künyeler from a full backup and replaces the same card', () => {
    const backup = (name: string) =>
      exportFile({ kind: 'backup', reports: [], templates: [], kunyeler: [{ id: 'kny-back0001', name, department: 'Güvenlik' }] });
    useStore.getState().importJson(backup('Eski Ad'));
    useStore.getState().importJson(backup('Yeni Ad'));
    const same = useStore.getState().kunyeler.filter((x) => x.id === 'kny-back0001');
    expect(same).toHaveLength(1);
    expect(same[0].name).toBe('Yeni Ad');
  });

  it('still refuses a file with nothing usable in it', () => {
    expect(() => useStore.getState().importJson(exportFile({ kind: 'backup', kunyeler: [42, null] }))).toThrow(
      'nothing to import',
    );
  });
});
