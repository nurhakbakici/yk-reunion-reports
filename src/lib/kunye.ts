import { DEPARTMENTS } from '../lore';
import { BLOOD_TYPES, KRIYO_STATES, type DeptDesign, type KriyoState, type Kunye, type KunyeDesign } from '../types';
import { gameYear, uid } from './util';

// Rules for künyeler, the crew ID cards players use as forum signatures: which
// design a card gets, its serial number and text, and checking cards that come
// from files. Nothing here touches the page, so all of it is tested in Node.

export const KUNYE_WIDTH = 600;
export const KUNYE_HEIGHT = 190;
export const NOTE_MAX = 60;
/** Where a published künye links to from the forum. */
export const SITE_URL = 'https://ankha-reports.kulesakinleri.org/';
/** The forum's signature limit (SMF signature_settings on kulesakinleri.org). */
export const SIGNATURE_MAX = 300;

export const DEPT_DESIGNS: DeptDesign[] = ['yonetim', 'guvenlik', 'bilim', 'teknik', 'kultur'];

/** The department each design stands for, in DEPARTMENTS' own wording (same order). */
export const DEPARTMENT_OF: Record<DeptDesign, string> = {
  yonetim: DEPARTMENTS[0],
  guvenlik: DEPARTMENTS[1],
  bilim: DEPARTMENTS[2],
  teknik: DEPARTMENTS[3],
  kultur: DEPARTMENTS[4],
};

export const SERIAL_PREFIX: Record<KunyeDesign, string> = {
  yonetim: 'YGH',
  guvenlik: 'GVN',
  bilim: 'BKY',
  teknik: 'TKN',
  kultur: 'IDK',
  atlas: 'ATL',
};

/** Cryo status as the card prints it: one word, in capitals. */
export const CRYO_SHORT: Record<Exclude<KriyoState, ''>, string> = {
  uyanik: 'UYANIK',
  kriyoda: 'KRİYODA',
  donusumlu: 'DÖNÜŞÜMLÜ',
};

export const upperTr = (s: string): string => s.toLocaleUpperCase('tr');
const lowerTr = (s: string): string => s.toLocaleLowerCase('tr');

// Capitals for what the player typed. Turkish and English differ only in "i"
// (Turkish i → İ, English i → I), so each word is judged on its own: Turkish
// letters make it Turkish; one of the setting's English names, or English
// spelling, makes it English; anything else counts as Turkish. A word typed in
// capitals stays exactly as typed, which is how a player keeps "MIKE" from
// becoming "MİKE".
const TURKISH_LETTERS = /[çğıöşüÇĞİÖŞÜ]/;
const ENGLISH_SPELLING = /[qwx]|th|ck|ph|sh|ch|gh/i;
/** Words of the setting's English names (squads, organisations, units). */
const ENGLISH_WORDS = new Set([
  'devil', 'dogs', 'clash', 'corps', 'find', 'and', 'protect', 'jurisdiction', 'force',
  'eden', 'foods', 'koyash', 'corporation', 'sandstorm', 'goats', 'archive', 'company',
  'ultimi', 'cadere', 'marine', 'stellar', 'stellars', 'afterlife', 'robotics', 'engineering', 'manufacturing',
]);

export function isEnglishWord(word: string): boolean {
  if (TURKISH_LETTERS.test(word)) return false;
  return ENGLISH_WORDS.has(word.toLowerCase().replace(/[^a-z]/g, '')) || ENGLISH_SPELLING.test(word);
}

export function upperWord(word: string): string {
  return isEnglishWord(word) ? word.toUpperCase() : upperTr(word);
}

/** Capitals for text the player typed, word by word; spacing is kept. */
export function upperText(text: string): string {
  return text
    .split(/(\s+)/)
    .map((part) => (part.trim() ? upperWord(part) : part))
    .join('');
}

// Checked in this order: "Bilim ve Kaynak Yönetimi" contains "yönetim" too.
const DEPARTMENT_WORDS: [DeptDesign, string[]][] = [
  ['guvenlik', ['güvenlik']],
  ['bilim', ['bilim', 'kaynak']],
  ['teknik', ['teknik']],
  ['kultur', ['kültür', 'insan', 'deneyim']],
  ['yonetim', ['yönetim', 'genel hizmet']],
];

/** The design for a department, also for looser wording ("Güvenlik Departmanı"). Null if none fits. */
export function departmentDesign(department: string): DeptDesign | null {
  const d = lowerTr(department);
  for (const [design, words] of DEPARTMENT_WORDS) if (words.some((w) => d.includes(w))) return design;
  return null;
}

export function isAtlas(org: string): boolean {
  return lowerTr(org).includes('atlas');
}

/** Atlas soldiers get the dog tag; everyone else their department's card. */
export function kunyeDesign(k: Pick<Kunye, 'org' | 'department'>): KunyeDesign {
  return isAtlas(k.org) ? 'atlas' : (departmentDesign(k.department) ?? 'yonetim');
}

export function newSerial(design: KunyeDesign, year = gameYear(), random = Math.random): string {
  return `${SERIAL_PREFIX[design]}-${year}-${String(Math.floor(random() * 10000)).padStart(4, '0')}`;
}

