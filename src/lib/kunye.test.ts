import { describe, expect, it } from 'vitest';
import type { Kunye } from '../types';
import {
  DEPARTMENT_OF,
  SIGNATURE_MAX,
  blankKunye,
  clearanceBar,
  departmentDesign,
  initials,
  isAtlas,
  kunyeBbcode,
  kunyeDesign,
  nameSize,
  newSerial,
  normalizeKunye,
  reserial,
  shortOrigin,
  storagePath,
  surnameFirst,
  upperText,
} from './kunye';

const card = (patch: Partial<Kunye> = {}): Kunye => ({
  ...blankKunye(0),
  id: 'kny-test0001',
  serial: 'YGH-2326-0417',
  ...patch,
});

describe('kunyeDesign', () => {
  it('draws each department in its own design', () => {
    expect(kunyeDesign(card({ department: 'Yönetim ve Genel Hizmetler' }))).toBe('yonetim');
    expect(kunyeDesign(card({ department: 'Güvenlik' }))).toBe('guvenlik');
    expect(kunyeDesign(card({ department: 'Bilim ve Kaynak Yönetimi' }))).toBe('bilim');
    expect(kunyeDesign(card({ department: 'Teknik' }))).toBe('teknik');
    expect(kunyeDesign(card({ department: 'İnsan, Deneyim ve Kültür' }))).toBe('kultur');
  });

  it('gives anyone in Atlas the dog tag, whatever their department', () => {
    for (const org of ['Atlas Güvenlik Şirketi', 'ATLAS Co.', 'atlas']) {
      expect(kunyeDesign(card({ department: 'Teknik', org }))).toBe('atlas');
    }
    expect(isAtlas('Yıldız Cemiyeti')).toBe(false);
  });

  it('reads older or looser department wording', () => {
    expect(departmentDesign('Güvenlik Departmanı')).toBe('guvenlik');
    expect(departmentDesign('TEKNİK DEPARTMAN')).toBe('teknik');
    expect(departmentDesign('Kültür')).toBe('kultur');
    expect(departmentDesign('Marine')).toBeNull();
    expect(kunyeDesign(card({ department: 'Marine' }))).toBe('yonetim');
  });
});

describe('serial numbers', () => {
  it('are the design prefix, the game year and four digits', () => {
    expect(newSerial('teknik', 2326, () => 0.05585)).toBe('TKN-2326-0558');
    expect(newSerial('atlas', 2326, () => 0)).toBe('ATL-2326-0000');
    expect(newSerial('kultur', 2326, () => 0.99999)).toBe('IDK-2326-9999');
    expect(newSerial('yonetim')).toMatch(/^YGH-\d{4}-\d{4}$/);
  });

  it('change prefix with the design and keep the digits', () => {
    const before = card({ department: 'Teknik', serial: 'TKN-2326-0558' });
    expect(reserial(before, { ...before, org: 'Atlas Güvenlik Şirketi' })).toBe('ATL-2326-0558');
    expect(reserial(before, { ...before, department: 'Güvenlik' })).toBe('GVN-2326-0558');
    expect(reserial(before, { ...before, title: 'Baş teknisyen' })).toBe('TKN-2326-0558');
  });

  it('stay as the player typed them', () => {
    const before = card({ department: 'Teknik', serial: 'ÖZEL-7', serialManual: true });
    expect(reserial(before, { ...before, department: 'Güvenlik' })).toBe('ÖZEL-7');
  });

  it('start over when the old number has another shape', () => {
    const before = card({ department: 'Teknik', serial: 'eski' });
    expect(reserial(before, { ...before, department: 'Güvenlik' })).toMatch(/^GVN-\d{4}-\d{4}$/);
  });
});

