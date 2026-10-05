import { create } from 'zustand';
import * as db from './db';
import { clone, makeDocNo, uid, gameDate } from './lib/util';
import { BUILTIN_TEMPLATES, blankTemplate } from './templates/builtin';
import {
  CLASSIFICATIONS,
  EMBLEMS,
  FIELD_TYPES,
  FIELD_WIDTHS,
  LORE_SOURCES,
  THEMES,
  type FieldDef,
  type FieldValue,
  type Lang,
  type Report,
  type SectionDef,
  type Template,
} from './types';

const LANG_KEY = 'yk-reunion-reports.lang';
export const FILE_APP = 'yk-reunion-reports';

function loadLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'tr';
  } catch {
    return 'tr';
  }
}

// --- import validation -------------------------------------------------------
// Files come from other players, so nothing in them is trusted to have the
// right shape; anything unusable falls back to a default instead of crashing
// the editor later.

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;
const strList = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined;

function normalizeField(raw: unknown, fallbackId: string): FieldDef | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const field: FieldDef = {
    id: str(r.id) || fallbackId,
    type: oneOf(r.type, FIELD_TYPES, 'text'),
    label: str(r.label),
    width: oneOf(r.width, FIELD_WIDTHS, 'full'),
  };
  if (typeof r.placeholder === 'string') field.placeholder = r.placeholder;
  const options = strList(r.options);
  if (options) field.options = options;
  const columns = strList(r.columns);
  if (columns) field.columns = columns;
  if (LORE_SOURCES.includes(r.source as never)) field.source = r.source as FieldDef['source'];
  if (typeof r.max === 'number' && r.max >= 1) field.max = Math.min(20, Math.round(r.max));
  return field;
}

export function normalizeTemplate(raw: unknown): Template | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.sections)) return null;
  const sections: SectionDef[] = r.sections
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    .map((s, si) => ({
      id: str(s.id) || `s${si}`,
      title: str(s.title),
      fields: (Array.isArray(s.fields) ? s.fields : [])
        .map((fd, fi) => normalizeField(fd, `s${si}f${fi}`))
        .filter((fd): fd is FieldDef => fd !== null),
    }));
  const logo = str(r.logo);
  return {
    id: str(r.id) || uid('tpl-'),
    name: str(r.name, 'Şablon'),
    description: str(r.description),
    theme: oneOf(r.theme, THEMES, 'konsol'),
    accent: /^#[0-9a-f]{6}$/i.test(str(r.accent)) ? str(r.accent) : '#3fd0c9',
    issuer: str(r.issuer),
    emblem: oneOf(r.emblem, EMBLEMS, 'ankh'),
    ...(logo.startsWith('data:image/') ? { logo } : {}),
    docTitle: str(r.docTitle, str(r.name)),
    codePrefix: str(r.codePrefix, 'DOC'),
    classification: oneOf(r.classification, CLASSIFICATIONS, 'none'),
    lang: oneOf(r.lang, ['tr', 'en'] as const, 'tr'),
    sections,
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : Date.now(),
  };
}

export function normalizeReport(raw: unknown): Report | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const template = normalizeTemplate(r.template);
  if (!template) return null;
  // Keep the built-in marker on the snapshot so the "template changed" check
  // can still find the template the report came from.
  if ((r.template as Record<string, unknown>).builtin === true) template.builtin = true;
  const now = Date.now();
  return {
    id: str(r.id) || uid('rep-'),
    title: str(r.title),
    docNo: str(r.docNo),
    classification: oneOf(r.classification, CLASSIFICATIONS, 'none'),
    stamp: str(r.stamp),
    hideEmpty: r.hideEmpty === true,
    template,
    values: r.values && typeof r.values === 'object' ? (r.values as Record<string, FieldValue>) : {},
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : now,
  };
}

// --- store ------------------------------------------------------------------

interface State {
  ready: boolean;
  storageOk: boolean;
  lang: Lang;
  reports: Report[];
  /** User-made templates. Built-in ones are added by allTemplates(). */
  templates: Template[];
  toast: string | null;

  init: () => Promise<void>;
  setLang: (lang: Lang) => void;
  showToast: (message: string) => void;

  createReport: (template: Template) => string;
  patchReport: (id: string, patch: Partial<Omit<Report, 'id'>>) => void;
  setValue: (id: string, fieldId: string, value: FieldValue) => void;
  duplicateReport: (id: string, suffix: string) => string | null;
  deleteReport: (id: string) => void;
  /** Adds someone else's report to the library as a new report of your own. */
  adoptReport: (report: Report) => string;

  createTemplate: (from: Template | null, name: string) => string;
  patchTemplate: (id: string, patch: Partial<Omit<Template, 'id'>>) => void;
  deleteTemplate: (id: string) => void;

  importJson: (text: string) => number;
}

const timers = new Map<string, number>();

/** Typing fires a change per keystroke; write each record at most every 300 ms. */
function persistSoon(store: db.StoreName, id: string) {
  const key = `${store}:${id}`;
  window.clearTimeout(timers.get(key));
  timers.set(
    key,
    window.setTimeout(() => {
      timers.delete(key);
      const state = useStore.getState();
      const record = (store === 'reports' ? state.reports : state.templates).find((r) => r.id === id);
      if (record) void db.put(store, record);
    }, 300),
  );
}

let toastTimer = 0;

