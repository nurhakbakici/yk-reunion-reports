import type { FieldDef, FieldValue, ImageValue, SignatureValue } from '../types';

// Field values are stored loosely (reports can be imported from other people's
// files), so every read goes through one of these coercions.

export function asText(v: FieldValue | undefined): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
}

export function asNumber(v: FieldValue | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export function asRows(v: FieldValue | undefined, cols: number): string[][] {
  if (!Array.isArray(v)) return [];
  return v.map((row) => {
    const cells = Array.isArray(row) ? row.map((c) => (typeof c === 'string' ? c : '')) : [];
    while (cells.length < cols) cells.push('');
    return cells.slice(0, cols);
  });
}

/** Only pictures embedded in the report itself are shown. A remote address in a
 *  shared report would let its author see who opens it, so those are dropped. */
export function asImage(v: FieldValue | undefined): ImageValue {
  if (v && typeof v === 'object' && !Array.isArray(v) && 'src' in v) {
    const src = String(v.src ?? '');
    return { src: src.startsWith('data:image/') ? src : '', caption: String(v.caption ?? '') };
  }
  return { src: '', caption: '' };
}

export function asSignature(v: FieldValue | undefined): SignatureValue {
  if (v && typeof v === 'object' && !Array.isArray(v) && 'name' in v) {
    return { name: String(v.name ?? ''), title: String(v.title ?? '') };
  }
  return { name: '', title: '' };
}

export function listItems(v: FieldValue | undefined): string[] {
  return asText(v)
    .split('\n')
    .map((s) => s.replace(/^\s*[-•*]\s+/, '').trim())
    .filter(Boolean);
}

export function filledRows(v: FieldValue | undefined, cols: number): string[][] {
  return asRows(v, cols).filter((row) => row.some((c) => c.trim()));
}

export function isEmpty(def: FieldDef, v: FieldValue | undefined): boolean {
  switch (def.type) {
    case 'table':
      return filledRows(v, def.columns?.length ?? 0).length === 0;
    case 'scale':
      return asNumber(v) === 0;
    case 'image':
      return !asImage(v).src;
    case 'signature':
      return !asSignature(v).name.trim();
    case 'list':
      return listItems(v).length === 0;
    default:
      return !asText(v).trim();
  }
}