describe('card text', () => {
  it('puts the surname first, in Turkish capitals', () => {
    expect(surnameFirst('Deniz Kaya')).toBe('KAYA, DENİZ');
    expect(surnameFirst('ılgaz işık')).toBe('İŞIK, ILGAZ');
    expect(surnameFirst('Mehmet Ali Yılmaz')).toBe('YILMAZ, MEHMET ALİ');
    expect(surnameFirst('  Zed  ')).toBe('ZED');
    expect(surnameFirst('')).toBe('');
  });

  it('writes English words the English way', () => {
    expect(surnameFirst('Thomas Wievegg')).toBe('WIEVEGG, THOMAS');
    expect(upperText('Devil Dogs')).toBe('DEVIL DOGS');
    expect(upperText('FP (Find and Protect)')).toBe('FP (FIND AND PROTECT)');
    expect(upperText('Jurisdiction Force')).toBe('JURISDICTION FORCE');
    expect(upperText('William Smith')).toBe('WILLIAM SMITH');
  });

  it('counts other words as Turkish, and keeps capitals the player typed', () => {
    expect(upperText('Deniz Çavuş')).toBe('DENİZ ÇAVUŞ');
    expect(upperText('Kim')).toBe('KİM');
    expect(upperText('MIKE Ross')).toBe('MIKE ROSS');
  });

  it('makes initials from the first and last name', () => {
    expect(initials('deniz kaya')).toBe('DK');
    expect(initials('İsmail')).toBe('İ');
    expect(initials('')).toBe('');
  });

  it('shrinks long names in two steps', () => {
    expect(nameSize('Deniz Kaya')).toBe(1);
    expect(nameSize('Ayşegül Karaosmanoğlu')).toBe(2);
    expect(nameSize('Mehmet Ali Karaosmanoğlu Yıldırım')).toBe(3);
  });

  it('keeps one word of the origin', () => {
    expect(shortOrigin('Dünya Birleşik Hükümeti (DBH)')).toBe('DBH');
    expect(shortOrigin('Mars Cumhuriyeti')).toBe('Mars');
    expect(shortOrigin('ICU Özerkliği')).toBe('ICU');
    expect(shortOrigin('')).toBe('');
  });

  it('draws the clearance bar out of five', () => {
    expect(clearanceBar(3)).toBe('▰▰▰▱▱ 3/5');
  });
});

describe('forum signature', () => {
  it('fits the forum signature limit with a real-length address', () => {
    const path = storagePath('0f8fad5b-d9cb-469f-a165-70867728950e', 'kny-k3j9x2a1lq8z');
    const url = `https://bgaymjxpzalukzryptwu.supabase.co/storage/v1/object/public/kunye/${path}`;
    const code = kunyeBbcode(url);
    expect(code).toBe(`[url=https://ankha-reports.kulesakinleri.org/][img width=600 height=190]${url}[/img][/url]`);
    expect(code.length).toBeLessThanOrEqual(SIGNATURE_MAX);
  });
});

describe('normalizeKunye', () => {
  it('keeps a valid card as it is', () => {
    const k = card({
      name: 'Deniz Kaya',
      department: 'Teknik',
      cryo: 'kriyoda',
      clearance: 4,
      blood: 'AB Rh−',
      portrait: 'data:image/webp;base64,AAAA',
    });
    expect(normalizeKunye(JSON.parse(JSON.stringify(k)))).toEqual(k);
  });

  it('repairs what a file from someone else may get wrong', () => {
    const k = normalizeKunye({
      id: '../x',
      name: 'A'.repeat(500),
      department: 'Güvenlik Departmanı',
      cryo: 'uyuyor',
      clearance: 9,
      blood: 'Z',
      note: 'n'.repeat(200),
      portrait: 'https://evil.example/p.png',
      serial: '',
    });
    expect(k).not.toBeNull();
    expect(k!.id).toMatch(/^kny-/);
    expect(k!.name).toHaveLength(60);
    expect(k!.department).toBe(DEPARTMENT_OF.guvenlik);
    expect(k!.cryo).toBe('');
    expect(k!.clearance).toBe(5);
    expect(k!.blood).toBe('');
    expect(k!.note).toHaveLength(60);
    expect(k!.portrait).toBeUndefined();
    expect(k!.serial).toMatch(/^GVN-\d{4}-\d{4}$/);
  });

  it('drops where the card was published unless it comes from this browser', () => {
    const raw = { ...card(), published: { path: 'u/kny-test0001.png', url: 'https://x.supabase.co/a.png', at: 5 } };
    expect(normalizeKunye(raw)!.published).toBeUndefined();
    expect(normalizeKunye(raw, true)!.published).toEqual(raw.published);
  });

  it('refuses what is not a card at all', () => {
    expect(normalizeKunye(null)).toBeNull();
    expect(normalizeKunye('kunye')).toBeNull();
  });
});