export const useStore = create<State>((set, get) => ({
  ready: false,
  storageOk: true,
  lang: loadLang(),
  reports: [],
  templates: [],
  toast: null,

  async init() {
    const { reports, templates, ok } = await db.loadAll();
    set({
      reports: reports.map(normalizeReport).filter((r): r is Report => r !== null),
      templates: templates.map(normalizeTemplate).filter((t): t is Template => t !== null),
      storageOk: ok,
      ready: true,
    });
  },

  setLang(lang) {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* the choice just won't be remembered */
    }
    document.documentElement.lang = lang;
    set({ lang });
  },

  showToast(message) {
    window.clearTimeout(toastTimer);
    set({ toast: message });
    toastTimer = window.setTimeout(() => set({ toast: null }), 3200);
  },

  createReport(template) {
    const now = Date.now();
    const values: Record<string, FieldValue> = {};
    // Pre-fill the first date field with today's in-game date.
    const firstDate = template.sections.flatMap((s) => s.fields).find((fd) => fd.type === 'date');
    if (firstDate) values[firstDate.id] = gameDate();
    const report: Report = {
      id: uid('rep-'),
      title: '',
      docNo: makeDocNo(template.codePrefix),
      classification: template.classification,
      stamp: '',
      hideEmpty: false,
      template: clone(template),
      values,
      createdAt: now,
      updatedAt: now,
    };
    set({ reports: [report, ...get().reports] });
    void db.put('reports', report);
    return report.id;
  },

  patchReport(id, patch) {
    set({
      reports: get().reports.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: Date.now() } : r)),
    });
    persistSoon('reports', id);
  },

  setValue(id, fieldId, value) {
    set({
      reports: get().reports.map((r) =>
        r.id === id ? { ...r, values: { ...r.values, [fieldId]: value }, updatedAt: Date.now() } : r,
      ),
    });
    persistSoon('reports', id);
  },

  duplicateReport(id, suffix) {
    const source = get().reports.find((r) => r.id === id);
    if (!source) return null;
    const now = Date.now();
    const copy: Report = {
      ...clone(source),
      id: uid('rep-'),
      title: source.title ? `${source.title} ${suffix}` : '',
      docNo: makeDocNo(source.template.codePrefix),
      createdAt: now,
      updatedAt: now,
    };
    set({ reports: [copy, ...get().reports] });
    void db.put('reports', copy);
    return copy.id;
  },

  deleteReport(id) {
    set({ reports: get().reports.filter((r) => r.id !== id) });
    void db.del('reports', id);
  },

  adoptReport(report) {
    const now = Date.now();
    const copy: Report = { ...clone(report), id: uid('rep-'), createdAt: now, updatedAt: now };
    set({ reports: [copy, ...get().reports] });
    void db.put('reports', copy);
    return copy.id;
  },

  createTemplate(from, name) {
    const id = uid('tpl-');
    const template: Template = from
      ? { ...clone(from), id, name, updatedAt: Date.now() }
      : blankTemplate(id, name, get().lang);
    delete template.builtin;
    set({ templates: [...get().templates, template] });
    void db.put('templates', template);
    return id;
  },

  patchTemplate(id, patch) {
    set({
      templates: get().templates.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t)),
    });
    persistSoon('templates', id);
  },

  deleteTemplate(id) {
    set({ templates: get().templates.filter((t) => t.id !== id) });
    void db.del('templates', id);
  },

  /** Accepts a report file, a template file or a full backup. Returns how many
   *  records were taken in; throws if the file is none of those. */
  importJson(text) {
    const data = JSON.parse(text) as Record<string, unknown>;
    if (!data || typeof data !== 'object' || data.app !== FILE_APP) throw new Error('unrecognised file');

    const rawReports = [...(Array.isArray(data.reports) ? data.reports : []), ...(data.report ? [data.report] : [])];
    const rawTemplates = [
      ...(Array.isArray(data.templates) ? data.templates : []),
      ...(data.template ? [data.template] : []),
    ];
    const reports = rawReports.map(normalizeReport).filter((r): r is Report => r !== null);
    const templates = rawTemplates
      .map(normalizeTemplate)
      .filter((t): t is Template => t !== null)
      // A shared copy of a built-in must not shadow the real one.
      .map((t) => (BUILTIN_TEMPLATES.some((b) => b.id === t.id) ? { ...t, id: uid('tpl-') } : t));
    if (reports.length + templates.length === 0) throw new Error('nothing to import');

    // Same id means the same record (re-import, restored backup): replace it.
    const reportIds = new Set(reports.map((r) => r.id));
    const templateIds = new Set(templates.map((t) => t.id));
    set({
      reports: [...reports, ...get().reports.filter((r) => !reportIds.has(r.id))],
      templates: [...get().templates.filter((t) => !templateIds.has(t.id)), ...templates],
    });
    reports.forEach((r) => void db.put('reports', r));
    templates.forEach((t) => void db.put('templates', t));
    return reports.length + templates.length;
  },
}));

export function allTemplates(custom: Template[]): Template[] {
  return [...BUILTIN_TEMPLATES, ...custom];
}

export function findTemplate(custom: Template[], id: string): Template | undefined {
  return allTemplates(custom).find((t) => t.id === id);
}

/** Stable fingerprint of a template's content, for "has it changed since?" checks. */
export function templateSignature(template: Template): string {
  return JSON.stringify(normalizeTemplate(template));
}

export function exportFile(payload: Record<string, unknown>): string {
  return JSON.stringify({ app: FILE_APP, version: 1, ...payload }, null, 2);
}
