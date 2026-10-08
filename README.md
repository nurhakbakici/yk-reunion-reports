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
- **Live copy:** <https://ankha-reports.kulesakinleri.org/>, set under *Settings → Pages → Custom domain*. Its DNS record (a CNAME to `nurhakbakici.github.io`, not proxied) is kept in the Kule Sakinleri forum's Cloudflare account. The old address, `https://nurhakbakici.github.io/yk-reunion-reports/`, forwards there.

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
| PDF indir | The document as a PDF, one A4 sheet per page, straight away (no print dialog). The pages are images, so the text cannot be selected |
| Görseli kopyala | The document as one image on the clipboard (all pages stacked), ready to paste into Discord |
| Yazdır / PDF | A4 print layout, one sheet per page; choose "Save as PDF" in the print dialog |
| Metin olarak kopyala | Markdown text that Discord renders as-is |
| Rapor dosyası (.json) | The report itself, for another player to import and edit |
| Foruma gönder | Opens a new topic on one of the YK: Reunion boards of the [Kule Sakinleri forum](https://kulesakinleri.org/forum/), filled in with the report (see below) |

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

## Sending a report to the forum

*Foruma gönder* posts a report as a new topic in one of the ReUnion boards of the Kule Sakinleri forum, under the player's own forum account.

1. Pick the board. The list comes from the forum (`https://kulesakinleri.org/reunion-bolumler.php`), so new boards show up by themselves. Open reports start on *Umuma Mahsus Raporlar*, classified ones on *Hizmete Mahsus Raporlar*. Meanwhile the app prepares the text, the PDF and the preview; *Forumda aç* can be clicked once they are ready.
2. *Forumda aç* opens the board's New Topic page in a new tab. If the forum asks you to sign in, do so; the report arrives after that.
3. The forum fills in the subject, the report as text (BBCode, in the editor's source view) and two attachments: the report as a PDF and its first page as a preview image. Hidden (`||…||`) words are left out of all three.
4. Check it and press *Gönder* yourself. Nothing is posted until you do.

How it works: the app keeps the forum tab as an opened window and sends the report with `postMessage`. The Kule forum theme (`kule-ankha.js`) accepts it only from `https://ankha-reports.kulesakinleri.org` (and from `https://nurhakbakici.github.io` until the move is done) and only in a tab this app opened, and it never submits the form. That is also why it only works on GitHub Pages, not in the copy opened from disk. The forum side lives in the Kule theme repository; the design is `docs/superpowers/specs/2026-10-08-ankha-forum-design.md` there.

## Personal archive (optional)

Out of the box every player's reports stay in the browser they were written in. Connecting a free [Supabase](https://supabase.com) project gives each player an archive of their own:

- an **Arşive kaydet** button on every report, which stores it as **Taslak** (draft) or **Tamamlandı** (finished);
- an **Arşiv** tab listing what you saved, and only that: nobody can read anyone else's reports;
- on another device, sign in and use **Raporlarıma al** to bring a report back into the library.

Saving stores a snapshot. Later edits reach the archive when you save again; the button reads **Arşivi güncelle** while there are any. Sharing with other players is what **Foruma gönder** is for.

Until the two values in `src/cloud/config.ts` are filled in, none of this is shown and the app behaves as before.

### Setting it up

Menu names in the Supabase dashboard change now and then; look for the nearest match.

1. **Create the project.** Sign up at supabase.com, create a new project (any region near your players), and wait for it to finish starting.
2. **Create the tables and access rules.** Open *SQL Editor*, paste the whole of [`supabase/schema.sql`](supabase/schema.sql), and run it. It can be run again at any time, and it upgrades the earlier shared archive in place.
3. **Let people make accounts without email.** In *Authentication → Sign In / Providers* open *Email*, keep it enabled, and switch **Confirm email off**. Switch *Allow anonymous sign-ins* off too; the app no longer uses them.
4. **Connect the app.** From *Project Settings → API* copy the *Project URL* and the *anon / publishable* key into `src/cloud/config.ts`, and set `LOGIN_MAILBOX` there to a mailbox the campaign owns (see below). Then commit and push. The URL and key are meant to be public. Never put the `service_role` key in the app.
5. **Get the join code.** Run this in the SQL Editor and give the code to your players:

   ```sql
   select value from public.app_settings where key = 'join_code';
   ```

   On the site, *Giriş yap → Hesap oluştur* asks for a user name, a password and this code. More admin queries (changing the code, listing accounts, resetting a password) are at the end of `schema.sql`.

### Good to know

- **User names, not emails.** Supabase only signs people in by email address, so each user name becomes a "plus" address of `LOGIN_MAILBOX` (*name* → `mailbox+name@…`). The app never sends mail to it, but it has to be a real mailbox that you control: anything Supabase might ever send for an account would arrive there.
- **Forgotten passwords** cannot be recovered by the player. Set a new one with the query at the end of `schema.sql`, tell them, and have them change it under their name in the top bar.
- **Who can save:** only accounts that entered the join code. Anyone can make an account, but without the code it can store nothing.
- **Free-tier pause:** Supabase pauses a free project after about a week with no activity. Signing in or opening the archive counts as activity; if it does pause, resume it from the dashboard.
- **Size:** a saved report can be up to roughly 3.5 MB, images included. The free database holds 500 MB; the accounts query in `schema.sql` shows how much each person uses.

## Project layout

```
supabase/schema.sql        Archive tables and access rules (run once in Supabase)
src/
  cloud/                   Archive connection, accounts and saving
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
  lib/pdf.ts               PDF from the page images (no library)
  lib/bbcode.ts            The report as forum BBCode
  lib/forum.ts             Forum board list and the hand-over to the forum tab
  components/ForumDialog.tsx  "Foruma gönder"
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
