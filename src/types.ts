export type Lang = 'tr' | 'en';

export type ThemeId = 'konsol' | 'amber' | 'evrak' | 'kurumsal';
export const THEMES: ThemeId[] = ['konsol', 'amber', 'evrak', 'kurumsal'];

export type Classification = 'none' | 'acik' | 'hizmete-ozel' | 'gizli' | 'cok-gizli';
export const CLASSIFICATIONS: Classification[] = ['none', 'acik', 'hizmete-ozel', 'gizli', 'cok-gizli'];

export type EmblemId =
  | 'none'
  | 'ankh'
  | 'shield'
  | 'star'
  | 'sun'
  | 'gear'
  | 'leaf'
  | 'cross'
  | 'atom';
export const EMBLEMS: EmblemId[] = ['ankh', 'shield', 'star', 'sun', 'gear', 'leaf', 'cross', 'atom', 'none'];

export type FieldType =
  | 'text'
  | 'longtext'
  | 'select'
  | 'date'
  | 'list'
  | 'table'
  | 'scale'
  | 'image'
  | 'signature';
export const FIELD_TYPES: FieldType[] = [
  'text',
  'longtext',
  'select',
  'date',
  'list',
  'table',
  'scale',
  'image',
  'signature',
];

export type FieldWidth = 'full' | 'twothirds' | 'half' | 'third';
export const FIELD_WIDTHS: FieldWidth[] = ['full', 'twothirds', 'half', 'third'];

/** Suggestion lists that come from the setting (see lore.ts). */
export type LoreSource = 'departments' | 'locations' | 'origins' | 'orgs' | 'squads';
export const LORE_SOURCES: LoreSource[] = ['departments', 'locations', 'origins', 'orgs', 'squads'];

export interface FieldDef {
  id: string;
  type: FieldType;
  label: string;
  width?: FieldWidth;
  placeholder?: string;
  /** select: the choices. text: free-form suggestions. */
  options?: string[];
  /** text: suggestions pulled from the setting. */
  source?: LoreSource;
  /** table: column headers. */
  columns?: string[];
  /** scale: highest value (default 5). */
  max?: number;
}

export interface SectionDef {
  id: string;
  title: string;
  fields: FieldDef[];
}

export interface Template {
  id: string;
  name: string;
  description: string;
  theme: ThemeId;
  accent: string;
  /** Issuing body shown in the document header. */
  issuer: string;
  emblem: EmblemId;
  /** Custom logo (data URL). Replaces the emblem when set. */
  logo?: string;
  /** Big document heading, e.g. "GÖREV RAPORU". */
  docTitle: string;
  /** Prefix for generated document numbers, e.g. "GRV". */
  codePrefix: string;
  classification: Classification;
  /** Language the document is written in. Sets its fixed labels and how text
   *  is upper-cased (Turkish i → İ), independently of the app's UI language. */
  lang: Lang;
  sections: SectionDef[];
  builtin?: boolean;
  updatedAt: number;
}

export interface ImageValue {
  src: string;
  caption: string;
}

export interface SignatureValue {
  name: string;
  title: string;
}

export type FieldValue = string | number | string[][] | ImageValue | SignatureValue;

export interface Report {
  id: string;
  /** Subject line; also the name shown in the report library. */
  title: string;
  docNo: string;
  classification: Classification;
  /** Optional rotated stamp, e.g. "ONAYLANDI". */
  stamp: string;
  hideEmpty: boolean;
  /** Draw the classification diagonally across the whole page as well. */
  watermark: boolean;
  /** Snapshot of the template the report was created from, so a report stays
   *  readable after the template is edited, deleted, or sent to someone else. */
  template: Template;
  values: Record<string, FieldValue>;
  createdAt: number;
  updatedAt: number;
}
