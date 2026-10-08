import { describe, expect, it } from 'vitest';
import {
  BOARDS_URL,
  FORUM_ORIGIN,
  HANDOFF_TIMEOUT_MS,
  createHandoff,
  defaultBoard,
  fetchBoards,
  fitFiles,
  forumFileName,
  parseBoards,
  postUrl,
  type ForumReport,
  type HandoffStatus,
} from './forum';

// What site/reunion-bolumler.php returns (Kule theme repo)
const ANSWER = {
  bolumler: [
    { id: 244, ad: 'Duyurular' },
    { id: 247, ad: 'Umuma Mahsus Raporlar' },
    { id: 248, ad: 'Hizmete Mahsus Raporlar' },
  ],
  varsayilan: { acik: 247, diger: 248 },
  sinirlar: { ileti: 20000, dosya_kb: 30720, ileti_kb: 32768, dosya_sayisi: 10 },
};

describe('the board list', () => {
  it('reads the endpoint answer', () => {
    expect(parseBoards(ANSWER)).toEqual(ANSWER);
  });

  it('refuses anything else', () => {
    expect(parseBoards(null)).toBeNull();
    expect(parseBoards('<!DOCTYPE html>')).toBeNull();
    expect(parseBoards({ bolumler: [], hata: 'forum' })).toBeNull();
    expect(parseBoards({ ...ANSWER, bolumler: [{ id: '244', ad: 'Duyurular' }] })).toBeNull();
    expect(parseBoards({ ...ANSWER, sinirlar: { ...ANSWER.sinirlar, ileti: -1 } })).toBeNull();
    expect(parseBoards({ ...ANSWER, varsayilan: undefined })).toBeNull();
  });

  it('asks the forum without cookies and gives null on an error page or a hang', async () => {
    let asked: [string, RequestInit | undefined] | null = null;
    const ok = (async (url: string, init?: RequestInit) => {
      asked = [url, init];
      return new Response(' ' + JSON.stringify(ANSWER)); // the endpoint starts with a space
    }) as unknown as typeof fetch;
    expect(await fetchBoards(ok)).toEqual(ANSWER);
    expect(asked![0]).toBe(BOARDS_URL);
    expect(asked![1]?.credentials).toBe('omit');

    const page = (async () => new Response('<!DOCTYPE html><title>Connection Problems</title>')) as unknown as typeof fetch;
    expect(await fetchBoards(page)).toBeNull();
    const down = (async () => new Response('', { status: 503 })) as unknown as typeof fetch;
    expect(await fetchBoards(down)).toBeNull();
    const hang = ((_: string, init?: RequestInit) =>
      new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))) as unknown as typeof fetch;
    expect(await fetchBoards(hang, 20)).toBeNull();
  });

  it('picks the open board for open reports and the other for classified ones', () => {
    const boards = parseBoards(ANSWER)!;
    expect(defaultBoard(boards, 'none')).toBe(247);
    expect(defaultBoard(boards, 'acik')).toBe(247);
    expect(defaultBoard(boards, 'hizmete-ozel')).toBe(248);
    expect(defaultBoard(boards, 'cok-gizli')).toBe(248);
    expect(defaultBoard({ ...boards, varsayilan: { acik: 999, diger: 248 } }, 'acik')).toBe(244);
  });

  it('builds the New Topic address of a board', () => {
    expect(postUrl(248)).toBe('https://kulesakinleri.org/forum/index.php?action=post;board=248.0');
  });
});

describe('fitFiles', () => {
  const kb = (n: number, tur: 'application/pdf' | 'image/png' = 'application/pdf') => ({
    ad: tur === 'application/pdf' ? 'r.pdf' : 'r-onizleme.png',
    tur,
    veri: new Blob([new Uint8Array(n * 1024)], { type: tur }),
  });
  const limits = (dosya_kb: number, ileti_kb: number, dosya_sayisi: number) => ({ ileti: 20000, dosya_kb, ileti_kb, dosya_sayisi });

  it('keeps both when they fit', () => {
    expect(fitFiles([kb(100), kb(20, 'image/png')], limits(30720, 32768, 10))).toHaveLength(2);
  });
  it('drops a file over the per-file limit', () => {
    expect(fitFiles([kb(200), kb(20, 'image/png')], limits(100, 0, 0)).map((f) => f.tur)).toEqual(['image/png']);
  });
  it('drops the preview, not the PDF, when the post total is too small for both', () => {
    expect(fitFiles([kb(90), kb(20, 'image/png')], limits(0, 100, 0)).map((f) => f.tur)).toEqual(['application/pdf']);
  });
  it('keeps the PDF first when only one file is allowed', () => {
    expect(fitFiles([kb(10), kb(10, 'image/png')], limits(0, 0, 1)).map((f) => f.tur)).toEqual(['application/pdf']);
  });
  it('treats 0 as no limit', () => {
    expect(fitFiles([kb(5000), kb(5000, 'image/png')], limits(0, 0, 0))).toHaveLength(2);
  });
});

