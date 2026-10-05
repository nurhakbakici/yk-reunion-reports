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
- Every document has a subject line, a generated document number, a classification banner (Açık → Çok Gizli) and an optional rotated stamp.
- Dates default to today plus 300 years, matching the setting (2026 → 2326).
- Location, department, origin, organisation and Atlas squad fields suggest values from the wiki but accept anything.
- Long text understands `**bold**`, `*italic*`, `- ` bullets and `||redacted||`, which prints as black bars. The hidden words are not in the exported image or PDF.

**Export**

| Button | Result |
| --- | --- |
| PNG indir | 2× resolution image of the document |
| Görseli kopyala | Same image on the clipboard, ready to paste into Discord |
| Yazdır / PDF | A4 print layout; choose "Save as PDF" in the print dialog |
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

## Project layout

```
src/
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

Built so far: report library, nine templates, template editor, four themes, PNG / clipboard / PDF / text / JSON export, import and backup, Turkish and English UI, phone layout.

Next, roughly in order of value:

1. **More templates** as the campaign needs them: psychological evaluation (İnsan, Deneyim ve Kültür), cargo and inventory manifest, flight log (Sandstorm), EDEN Foods ration report, Koyash energy report, A.R.E.M. android maintenance record.
2. **Character roster** — save your characters once (name, origin, department, organisation, portrait) and pick them in crew tables and signature fields instead of retyping.
3. **Drag-and-drop reordering** of sections and fields in the template editor.
4. **More document dressing**: handwritten margin notes, coffee-stain / damaged-data effects, a second stamp, page numbers for multi-page prints.
5. **Shared template pack** — a `templates/` folder in the repository that GMs maintain, loaded by everyone on the hosted version.
6. **Installable app** — add a web manifest so the GitHub Pages version can be installed as a desktop app from Chrome or Edge.

## Notes

- The emblems are original line drawings made for this app. Organisation logos from the wiki are not bundled; upload one per template if you want it on your documents.
- Fonts (Oxanium, JetBrains Mono, IBM Plex Serif) are open-source and embedded, so exports look the same on every machine.
