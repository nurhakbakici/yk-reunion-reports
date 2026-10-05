import type { LoreSource } from './types';

// Setting data taken from the YK: Reunion wiki (https://yk-reunion.fandom.com).
// These only feed the suggestion dropdowns; every field still accepts free text,
// so the lists can grow as the campaign does.

/** The game is set 300 years after the real-world date (2026 → 2326). */
export const YEAR_OFFSET = 300;

export const SHIP_NAME = 'ANKH-A';
export const PROJECT_NAME = 'PROJECT: REUNION';

export const DEPARTMENTS = [
  'Yönetim ve Genel Hizmetler',
  'Güvenlik',
  'Bilim ve Kaynak Yönetimi',
  'Teknik',
  'İnsan, Deneyim ve Kültür',
];

export const ORIGINS = ['Dünya Birleşik Hükümeti (DBH)', 'Mars Cumhuriyeti', 'ICU Özerkliği'];

export const ORGS = [
  'Atlas Güvenlik Şirketi',
  'Yıldız Cemiyeti',
  'EDEN Foods',
  'Koyash Corporation',
  'A.R.E.M.',
  'Sandstorm',
  'GOATS',
  'Archive',
];

/** The four squads of Ultimi Cadere, the Atlas unit aboard. */
export const SQUADS = ['Devil Dogs', 'Clash Corps', 'FP (Find and Protect)', 'Jurisdiction Force'];

export const LOCATIONS = [
  'A Çemberi — Kriyo Katı',
  'A Çemberi — Konaklama Bölgesi',
  'A Çemberi — Toplanma ve Rekreasyon Alanı',
  'A Çemberi — Bilgi & Erişim Bölgesi',
  'A Çemberi — Spor ve Sağlık Bölgesi',
  'B Çemberi — Komuta',
  'B Çemberi — Yaşam',
  'B Çemberi — Revir ve Kriyo',
  'B Çemberi — Cephanelik',
  'C Çemberi — Dikey Bahçe',
  'C Çemberi — Mantar Çiftliği',
  'C Çemberi — Su Deposu',
  'C Çemberi — Deney Odaları',
  'C Çemberi — Hayvan Alanı',
  'C Çemberi — Füzyon Reaktörü',
  'D Çemberi — D1 Hangar',
  'D Çemberi — D2 Atölyeler',
  'D Çemberi — Hava Kilitleri',
  'D Çemberi — Kontrol Kulesi',
  'Omurga — Kızak Hattı',
  'Omurga — Boğaz',
  'Omurga — İtki Reaktörü',
  'Kontrol Bölgesi',
];

export const LORE: Record<LoreSource, string[]> = {
  departments: DEPARTMENTS,
  locations: LOCATIONS,
  origins: ORIGINS,
  orgs: ORGS,
  squads: SQUADS,
};