describe('forumFileName', () => {
  it('keeps only what the forum accepts', () => {
    expect(forumFileName('GRV-2326-0042', '', 'pdf')).toBe('GRV-2326-0042.pdf');
    expect(forumFileName('GRV-2326-0042 Kargo sızıntısı', '-onizleme', 'png')).toBe('GRV-2326-0042-Kargo-sizintisi-onizleme.png');
    expect(forumFileName('ÇĞİÖŞÜ/../x', '', 'pdf')).toBe('CGIOSU-..-x.pdf');
    expect(forumFileName('', '', 'pdf')).toBe('rapor.pdf');
    expect(forumFileName('x'.repeat(200), '', 'pdf')).toMatch(/^x{76}\.pdf$/);
  });
});

describe('createHandoff', () => {
  const report: ForumReport = { kaynak: 'ankha', tur: 'rapor', surum: 1, konu: 'Konu', metin: 'Metin', dosyalar: [] };

  function setup() {
    const sent: [unknown, string][] = [];
    const statuses: HandoffStatus['tur'][] = [];
    const tab = { postMessage: (m: unknown, o: string) => sent.push([m, o]) };
    let clock = 0;
    const handoff = createHandoff(tab, (s) => statuses.push(s.tur), () => clock);
    const from = (data: unknown, origin = FORUM_ORIGIN, source: unknown = tab) => handoff.receive({ origin, source, data });
    return { sent, statuses, tab, handoff, from, advance: (ms: number) => (clock += ms) };
  }
  const forum = (tur: string, extra: object = {}) => ({ kaynak: 'kule-forum', tur, surum: 1, ...extra });

  it('waits for the tab, then sends the report to the forum origin only', () => {
    const { sent, statuses, handoff, from } = setup();
    handoff.setReport(report);
    expect(sent).toEqual([]);
    from(forum('hazir'));
    expect(sent).toEqual([[report, FORUM_ORIGIN]]);
    expect(statuses).toEqual(['bekliyor', 'gonderildi']);
  });

  it('sends as soon as the report is ready when the tab was first', () => {
    const { sent, handoff, from } = setup();
    from(forum('hazir'));
    expect(sent).toEqual([]);
    handoff.setReport(report);
    expect(sent).toHaveLength(1);
  });

  it('sends again after the forum reloads (login), and stops once the tab has it', () => {
    const { sent, statuses, handoff, from } = setup();
    handoff.setReport(report);
    from(forum('hazir'));
    from(forum('hazir'));
    expect(sent).toHaveLength(2);
    from(forum('alindi', { eklenen: 2 }));
    from(forum('hazir'));
    expect(sent).toHaveLength(2);
    expect(statuses.at(-1)).toBe('alindi');
    expect(handoff.done).toBe(true);
  });

  it('ignores other origins, other windows and other messages', () => {
    const { sent, handoff, from } = setup();
    handoff.setReport(report);
    from(forum('hazir'), 'https://evil.example');
    from(forum('hazir'), 'http://kulesakinleri.org');
    from(forum('hazir'), FORUM_ORIGIN, {});
    from({ kaynak: 'baska', tur: 'hazir', surum: 1 });
    from(forum('hazir', { surum: 2 }));
    from('hazir');
    expect(sent).toEqual([]);
  });

  it('reports what the tab did with the files', () => {
    const got: HandoffStatus[] = [];
    const tab = { postMessage: () => {} };
    const handoff = createHandoff(tab, (s) => got.push(s), () => 0);
    handoff.receive({ origin: FORUM_ORIGIN, source: tab, data: forum('alindi', { eklenen: 0, ek: 'izin-yok' }) });
    expect(got.at(-1)).toEqual({ tur: 'alindi', eklenen: 0, ekIzniYok: true });

    const got2: HandoffStatus[] = [];
    const h2 = createHandoff(tab, (s) => got2.push(s), () => 0);
    h2.receive({ origin: FORUM_ORIGIN, source: tab, data: forum('hata', { neden: 'form-dolu' }) });
    expect(got2.at(-1)).toEqual({ tur: 'hata', neden: 'form-dolu' });
  });

  it('times out once, two minutes after it started, unless the tab answered', () => {
    const { statuses, handoff, advance } = setup();
    advance(HANDOFF_TIMEOUT_MS - 1);
    handoff.tick();
    expect(statuses).toEqual(['bekliyor']);
    advance(1);
    handoff.tick();
    handoff.tick();
    expect(statuses).toEqual(['bekliyor', 'zaman-asimi']);

    const answered = setup();
    answered.from(forum('alindi'));
    answered.advance(HANDOFF_TIMEOUT_MS * 2);
    answered.handoff.tick();
    expect(answered.statuses).toEqual(['bekliyor', 'alindi']);
  });
});
