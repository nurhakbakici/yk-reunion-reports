import { describe, expect, it } from 'vitest';
import { A4, buildPdf, pdfText, type PdfPage } from './pdf';

// A real 4×6 JPEG, so the same bytes also open in a PDF reader
const JPEG = Uint8Array.from(
  atob(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAGAAQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDjKKKK+YP3I//Z',
  ),
  (c) => c.charCodeAt(0),
);
const page: PdfPage = { jpeg: JPEG, width: 4, height: 6 };

/** One character per byte, so string positions are byte offsets. */
const bytesToText = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');

describe('buildPdf', () => {
  it('is a PDF 1.4 file that ends with %%EOF', () => {
    const s = bytesToText(buildPdf([page], 'Rapor'));
    expect(s.startsWith('%PDF-1.4\n%')).toBe(true);
    expect(s.endsWith('%%EOF\n')).toBe(true);
  });

  it('points startxref and every xref entry at the right byte', () => {
    const s = bytesToText(buildPdf([page, page, page], 'Rapor'));
    const xref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(s)![1]);
    expect(s.slice(xref, xref + 5)).toBe('xref\n');
    const [, start, count] = /^xref\n(\d+) (\d+)\n/.exec(s.slice(xref))!;
    expect([Number(start), Number(count)]).toEqual([0, 3 + 3 * 3 + 1]);
    const entries = s.slice(xref).split('\n').slice(2, 2 + Number(count));
    entries.forEach((entry) => expect(entry.length).toBe(19)); // 20 bytes with the newline
    entries.slice(1).forEach((entry, i) => {
      const at = Number(entry.slice(0, 10));
      expect(s.slice(at, at + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
    expect(s).toContain(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>`);
  });

  it('has one A4 page, one JPEG image and one drawing per document page', () => {
    const s = bytesToText(buildPdf([page, page], 'Rapor'));
    expect(s.match(/\/Type \/Page /g)).toHaveLength(2);
    expect(s.match(/\/Subtype \/Image/g)).toHaveLength(2);
    expect(s.match(/\/Filter \/DCTDecode/g)).toHaveLength(2);
    expect(s).toContain('/Kids [4 0 R 7 0 R] /Count 2');
    expect(s).toContain(`/MediaBox [0 0 ${A4.width} ${A4.height}]`);
  });

  it('embeds the JPEG bytes unchanged, with their length', () => {
    const pdf = buildPdf([page], 'Rapor');
    const s = bytesToText(pdf);
    expect(s).toContain(`/Width 4 /Height 6 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${JPEG.length}`);
    const at = s.indexOf('stream\n', s.indexOf('/Subtype /Image')) + 'stream\n'.length;
    expect(Array.from(pdf.slice(at, at + JPEG.length))).toEqual(Array.from(JPEG));
    expect(s.slice(at + JPEG.length, at + JPEG.length + 10)).toBe('\nendstream');
  });

  it('fits a page of another shape inside A4, centred', () => {
    const s = bytesToText(buildPdf([{ jpeg: JPEG, width: 1000, height: 1000 }], 'Kare'));
    expect(s).toContain('595.28 0 0 595.28 0 123.31 cm');
  });

  it('keeps Turkish letters in the title', () => {
    expect(pdfText('Ğö')).toBe('<FEFF011E00F6>');
    expect(bytesToText(buildPdf([page], 'Görev'))).toContain(`/Title ${pdfText('Görev')}`);
  });

  it('refuses a document without pages', () => {
    expect(() => buildPdf([], 'Boş')).toThrow('no pages');
  });
});