/** The serial number after an edit: a new design gets its own prefix, unless the player typed the number. */
export function reserial(before: Kunye, after: Kunye): string {
  if (after.serialManual) return after.serial;
  const next = kunyeDesign(after);
  if (kunyeDesign(before) === next) return after.serial;
  const rest = /^[A-Z]{3}(-\d{4}-\d{4})$/.exec(after.serial);
  return rest ? SERIAL_PREFIX[next] + rest[1] : newSerial(next);
}

const words = (s: string): string[] => s.trim().split(/\s+/).filter(Boolean);

/** "Deniz Kaya" → "KAYA, DENİZ", as on a dog tag. The last word is taken as the surname. */
export function surnameFirst(name: string): string {
  const parts = words(name);
  if (parts.length < 2) return upperText(parts.join(''));
  const surname = parts.pop() as string;
  return `${upperText(surname)}, ${upperText(parts.join(' '))}`;
}

/** Shown in place of a portrait. */
export function initials(name: string): string {
  const parts = words(name);
  if (parts.length === 0) return '';
  return upperWord(parts[0])[0] + (parts.length > 1 ? upperWord(parts[parts.length - 1])[0] : '');
}

/** 1 = full size, 2 = smaller, 3 = smallest, on up to two lines. */
export function nameSize(name: string): 1 | 2 | 3 {
  const n = name.trim().length;
  return n <= 18 ? 1 : n <= 26 ? 2 : 3;
}

/** The card has room for one word: "Dünya Birleşik Hükümeti (DBH)" → "DBH", "Mars Cumhuriyeti" → "Mars". */
export function shortOrigin(origin: string): string {
  const o = origin.trim();
  const abbr = /\(([^)]+)\)\s*$/.exec(o);
  return abbr ? abbr[1].trim() : (words(o)[0] ?? '');
}

export function clearanceBar(n: number): string {
  return `${'▰'.repeat(n)}${'▱'.repeat(5 - n)} ${n}/5`;
}

/** What the player pastes into their forum signature. */
export function kunyeBbcode(url: string): string {
  return `[url=${SITE_URL}][img width=${KUNYE_WIDTH} height=${KUNYE_HEIGHT}]${url}[/img][/url]`;
}

/** Where a künye's picture is kept: one folder per account (supabase/schema.sql checks the first part). */
export function storagePath(userId: string, kunyeId: string): string {
  return `${userId}/${kunyeId}.png`;
}

export function blankKunye(now = Date.now()): Kunye {
  return {
    id: uid('kny-'),
    name: '',
    title: '',
    department: DEPARTMENT_OF.yonetim,
    org: '',
    rank: '',
    squad: '',
    origin: '',
    cryo: '',
    clearance: 0,
    blood: '',
    note: '',
    serial: newSerial('yonetim'),
    serialManual: false,
    createdAt: now,
    updatedAt: now,
  };
}

// --- checking cards from files -------------------------------------------------
// A künye file may come from another player, so nothing in it is trusted: unknown
// values fall back to defaults, text is cut to length, and a portrait must be a
// picture inside the file, not an address elsewhere.

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const PORTRAIT_MAX = 1_500_000;
/** Ids end up in storage paths, so only plain ones are kept. */
const SAFE_ID = /^[a-z0-9-]{1,40}$/i;

/** `keepPublished` only for this browser's own records: where a card was published belongs to the account that did it. */
export function normalizeKunye(raw: unknown, keepPublished = false): Kunye | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const design = departmentDesign(text(r.department, 80)) ?? 'yonetim';
  const org = text(r.org, 60);
  const serial = text(r.serial, 24).trim();
  const now = Date.now();
  const kunye: Kunye = {
    id: SAFE_ID.test(text(r.id, 40)) ? text(r.id, 40) : uid('kny-'),
    name: text(r.name, 60),
    title: text(r.title, 60),
    department: DEPARTMENT_OF[design],
    org,
    rank: text(r.rank, 40),
    squad: text(r.squad, 40),
    origin: text(r.origin, 60),
    cryo: KRIYO_STATES.includes(r.cryo as KriyoState) ? (r.cryo as KriyoState) : '',
    clearance:
      typeof r.clearance === 'number' && Number.isFinite(r.clearance)
        ? Math.max(0, Math.min(5, Math.round(r.clearance)))
        : 0,
    blood: BLOOD_TYPES.includes(r.blood as string) ? (r.blood as string) : '',
    note: text(r.note, NOTE_MAX),
    serial: serial || newSerial(isAtlas(org) ? 'atlas' : design),
    serialManual: r.serialManual === true && serial !== '',
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : now,
  };
  if (typeof r.portrait === 'string' && r.portrait.startsWith('data:image/') && r.portrait.length <= PORTRAIT_MAX) {
    kunye.portrait = r.portrait;
  }
  const p = r.published as Record<string, unknown> | undefined;
  if (
    keepPublished &&
    p &&
    typeof p.path === 'string' &&
    typeof p.url === 'string' &&
    p.url.startsWith('https://') &&
    typeof p.at === 'number'
  ) {
    kunye.published = { path: p.path, url: p.url, at: p.at };
  }
  return kunye;
}
