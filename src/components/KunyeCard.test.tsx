import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { blankKunye } from '../lib/kunye';
import type { Kunye } from '../types';
import { KunyeCard } from './KunyeCard';

const html = (patch: Partial<Kunye>) =>
  renderToStaticMarkup(<KunyeCard kunye={{ ...blankKunye(0), serial: 'TKN-2326-0558', ...patch }} />);

describe('KunyeCard', () => {
  it('draws every department in its own design, with its symbol', () => {
    const cases = [
      ['Yönetim ve Genel Hizmetler', 'yonetim'],
      ['Güvenlik', 'guvenlik'],
      ['Bilim ve Kaynak Yönetimi', 'bilim'],
      ['Teknik', 'teknik'],
      ['İnsan, Deneyim ve Kültür', 'kultur'],
    ] as const;
    for (const [department, design] of cases) {
      const out = html({ name: 'Deniz Kaya', department });
      expect(out).toContain(`data-design="${design}"`);
      expect(out).toContain(`data-symbol="${design}"`);
      expect(out).toContain('Deniz Kaya');
    }
  });

  it('writes the department in Turkish capitals', () => {
    expect(html({ department: 'İnsan, Deneyim ve Kültür' })).toContain('ANKH-A · İNSAN, DENEYİM VE KÜLTÜR');
  });

  it('leaves out the rows of empty fields', () => {
    const out = html({ name: 'Deniz Kaya' });
    expect(out).not.toContain('kunye-role');
    expect(out).not.toContain('YETKİ');
    expect(out).not.toContain('KAN ');
    expect(out).not.toContain('kunye-note');
  });

  it('shows the filled ones', () => {
    const out = html({
      name: 'Deniz Kaya',
      title: 'Teknisyen',
      origin: 'Mars Cumhuriyeti',
      cryo: 'donusumlu',
      clearance: 3,
      blood: '0 Rh+',
      note: 'Her vida yerinde',
    });
    expect(out).toContain('Teknisyen');
    expect(out).toContain('TKN-2326-0558 · MARS · DÖNÜŞÜMLÜ');
    expect(out).toContain('YETKİ ▰▰▰▱▱ 3/5 · KAN 0 RH+');
    expect(out).toContain('“Her vida yerinde”');
  });

  it('puts the embossed Atlas mark on the dog tag instead of the portrait', () => {
    const out = html({
      name: 'Deniz Kaya',
      org: 'Atlas Güvenlik Şirketi',
      rank: 'Çavuş',
      squad: 'Devil Dogs',
      portrait: 'data:image/webp;base64,AAAA',
    });
    expect(out).toContain('data-design="atlas"');
    expect(out).toContain('KAYA, DENİZ');
    expect(out).toContain('ÇAVUŞ · DEVIL DOGS');
    expect(out).toContain('kunye-atlas-mark');
    expect(out).not.toContain('<img');
  });
});
