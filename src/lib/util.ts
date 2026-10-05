import { YEAR_OFFSET } from '../lore';

export function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

export function gameYear(d = new Date()): number {
  return d.getFullYear() + YEAR_OFFSET;
}

/** Today's date, 300 years on: 05.10.2326 */
export function gameDate(d = new Date()): string {
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${gameYear(d)}`;
}

export function makeDocNo(prefix: string): string {
  const serial = pad(Math.floor(Math.random() * 10000), 4);
  return `${prefix || 'DOC'}-${gameYear()}-${serial}`;
}

/** FNV-1a. Only used for decorative, stable-per-document output. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function hashHex(s: string, len = 8): string {
  let out = '';
  let seed = s;
  while (out.length < len) {
    const h = hash32(seed);
    out += h.toString(16).padStart(8, '0');
    seed = out + s;
  }
  return out.slice(0, len).toUpperCase();
}

/** Bar widths (1–4) for the decorative barcode, stable for a given string. */
export function barcode(s: string, bars = 28): number[] {
  const out: number[] = [];
  let h = hash32(s || 'x');
  for (let i = 0; i < bars; i++) {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    out.push((h % 4) + 1);
  }
  return out;
}

const TR_MAP: Record<string, string> = {
  ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u',
  Ç: 'c', Ğ: 'g', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u',
};

export function slugify(s: string): string {
  return (
    s
      .replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => TR_MAP[c])
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'rapor'
  );
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadText(text: string, filename: string, mime = 'application/json'): void {
  downloadBlob(new Blob([text], { type: mime }), filename);
}

/** Reads an image file and shrinks it so reports stay small enough to store and share. */
export function fileToDataUrl(file: File, maxSide = 1400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const src = String(reader.result);
      const img = new Image();
      img.onerror = () => reject(new Error('Image could not be read'));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const keepsAlpha = file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/svg+xml';
        if (scale === 1 && src.length < 400_000) return resolve(src);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(src);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // WebP keeps transparency at a fraction of PNG's size; browsers that
        // cannot encode it hand back a PNG instead, which is still correct.
        resolve(keepsAlpha ? canvas.toDataURL('image/webp', 0.9) : canvas.toDataURL('image/jpeg', 0.86));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
