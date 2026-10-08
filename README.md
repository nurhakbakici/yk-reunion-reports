# Ankha Rapor Terminali

In-game report creator for **YK: Reunion**, the sci-fi living-campaign TTRPG set aboard the colony ship ANKH-A ([wiki](https://yk-reunion.fandom.com/wiki/Yk:reunion_Wiki)).

Pick a template, fill in a form, and get a finished in-universe document — a mission report, an Atlas incident record, a medical evaluation — that you can drop into Discord as an image, paste as text, or print to PDF. Templates are fully editable and can be shared as files.

The app is a static web page with no server. Everything you write stays in your own browser.

## Running it

You need [Node.js](https://nodejs.org) 20 or newer.

```
npm install
npm run dev        # http://127.0.0.1:3600, reloads as you edit
npm run build      # writes dist/index.html
```

`npm run build` produces **one self-contained file**, `dist/index.html`, with all code, styles and fonts inside it. That file is the whole app:

- **On Windows:** double-click it. It runs straight from disk, offline, in Chrome, Edge or Firefox. Send the file to another player and it works for them too.
- **On GitHub Pages:** push this repository to GitHub, then in the repository's *Settings → Pages* set *Source* to **GitHub Actions**. The included workflow (`.github/workflows/deploy.yml`) builds and publishes on every push to `main`.

Reports are stored per browser and per address, so the copy opened from disk and the copy on GitHub Pages each have their own library. Use *Tümünü yedekle* / *İçe aktar* to move between them.

## What it does

**Reports**

- Form on the left, live document on the right.
- A report that outgrows one A4 page continues on the next: long text breaks between lines, tables between rows, and every page carries the classification bars, a page number and the document number.
- Every document has a subject line, a generated document number, a classification banner (Açık → Çok Gizli) and an optional rotated stamp.
- Dates default to today plus 300 years, matching the setting (2026 → 2326).
- Location, department, origin, organisation and Atlas squad fields suggest values from the wiki but accept anything.
- Long text understands `**bold**`, `*italic*`, `- ` bullets and `||redacted||`, which prints as black bars. The hidden words are not in the exported image or PDF.

**Export**

| Button | Result |
| --- | --- |
| PNG indir | 2× resolution image of the document; a report longer than one page gives one numbered file per page |
| Görseli kopyala | The document as one image on the clipboard (all pages stacked), ready to paste into Discord |
| Yazdır / PDF | A4 print layout, one sheet per page; choose "Save as PDF" in the print dialog |
| Metin olarak kopyala | Markdown text that Discord renders as-is |
| Rapor dosyası (.json) | The report itself, for another player to import and edit |

**Templates**

Nine built-in templates, written in Turkish and based on the ship's departments and supporting organisations:

Görev Raporu · Güvenlik Olay Tutanağı (Atlas) · Tıbbi Değerlendirme · Arıza ve Bakım Kaydı · Bilimsel Analiz Raporu · Personel Dosyası · Stellars Soruşturma Dosyası (Yıldız Cemiyeti) · Gemi Duyurusu · Kişisel Kayıt

Built-ins are read-only; *Özelleştir* makes an editable copy. In the template editor you can change:

- name, heading, issuing body, document-number prefix, default classification
- document language (Turkish or English) — sets the fixed labels and correct upper-casing of i/İ
- theme: Konsol (dark console), Amber terminal, Basılı evrak (paper), Kurumsal (corporate)
- accent colour and emblem, or upload your own logo
- sections and fields: add, remove, reorder, rename

Field types: short text, long text, choice, date, bullet list, table, level meter, image, signature. Each can be full width, 2/3, half or 1/3. A 1/3 image placed first in a section becomes a portrait beside the 2/3 fields that follow it (see Personel Dosyası).

A report keeps its own copy of the template it was made from, so editing or deleting a template never breaks old reports. When the template has changed, the report offers to move to the new version.

## Shared campaign archive (optional)

Out of the box every player's reports stay in their own browser. Connecting a free [Supabase](https://supabase.com) project adds a shared archive:

- an **Arşiv** tab that anyone can read, without an account;
- an **Arşive yayınla** button on every report, for campaign members (a name and a join code, no accounts);
- per report, the author chooses **Herkes** (public) or **Yalnızca oyun yöneticileri** (only the author and GMs can see it);
- authors can update or remove their own publications; GMs can remove any.

Publishing sends a snapshot. Drafts and later edits stay private until published again.

Until the two values in `src/cloud/config.ts` are filled in, none of this is shown and the app behaves as before.

### Setting it up

Menu names in the Supabase dashboard change now and then; look for the nearest match.

1. **Create the project.** Sign up at supabase.com, create a new project (any region near your players), and wait for it to finish starting.
2. **Create the tables and access rules.** Open *SQL Editor*, paste the whole of [`supabase/schema.sql`](supabase/schema.sql), and run it.
3. **Allow sign-in without accounts.** In *Authentication → Sign In / Providers* turn on *Allow anonymous sign-ins* and save. The app uses no emails or passwords: each browser gets an identity of its own the first time someone joins.
4. **Connect the app.** From *Project Settings → API* copy the *Project URL* and the *anon / publishable* key into `src/cloud/config.ts`, then commit and push. Both values are meant to be public. Never put the `service_role` key in the app.
5. **Get the two codes.** Run this in the SQL Editor:

   ```sql
   select key, value from public.app_settings;
   ```

   `join_code` is for players and `gm_code` is for game masters. On the site, *Arşive katıl* asks for a name and one of the codes. More admin queries (changing a code, listing or removing members) are at the end of `schema.sql`.

### Good to know

- **Who can publish:** only people who entered the join code or the GM code. A stranger who finds the site can read public reports but cannot add any.
- **Identity lives in the browser.** There is no account to log back into. Someone who clears their browser data, or uses another device, joins again with the code and gets a new identity; reports published from the old one stay in the archive but can then only be removed by a GM.
- **Keep the GM code to the GMs.** Anyone who enters it can read GM-only reports and remove any report. If it leaks, change it and demote whoever should not have it (queries in `schema.sql`).
- **Author names** are the name each person typed when joining, changeable under their name in the top bar. They cannot be typed in per report.
- **Free-tier pause:** Supabase pauses a free project after about a week with no activity. Reading the archive counts as activity; if it does pause, resume it from the dashboard.
- **Size:** a published report can be up to roughly 3.5 MB, images included. The free database holds 500 MB.

## Project layout

```
supabase/schema.sql        Archive tables and access rules (run once in Supabase)
src/
  cloud/                   Archive connection, joining and publishing
  lore.ts                  Setting data from the wiki (departments, locations, …)
  templates/builtin.ts     The built-in templates
  types.ts                 Template / Report data model
  store.ts                 App state, import validation
  db.ts                    IndexedDB persistence
  i18n.ts                  Turkish and English UI strings
  components/
    Document.tsx           The rendered in-game document
    ReportEditor.tsx       Form + preview + export
    TemplateEditor.tsx     Template builder
    FieldInput.tsx         Form control for each field type
  lib/exporters.ts         PNG, clipboard and text export
  styles/document.css      Document themes and print layout
  styles/app.css           App chrome
```

To add or correct setting data (a new location, a new organisation), edit `src/lore.ts`. To add a built-in template, add an entry to `src/templates/builtin.ts`.

## Roadmap

Built so far: report library, nine templates, template editor, four themes, automatic A4 pages for long reports, PNG / clipboard / PDF / text / JSON export, import and backup, Turkish and English UI, phone layout.

Next, roughly in order of value:

1. **More templates** as the campaign needs them: psychological evaluation (İnsan, Deneyim ve Kültür), cargo and inventory manifest, flight log (Sandstorm), EDEN Foods ration report, Koyash energy report, A.R.E.M. android maintenance record.
2. **Character roster** — save your characters once (name, origin, department, organisation, portrait) and pick them in crew tables and signature fields instead of retyping.
3. **Drag-and-drop reordering** of sections and fields in the template editor.
4. **More document dressing**: handwritten margin notes, coffee-stain / damaged-data effects, a second stamp, a manual "new page here" marker.
5. **Shared template pack** — a `templates/` folder in the repository that GMs maintain, loaded by everyone on the hosted version.
6. **Installable app** — add a web manifest so the GitHub Pages version can be installed as a desktop app from Chrome or Edge.

## Notes

- The emblems are original line drawings made for this app. Organisation logos from the wiki are not bundled; upload one per template if you want it on your documents.
- Fonts (Oxanium, JetBrains Mono, IBM Plex Serif) are open-source and embedded, so exports look the same on every machine.
