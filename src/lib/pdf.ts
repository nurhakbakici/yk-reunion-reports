// A small PDF writer: each page of the document, drawn as a JPEG, fills one A4 sheet.
// No library: a picture-only PDF needs a handful of objects, and the pages are already images
// (documentToPngs). Text in it cannot be selected; the hidden (||…||) words are not in the images.

/** One page as a JPEG, with its size in pixels. */
export interface PdfPage {
  jpeg: Uint8Array;
  width: number;
  height: number;
}

/** A4 in PDF points (1/72 inch). */
export const A4 = { width: 595.28, height: 841.89 };

const PRODUCER = 'Ankha Rapor Terminali';

const ascii = (s: string): Uint8Array => new TextEncoder().encode(s);

/** A PDF text string that keeps Turkish letters: UTF-16BE with a byte-order mark, written in hex. */
export function pdfText(s: string): string {
  let hex = 'FEFF';
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0');
  return `<${hex}>`;
}

/** The page image scaled to fit A4 and centred, as a content stream. */
function placement(page: PdfPage): string {
  const scale = Math.min(A4.width / page.width, A4.height / page.height);
  const w = +(page.width * scale).toFixed(2);
  const h = +(page.height * scale).toFixed(2);
  const x = +((A4.width - w) / 2).toFixed(2);
  const y = +((A4.height - h) / 2).toFixed(2);
  return `q\n${w} 0 0 ${h} ${x} ${y} cm\n/Im0 Do\nQ\n`;
}

/** The whole PDF file. Objects: 1 catalog, 2 page tree, 3 info, then page, image and contents for each page. */
export function buildPdf(pages: PdfPage[], title: string): Uint8Array<ArrayBuffer> {
  if (pages.length === 0) throw new Error('no pages');
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: Uint8Array | string) => {
    const bytes = typeof part === 'string' ? ascii(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: string) => {
    offsets[id] = length;
    push(`${id} 0 obj\n${body}\nendobj\n`);
  };

  // The second line's bytes above 127 tell file tools that the file holds binary data.
  push(Uint8Array.from([...ascii('%PDF-1.4\n'), 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const first = 4;
  const kids = pages.map((_, i) => `${first + i * 3} 0 R`).join(' ');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  object(3, `<< /Title ${pdfText(title)} /Producer ${pdfText(PRODUCER)} >>`);

  pages.forEach((page, i) => {
    const pageId = first + i * 3;
    const imageId = pageId + 1;
    const contentsId = pageId + 2;
    const contents = placement(page);
    object(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.width} ${A4.height}] ` +
        `/Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentsId} 0 R >>`,
    );
    offsets[imageId] = length;
    push(
      `${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
    );
    push(page.jpeg);
    push('\nendstream\nendobj\n');
    object(contentsId, `<< /Length ${contents.length} >>\nstream\n${contents}endstream`);
  });

  const count = first + pages.length * 3;
  const xref = length;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id++) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/** A PNG page (from documentToPngs) as a JPEG on white, scaled by `scale`. Browser only. */
export async function pngToPdfPage(png: Blob, scale: number, quality = 0.85): Promise<PdfPage> {
  const bitmap = await createImageBitmap(png);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no canvas');
  // JPEG has no transparency: a transparent corner would turn black without the white underlay.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('empty image'))), 'image/jpeg', quality),
  );
  return { jpeg: new Uint8Array(await blob.arrayBuffer()), width, height };
}

/** The pages as one PDF. `scale` 1 keeps the export's 2× pixels; 0.5 halves them for a smaller file. */
export async function pagesToPdf(pngs: Blob[], title: string, scale = 1): Promise<Blob> {
  const pages: PdfPage[] = [];
  // One at a time, like documentToPngs: large pictures add up on a phone.
  for (const png of pngs) pages.push(await pngToPdfPage(png, scale));
  return new Blob([buildPdf(pages, title)], { type: 'application/pdf' });
}

/** A smaller PNG of one page, for the forum preview. Browser only. */
export async function scalePng(png: Blob, scale: number): Promise<Blob> {
  const bitmap = await createImageBitmap(png);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no canvas');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('empty image'))), 'image/png'),
  );
}
