import { describe, expect, it } from 'vitest';
import type { FieldValue, Report, Template } from '../types';
import { fitMessage, inlineToBBCode, reportToBBCode, richToBBCode } from './bbcode';

function makeReport(values: Record<string, FieldValue>, extra: Partial<Report> = {}): Report {
  const template: Template = {
    id: 't',
    name: 'Görev Raporu',
    description: '',
    theme: 'konsol',
    accent: '#8DF5A8',
    issuer: 'Atlas',
    emblem: 'ankh',
    docTitle: 'Görev raporu',
    codePrefix: 'GRV',
    classification: 'gizli',
    lang: 'tr',
    updatedAt: 0,
    sections: [
      {
        id: 's1',
        title: 'Özet',
        fields: [
          { id: 'yer', type: 'text', label: 'Yer' },
          { id: 'durum', type: 'select', label: 'Durum', options: ['Açık', 'Kapalı'] },
        ],
      },
      { id: 's2', title: 'Anlatım', fields: [{ id: 'anlatim', type: 'longtext', label: 'Anlatım' }] },
      {
        id: 's3',
        title: 'Ekip',
        fields: [
          { id: 'kisiler', type: 'list', label: 'Kişiler' },
          { id: 'kayit', type: 'table', label: 'Kayıt', columns: ['Saat', 'Olay'] },
          { id: 'tehdit', type: 'scale', label: 'Tehdit', max: 5 },
        ],
      },
      { id: 's4', title: 'Boş bölüm', fields: [{ id: 'bos', type: 'text', label: 'Boş' }] },
      {
        id: 's5',
        title: 'Onay',
        fields: [
          { id: 'foto', type: 'image', label: 'Fotoğraf' },
          { id: 'imza', type: 'signature', label: 'İmza' },
        ],
      },
    ],
  };
  return {
    id: 'r',
    title: 'Kargo bölmesinde sızıntı',
    docNo: 'GRV-2326-0042',
    classification: 'gizli',
    stamp: '',
    hideEmpty: true,
    watermark: false,
    template,
    values,
    createdAt: 0,
    updatedAt: 0,
    ...extra,
  };
}

describe('inlineToBBCode', () => {
  it('carries bold and italic over', () => {
    expect(inlineToBBCode('**dikkat** ve *not*')).toBe('[b]dikkat[/b] ve [i]not[/i]');
  });
  it('hides ||words|| the way the text export does', () => {
    expect(inlineToBBCode('Ajan ||Kara Kedi|| kaçtı')).toBe('Ajan ████ ████ kaçtı');
  });
  it('leaves lone stars alone', () => {
    expect(inlineToBBCode('5 * 3')).toBe('5 * 3');
  });
});

describe('richToBBCode', () => {
  it('keeps lines and turns a run of "- " lines into one list', () => {
    expect(richToBBCode('Giriş\n- bir\n- **iki**\nSon')).toBe('Giriş\n[list][li]bir[/li][li][b]iki[/b][/li][/list]\nSon');
  });
});

describe('reportToBBCode', () => {
  const full = makeReport({
    yer: 'Kargo Bölmesi 3',
    durum: 'Açık',
    anlatim: 'Saat 04:10 civarı ||Mira Voss|| bölmeye girdi.\n- Kapı açık\n- Işıklar *sönük*',
    kisiler: '- Teğmen Aras\n- Doktor ||Lena||',
    kayit: [
      ['04:10', 'Giriş'],
      ['', ''],
      ['04:25', '**Alarm**'],
    ],
    tehdit: 3,
    foto: { src: 'data:image/png;base64,AA==', caption: 'Bölme kapısı' },
    imza: { name: 'K. Demir', title: 'Atlas' },
  });
  const out = reportToBBCode(full);

  it('opens with the document heading, subject, number, classification and issuer', () => {
    expect(out.split('\n').slice(0, 4)).toEqual([
      '[b][size=14pt]GÖREV RAPORU[/size][/b]',
      '[b]Konu:[/b] Kargo bölmesinde sızıntı',
      '[b]GRV-2326-0042[/b] · GİZLİ',
      '[i]PROJECT: REUNION · ANKH-A · Atlas[/i]',
    ]);
  });

  it('numbers the sections that have content and skips the empty one', () => {
    expect(out).toContain('[b]01 · Özet[/b]');
    expect(out).toContain('[b]04 · Onay[/b]');
    expect(out).not.toContain('Boş bölüm');
  });

  it('writes every field type', () => {
    expect(out).toContain('[b]Yer:[/b] Kargo Bölmesi 3');
    expect(out).toContain('[b]Durum:[/b] Açık');
    expect(out).toContain('Saat 04:10 civarı ████ ████ bölmeye girdi.\n[list][li]Kapı açık[/li][li]Işıklar [i]sönük[/i][/li][/list]');
    expect(out).toContain('[b]Kişiler:[/b]\n[list][li]Teğmen Aras[/li][li]Doktor ████[/li][/list]');
    expect(out).toContain('[b]Kayıt:[/b]\n[list][li]Saat: 04:10 · Olay: Giriş[/li][li]Saat: 04:25 · Olay: [b]Alarm[/b][/li][/list]');
    expect(out).toContain('[b]Tehdit:[/b] ▰▰▰▱▱ 3/5');
    expect(out).toContain('[b]Fotoğraf:[/b] [i]Bölme kapısı[/i]');
    expect(out).toContain('[b]İmza:[/b] K. Demir — Atlas');
  });

  it('never lets a hidden word through', () => {
    expect(out).not.toMatch(/Mira|Voss|Lena/);
  });

  it('a field named like its section loses its label', () => {
    expect(out).toContain('[b]02 · Anlatım[/b]\nSaat 04:10');
  });

  it('shows the stamp in « » and leaves out an unclassified banner', () => {
    const stamped = reportToBBCode(makeReport({ yer: 'X' }, { classification: 'none', stamp: 'onaylandı' }));
    expect(stamped.split('\n')[2]).toBe('[b]GRV-2326-0042[/b] · «ONAYLANDI»');
  });

  it('ends with the note about the PDF, in the document language', () => {
    expect(out.endsWith("[size=8pt][i]Ankha Rapor Terminali ile hazırlandı. Raporun tamamı ekteki PDF'te.[/i][/size]")).toBe(true);
    const english = makeReport({ yer: 'X' });
    english.template = { ...english.template, lang: 'en' };
    expect(reportToBBCode(english)).toContain('[b]Subject:[/b]');
    expect(reportToBBCode(english)).toContain('The full report is the attached PDF.');
  });
});

describe('fitMessage', () => {
  const note = '(devamı PDF’te)';
  it('leaves a short text alone', () => {
    expect(fitMessage('kısa', 100, note)).toBe('kısa');
    expect(fitMessage('sınırsız', 0, note)).toBe('sınırsız');
  });
  it('cuts at the last whole line and adds the note, within the limit', () => {
    const text = ['satır bir', 'satır iki', 'satır üç', 'satır dört'].join('\n');
    const fitted = fitMessage(text, 36, note); // 39 characters: one line too many
    expect(fitted).toBe(`satır bir\nsatır iki\n${note}`);
    expect(fitted.length).toBeLessThanOrEqual(36);
  });
  it('cuts mid-line when the first line alone is too long', () => {
    const fitted = fitMessage('x'.repeat(100), 30, note);
    expect(fitted.length).toBeLessThanOrEqual(30);
    expect(fitted.endsWith(note)).toBe(true);
  });
});
